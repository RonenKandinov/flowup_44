import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// This function runs the full underwriting pipeline in the background:
// 1. Fetch bank data via loanLogicV2
// 2. Run insightEngine
// 3. Send webhook to partner
// The frontend fires-and-forgets this — no waiting for the result.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { partner_id, customer_id, connection_id, psu_id } = body;

    if (!partner_id || !customer_id || !psu_id) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Fetch partner
    const partner = await base44.asServiceRole.entities.B2BPartner.get(partner_id);
    if (!partner || !partner.active) {
      return Response.json({ error: "Invalid or inactive partner" }, { status: 404 });
    }

    // 1. Wait for connection to be ACTIVE (poll up to 60s)
    const READY = ['ACTIVE', 'COMPLETED', 'CONNECTED'];
    const ERROR_STATES = ['ERROR', 'FETCHING_ERROR', 'EXPIRED', 'REJECTED', 'REVOKED'];
    let status = 'INACTIVE';
    let attempts = 0;

    while (!READY.includes(status) && !ERROR_STATES.includes(status) && attempts < 20) {
      await new Promise(r => setTimeout(r, 3000));
      const statusRes = await base44.functions.invoke('openFinanceAuth', {
        action: 'check_status',
        connectionId: connection_id,
        psuId: psu_id
      });
      status = statusRes.data?.status || 'UNKNOWN';
      attempts++;
    }

    if (ERROR_STATES.includes(status)) {
      console.error(`Connection failed for customer ${customer_id}: ${status}`);
      return Response.json({ success: false, error: `Connection failed: ${status}` });
    }

    // 2. Fetch bank data
    const bankRes = await base44.functions.invoke('loanLogicV2', { userId: psu_id });
    if (!bankRes.data?.success) {
      console.error(`loanLogicV2 failed for ${customer_id}`);
      return Response.json({ success: false, error: 'Failed to fetch bank data' });
    }

    // 3. Run insight engine (the slow part — runs in background, customer already sees success)
    const insightRes = await base44.functions.invoke('insightEngine', { metrics: bankRes.data.metrics });
    if (!insightRes.data?.success) {
      console.error(`insightEngine failed for ${customer_id}`);
      return Response.json({ success: false, error: 'Insight engine failed' });
    }

    const insights = insightRes.data.insights;

    // 4. Send webhook to partner
    const webhookPayload = {
      event: "underwriting.completed",
      timestamp: new Date().toISOString(),
      customer_id,
      decision: insights.analyst_recommendation?.recommendation?.decision || "UNKNOWN",
      confidence: insights.analyst_recommendation?.recommendation?.confidence || "UNKNOWN",
      risk_tier: insights.risk_tier,
      metrics: insights.metrics,
      summary: insights.narrative,
      full_analysis: insights
    };

    const webhookRes = await fetch(partner.webhook_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "FlowUp-B2B-Engine/1.0"
      },
      body: JSON.stringify(webhookPayload)
    });

    console.log(`Webhook sent to ${partner.name}: ${webhookRes.status}`);

    // Log to AuditLog
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'B2B_UNDERWRITING_COMPLETED',
      user_id: customer_id,
      status: 'SUCCESS',
      details: {
        partner_id,
        partner_name: partner.name,
        risk_tier: insights.risk_tier,
        webhook_status: webhookRes.ok ? 'delivered' : 'failed',
        webhook_http_status: webhookRes.status
      }
    }).catch(() => {});

    return Response.json({ success: true, webhook_status: webhookRes.ok ? 'delivered' : 'failed' });

  } catch (err) {
    console.error("B2B Underwriting Error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});