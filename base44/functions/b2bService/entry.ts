import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ── Onboarding link crypto helpers (HMAC-SHA256, base64url) ──
const TTL_HOURS = 24;

const b64url = (bytes) => {
  const bin = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const randomToken = (bytes = 32) => {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return b64url(buf);
};

const hmacHex = async (secret, payload) => {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
};

// Constant-time string compare to avoid timing leaks on the token hash
const safeEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    let body = {};
    if (req.method === 'POST') {
      try { body = await req.json(); } catch(e) {}
    }
    
    const url = new URL(req.url);
    const action = body.action || url.searchParams.get("action");

    // --- Partner API Logic (generate magic link) ---
    if (action === 'generate_magic_link' || (!action && req.headers.get("Authorization")?.startsWith("Bearer "))) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return Response.json({ error: "Missing or invalid Authorization header. Use 'Bearer <API_KEY>'" }, { status: 401 });
      }
      const apiKey = authHeader.split(" ")[1];
      const { customer_id, requested_loan_amount, product_type } = body;
      
      if (!customer_id) return Response.json({ error: "customer_id is required" }, { status: 400 });

      const partners = await base44.asServiceRole.entities.B2BPartner.filter({ api_key: apiKey, active: true });
      if (!partners || partners.length === 0) {
        return Response.json({ error: "Invalid API Key or inactive partner" }, { status: 401 });
      }
      const partner = partners[0];

      const host = req.headers.get("host") || "";
      const protocol = host.includes("localhost") ? "http" : "https";
      const baseUrl = `${protocol}://${host}`;
      const connectUrl = new URL(`${baseUrl}/b2b-connect`);
      
      connectUrl.searchParams.set("partner_id", partner.id);
      connectUrl.searchParams.set("customer_id", customer_id);
      if (requested_loan_amount) connectUrl.searchParams.set("amount", requested_loan_amount);
      if (product_type) connectUrl.searchParams.set("product", product_type);

      return Response.json({
        success: true,
        message: "Link generated successfully. Send this link to your customer via SMS/Email.",
        connect_url: connectUrl.toString(),
        partner_name: partner.name,
        customer_id: customer_id
      });
    }

    // --- Process Underwriting Logic ---
    if (action === 'process_underwriting') {
      const { partner_id, customer_id, connection_id, psu_id } = body;
      if (!partner_id || !customer_id || !psu_id) {
        return Response.json({ error: "Missing required fields" }, { status: 400 });
      }

      const partner = await base44.asServiceRole.entities.B2BPartner.get(partner_id);
      if (!partner || !partner.active) {
        return Response.json({ error: "Invalid or inactive partner" }, { status: 404 });
      }

      const READY = ['ACTIVE', 'COMPLETED', 'CONNECTED'];
      const ERROR_STATES = ['ERROR', 'FETCHING_ERROR', 'EXPIRED', 'REJECTED', 'REVOKED'];
      let status = 'INACTIVE';
      let attempts = 0;

      while (!READY.includes(status) && !ERROR_STATES.includes(status) && attempts < 20) {
        await new Promise(r => setTimeout(r, 3000));
        const statusRes = await base44.functions.invoke('openFinanceAuth', {
          action: 'check_status', connectionId: connection_id, psuId: psu_id
        });
        status = statusRes.data?.status || 'UNKNOWN';
        attempts++;
      }

      if (ERROR_STATES.includes(status)) {
        return Response.json({ success: false, error: `Connection failed: ${status}` });
      }

      const bankRes = await base44.functions.invoke('loanLogicV2', { userId: psu_id });
      if (!bankRes.data?.success) {
        return Response.json({ success: false, error: 'Failed to fetch bank data' });
      }

      const insightRes = await base44.functions.invoke('insightEngine', {
        metrics: bankRes.data.metrics,
        behaviorProfile: bankRes.data.behaviorProfile || null
      });
      if (!insightRes.data?.success) {
        return Response.json({ success: false, error: 'Insight engine failed' });
      }
      
      const insights = insightRes.data.insights;

      const persistRes = await base44.functions.invoke('persistAnalysis', {
        action: 'save',
        userId: psu_id,
        insights,
        loanMetrics: { ...(bankRes.data.metrics || {}), userId: psu_id },
        connectionId: connection_id || '',
        partnerId: partner_id
      }).catch(() => null);
      const analysisId = persistRes?.data?.id || null;

      base44.functions.invoke('generateNarrativeInsights', {
        analysisId,
        metrics: { ...(bankRes.data.metrics || {}), userId: psu_id },
        insights,
        behaviorProfile: bankRes.data.behaviorProfile || null,
        userId: psu_id
      }).catch(() => {});

      if (body.onboarding_session_id) {
        await base44.asServiceRole.entities.CustomerOnboardingSession.update(body.onboarding_session_id, {
          status: 'completed',
          completed_at: new Date().toISOString(),
          open_finance_connection_id: connection_id || '',
          analysis_id: analysisId || ''
        }).catch(() => {});
      }

      const webhookPayload = {
        event: "underwriting.completed",
        timestamp: new Date().toISOString(),
        customer_id,
        decision: insights.analyst_recommendation?.recommendation?.decision || "UNKNOWN",
        confidence: insights.analyst_recommendation?.recommendation?.confidence || "UNKNOWN",
        risk_tier: insights.risk_tier,
        metrics: insights.metrics,
        summary: insights.narrative,
        full_analysis: insights,
        analysis_id: analysisId
      };

      const webhookRes = await fetch(partner.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "FlowUp-B2B-Engine/1.0" },
        body: JSON.stringify(webhookPayload)
      });

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
    }

    // --- Onboarding: update session status (public page calls backend, backend uses service role) ---
    if (action === 'update_onboarding_session') {
      const { session_id, status, connection_id = '', analysis_id = '', failure_reason = '' } = body || {};
      if (!session_id || !status) return Response.json({ error: 'session_id and status are required' }, { status: 400 });
      const patch = { status };
      if (connection_id) patch.open_finance_connection_id = connection_id;
      if (analysis_id) patch.analysis_id = analysis_id;
      if (failure_reason) patch.failure_reason = failure_reason;
      if (status === 'completed') patch.completed_at = new Date().toISOString();
      await base44.asServiceRole.entities.CustomerOnboardingSession.update(session_id, patch);
      return Response.json({ success: true });
    }

    // --- Send Partner Webhook Logic ---
    if (action === 'send_webhook') {
      const { partner_id, customer_id, analysis_results } = body;
      if (!partner_id || !customer_id || !analysis_results) {
        return Response.json({ error: "Missing required fields" }, { status: 400 });
      }

      const partner = await base44.asServiceRole.entities.B2BPartner.get(partner_id);
      if (!partner || !partner.active) {
        return Response.json({ error: "Invalid or inactive partner" }, { status: 404 });
      }

      const webhookPayload = {
        event: "underwriting.completed",
        timestamp: new Date().toISOString(),
        customer_id: customer_id,
        decision: analysis_results.analyst_recommendation?.recommendation?.decision || "UNKNOWN",
        confidence: analysis_results.analyst_recommendation?.recommendation?.confidence || "UNKNOWN",
        risk_tier: analysis_results.risk_tier,
        metrics: analysis_results.metrics,
        summary: analysis_results.narrative,
        full_analysis: analysis_results
      };
      
      try {
        const webhookRes = await fetch(partner.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "User-Agent": "FlowUp-B2B-Engine/1.0" },
          body: JSON.stringify(webhookPayload)
        });

        if (!webhookRes.ok) {
          return Response.json({ success: true, webhook_status: "failed", http_status: webhookRes.status });
        }
        return Response.json({ success: true, webhook_status: "delivered" });
      } catch (fetchErr) {
        return Response.json({ success: true, webhook_status: "error", error: fetchErr.message });
      }
    }

    // --- Onboarding: create signed customer link (admin only) ---
    if (action === 'create_onboarding_link') {
      const user = await base44.auth.me();
      if (!user || user.role !== 'admin') {
        return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
      }

      const secret = Deno.env.get('ONBOARDING_LINK_SECRET');
      if (!secret) {
        return Response.json({ error: 'ONBOARDING_LINK_SECRET not configured' }, { status: 500 });
      }

      const {
        b2b_partner_id,
        customer_name = '',
        customer_id = '',
        customer_phone = '',
        requested_amount = null,
        base_url = ''
      } = body || {};

      if (!b2b_partner_id) {
        return Response.json({ error: 'b2b_partner_id is required' }, { status: 400 });
      }

      const partner = await base44.asServiceRole.entities.B2BPartner.get(b2b_partner_id).catch(() => null);
      if (!partner || !partner.active) {
        return Response.json({ error: 'Partner not found or inactive' }, { status: 404 });
      }

      const rawToken = randomToken(32);
      const tokenHash = await hmacHex(secret, rawToken);
      const expiresAt = new Date(Date.now() + TTL_HOURS * 60 * 60 * 1000).toISOString();

      const session = await base44.asServiceRole.entities.CustomerOnboardingSession.create({
        b2b_partner_id,
        b2b_partner_name: partner.name,
        customer_name,
        customer_id,
        customer_phone,
        requested_amount: requested_amount ? Number(requested_amount) : null,
        status: 'pending',
        token_hash: tokenHash,
        expires_at: expiresAt
      });

      const origin = String(base_url || '').replace(/\/$/, '');
      const link = `${origin}/connect/${session.id}?t=${rawToken}`;

      return Response.json({
        session_id: session.id,
        link,
        expires_at: expiresAt,
        partner_name: partner.name
      });
    }

    // --- Onboarding: validate signed customer link (public, called by /connect page) ---
    if (action === 'validate_onboarding_link') {
      const secret = Deno.env.get('ONBOARDING_LINK_SECRET');
      if (!secret) {
        return Response.json({ error: 'ONBOARDING_LINK_SECRET not configured' }, { status: 500 });
      }

      const { session_id, token } = body || {};
      if (!session_id || !token) {
        return Response.json({ error: 'session_id and token are required' }, { status: 400 });
      }

      const session = await base44.asServiceRole.entities.CustomerOnboardingSession
        .get(session_id)
        .catch(() => null);

      if (!session) {
        return Response.json({ error: 'invalid_link' }, { status: 404 });
      }

      if (new Date(session.expires_at).getTime() < Date.now()) {
        if (session.status !== 'expired') {
          await base44.asServiceRole.entities.CustomerOnboardingSession.update(session_id, {
            status: 'expired',
            failure_reason: 'Link expired'
          });
        }
        return Response.json({ error: 'expired' }, { status: 410 });
      }

      if (['completed', 'failed'].includes(session.status)) {
        return Response.json({ error: 'already_used', status: session.status }, { status: 409 });
      }

      const incomingHash = await hmacHex(secret, String(token));
      if (!safeEqual(incomingHash, session.token_hash || '')) {
        return Response.json({ error: 'invalid_token' }, { status: 401 });
      }

      if (session.status === 'pending') {
        await base44.asServiceRole.entities.CustomerOnboardingSession.update(session_id, {
          status: 'link_opened',
          link_opened_at: new Date().toISOString()
        });
      }

      return Response.json({
        session_id: session.id,
        b2b_partner_id: session.b2b_partner_id,
        b2b_partner_name: session.b2b_partner_name,
        customer_name: session.customer_name,
        customer_id: session.customer_id,
        requested_amount: session.requested_amount,
        expires_at: session.expires_at,
        status: session.status === 'pending' ? 'link_opened' : session.status
      });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });

  } catch (err) {
    console.error("B2B Service Error:", err);
    return Response.json({ error: "Internal server error", details: err.message }, { status: 500 });
  }
});