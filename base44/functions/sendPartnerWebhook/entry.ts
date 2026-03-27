import { createClientFromRequest } from 'npm:@base44/sdk@0.8.3';

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // 1. Verify caller is authenticated (our frontend)
    const user = await base44.auth.me().catch(() => null);
    // In a real B2B flow, the customer might not be a registered user in our app, 
    // but they are completing the flow. For now, we allow it if the payload is valid.

    const body = await req.json();
    const { partner_id, customer_id, analysis_results } = body;

    if (!partner_id || !customer_id || !analysis_results) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 2. Fetch the partner to get the Webhook URL
    const partner = await base44.asServiceRole.entities.B2BPartner.get(partner_id);
    if (!partner || !partner.active) {
      return Response.json({ error: "Invalid or inactive partner" }, { status: 404 });
    }

    // 3. Prepare the payload for the partner's CRM
    const webhookPayload = {
      event: "underwriting.completed",
      timestamp: new Date().toISOString(),
      customer_id: customer_id,
      decision: analysis_results.analyst_recommendation?.recommendation?.decision || "UNKNOWN",
      confidence: analysis_results.analyst_recommendation?.recommendation?.confidence || "UNKNOWN",
      risk_tier: analysis_results.risk_tier,
      metrics: analysis_results.metrics,
      summary: analysis_results.narrative,
      // Include the full AI analysis for their records
      full_analysis: analysis_results
    };

    // 4. Send the Webhook
    console.log(`Sending webhook to ${partner.name} at ${partner.webhook_url}`);
    
    try {
      const webhookRes = await fetch(partner.webhook_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "FlowUp-B2B-Engine/1.0"
        },
        body: JSON.stringify(webhookPayload)
      });

      if (!webhookRes.ok) {
        console.error(`Webhook failed with status ${webhookRes.status}`);
        // We don't fail our function, but we log it. We might want to implement retries later.
        return Response.json({ success: true, webhook_status: "failed", http_status: webhookRes.status });
      }
      
      return Response.json({ success: true, webhook_status: "delivered" });
    } catch (fetchErr) {
      console.error("Webhook fetch error:", fetchErr);
      return Response.json({ success: true, webhook_status: "error", error: fetchErr.message });
    }

  } catch (err) {
    console.error("Webhook Sender Error:", err);
    return Response.json(
      { error: "Internal server error", details: err.message },
      { status: 500 }
    );
  }
});