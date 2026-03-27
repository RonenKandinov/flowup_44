import { createClientFromRequest } from 'npm:@base44/sdk@0.8.3';

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // 1. Extract API Key from headers
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return Response.json({ error: "Missing or invalid Authorization header. Use 'Bearer <API_KEY>'" }, { status: 401 });
    }
    const apiKey = authHeader.split(" ")[1];

    // 2. Parse request body
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { customer_id, requested_loan_amount, product_type } = body;
    if (!customer_id) {
      return Response.json({ error: "customer_id is required" }, { status: 400 });
    }

    // 3. Verify Partner API Key
    const partners = await base44.asServiceRole.entities.B2BPartner.filter({ api_key: apiKey, active: true });
    if (!partners || partners.length === 0) {
      return Response.json({ error: "Invalid API Key or inactive partner" }, { status: 401 });
    }
    const partner = partners[0];

    // 4. Generate the magic link for the customer
    // We use the host from the request to build the absolute URL
    const host = req.headers.get("host") || "";
    const protocol = host.includes("localhost") ? "http" : "https";
    const baseUrl = `${protocol}://${host}`;
    
    // Create a secure payload (in a real prod scenario we'd sign this or save a session entity)
    // For now, we pass it in the URL to our dedicated B2B connect page
    const connectUrl = new URL(`${baseUrl}/b2b-connect`);
    connectUrl.searchParams.set("partner_id", partner.id);
    connectUrl.searchParams.set("customer_id", customer_id);
    if (requested_loan_amount) connectUrl.searchParams.set("amount", requested_loan_amount);
    if (product_type) connectUrl.searchParams.set("product", product_type);

    // 5. Return the link to the partner
    return Response.json({
      success: true,
      message: "Link generated successfully. Send this link to your customer via SMS/Email.",
      connect_url: connectUrl.toString(),
      partner_name: partner.name,
      customer_id: customer_id
    });

  } catch (err) {
    console.error("Partner API Error:", err);
    return Response.json(
      { error: "Internal server error", details: err.message },
      { status: 500 }
    );
  }
});