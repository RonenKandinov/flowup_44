import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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

      const insightRes = await base44.functions.invoke('insightEngine', { metrics: bankRes.data.metrics });
      if (!insightRes.data?.success) {
        return Response.json({ success: false, error: 'Insight engine failed' });
      }
      
      const insights = insightRes.data.insights;

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

    return Response.json({ error: "Invalid action" }, { status: 400 });

  } catch (err) {
    console.error("B2B Service Error:", err);
    return Response.json({ error: "Internal server error", details: err.message }, { status: 500 });
  }
});