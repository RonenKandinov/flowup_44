import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Splitit-style installment engine:
//   Payment Request -> Installment Engine -> Payment Authorization -> Payment Schedule -> Installments
// No real card processor is connected yet, so the "authorization"/"charge" steps are simulated
// deterministically-ish (small random decline/failure rate) — swap addAuthorization()/chargeOnce()
// for a real gateway call (e.g. Stripe) later without touching the schedule/retry/idempotency logic.

function addPeriod(dateStr, frequency, n) {
  const d = new Date(dateStr);
  if (frequency === 'weekly') d.setDate(d.getDate() + 7 * n);
  else if (frequency === 'biweekly') d.setDate(d.getDate() + 14 * n);
  else d.setMonth(d.getMonth() + n); // monthly
  return d.toISOString().split('T')[0];
}

function genTransactionId() {
  return `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function logAudit(base44, user, action, status, details) {
  try {
    await base44.entities.AuditLog.create({ action, user_id: user.email, status, details });
  } catch (_) { /* logging must never break the payment flow */ }
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { action } = body;

    if (action === 'create_plan') {
      const { collectionsCaseId, debtorName, totalAmount, numberOfInstallments, frequency, startDate } = body;
      if (!collectionsCaseId || !totalAmount || !numberOfInstallments) {
        return Response.json({ error: 'Missing required fields' }, { status: 400 });
      }

      const idempotencyKey = `${collectionsCaseId}_${totalAmount}_${numberOfInstallments}`;

      // Duplicate-plan prevention: an existing live plan for this exact request is reused, not re-created.
      const existing = await base44.entities.PaymentPlan.filter({ collections_case_id: collectionsCaseId });
      const liveExisting = existing.find(p => ['pending_authorization', 'active'].includes(p.status) && p.idempotency_key === idempotencyKey);
      if (liveExisting) {
        const installments = await base44.entities.Installment.filter({ payment_plan_id: liveExisting.id });
        return Response.json({ success: true, plan: liveExisting, installments, reused: true });
      }

      const baseInstallmentAmount = Math.floor((totalAmount / numberOfInstallments) * 100) / 100;
      const start = startDate || new Date().toISOString().split('T')[0];

      const plan = await base44.entities.PaymentPlan.create({
        collections_case_id: collectionsCaseId,
        debtor_name: debtorName || '',
        total_amount: totalAmount,
        number_of_installments: numberOfInstallments,
        installment_amount: baseInstallmentAmount,
        frequency: frequency || 'monthly',
        start_date: start,
        status: 'pending_authorization',
        authorization_status: 'pending',
        idempotency_key: idempotencyKey
      });

      const rows = [];
      let allocated = 0;
      for (let i = 0; i < numberOfInstallments; i++) {
        const isLast = i === numberOfInstallments - 1;
        const amount = isLast ? Math.round((totalAmount - allocated) * 100) / 100 : baseInstallmentAmount;
        allocated += amount;
        rows.push({
          payment_plan_id: plan.id,
          installment_number: i + 1,
          amount,
          due_date: addPeriod(start, frequency || 'monthly', i),
          status: 'pending',
          attempt_count: 0,
          max_attempts: 3
        });
      }
      const installments = await base44.entities.Installment.bulkCreate(rows);

      await logAudit(base44, user, 'PAYMENT_PLAN_CREATED', 'SUCCESS', { planId: plan.id, collectionsCaseId, totalAmount, numberOfInstallments });

      return Response.json({ success: true, plan, installments });
    }

    if (action === 'authorize_plan') {
      const { paymentPlanId } = body;
      const plan = await base44.entities.PaymentPlan.get(paymentPlanId);
      if (!plan) return Response.json({ error: 'Plan not found' }, { status: 404 });
      if (plan.authorization_status === 'authorized') {
        return Response.json({ success: true, plan }); // idempotent — already authorized
      }

      const authorized = Math.random() > 0.1; // simulated gateway response (~90% approval)
      const updated = await base44.entities.PaymentPlan.update(plan.id, {
        authorization_status: authorized ? 'authorized' : 'declined',
        status: authorized ? 'active' : 'failed'
      });

      await logAudit(base44, user, 'PAYMENT_AUTHORIZATION', authorized ? 'SUCCESS' : 'FAILURE', { planId: plan.id });

      return Response.json({ success: true, plan: updated });
    }

    if (action === 'charge_installment' || action === 'retry_installment') {
      const { installmentId } = body;
      const installment = await base44.entities.Installment.get(installmentId);
      if (!installment) return Response.json({ error: 'Installment not found' }, { status: 404 });

      // Idempotent — never double-charge an already-paid installment.
      if (installment.status === 'paid') {
        return Response.json({ success: true, installment, alreadyPaid: true });
      }
      if (installment.status === 'cancelled') {
        return Response.json({ error: 'Installment is cancelled' }, { status: 400 });
      }
      if (installment.attempt_count >= installment.max_attempts && installment.status === 'failed') {
        return Response.json({ error: 'Max retry attempts reached' }, { status: 400 });
      }

      const plan = await base44.entities.PaymentPlan.get(installment.payment_plan_id);
      if (!plan || plan.status !== 'active') {
        return Response.json({ error: 'Payment plan is not active' }, { status: 400 });
      }

      const attemptCount = (installment.attempt_count || 0) + 1;
      const success = Math.random() > 0.15; // simulated charge (~85% success)
      const now = new Date().toISOString();

      let updated;
      if (success) {
        updated = await base44.entities.Installment.update(installment.id, {
          status: 'paid',
          paid_at: now,
          last_attempt_at: now,
          attempt_count: attemptCount,
          transaction_id: genTransactionId(),
          failure_reason: ''
        });

        // Auto-complete the plan once every installment has been paid.
        const siblings = await base44.entities.Installment.filter({ payment_plan_id: plan.id });
        const allPaid = siblings.every(s => s.id === installment.id ? true : s.status === 'paid');
        if (allPaid) {
          await base44.entities.PaymentPlan.update(plan.id, { status: 'completed' });
        }
      } else {
        const exhausted = attemptCount >= installment.max_attempts;
        updated = await base44.entities.Installment.update(installment.id, {
          status: exhausted ? 'failed' : 'retrying',
          last_attempt_at: now,
          attempt_count: attemptCount,
          failure_reason: exhausted ? 'חיוב נכשל — מספר הניסיונות המקסימלי הגיע' : 'חיוב נכשל — ניתן לנסות שוב'
        });
      }

      await logAudit(base44, user, 'INSTALLMENT_CHARGE', success ? 'SUCCESS' : 'FAILURE', {
        installmentId: installment.id, planId: plan.id, amount: installment.amount, attemptCount
      });

      return Response.json({ success: true, installment: updated });
    }

    if (action === 'cancel_plan') {
      const { paymentPlanId, reason } = body;
      const plan = await base44.entities.PaymentPlan.get(paymentPlanId);
      if (!plan) return Response.json({ error: 'Plan not found' }, { status: 404 });
      if (plan.status === 'completed' || plan.status === 'cancelled') {
        return Response.json({ success: true, plan }); // idempotent no-op
      }

      const updatedPlan = await base44.entities.PaymentPlan.update(plan.id, {
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason || ''
      });

      const installments = await base44.entities.Installment.filter({ payment_plan_id: plan.id });
      await Promise.all(
        installments
          .filter(i => ['pending', 'retrying', 'failed'].includes(i.status))
          .map(i => base44.entities.Installment.update(i.id, { status: 'cancelled' }))
      );

      await logAudit(base44, user, 'PAYMENT_PLAN_CANCELLED', 'SUCCESS', { planId: plan.id, reason });

      return Response.json({ success: true, plan: updatedPlan });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}