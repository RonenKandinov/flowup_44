Deno.serve(async (req) => {
  const API_ROOT = "https://api.open-finance.ai";
  const API_V2 = "https://api.open-finance.ai/v2";

  const API_KEY = Deno.env.get("OPEN_FINANCE_API_KEY");
  const API_SECRET = Deno.env.get("OPEN_FINANCE_API_SECRET");

  const { userId } = await req.json();

  // 1️⃣ Get token
  const tokenRes = await fetch(`${API_ROOT}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      clientId: API_KEY,
      clientSecret: API_SECRET
    })
  });

  const tokenJson = await tokenRes.json();
  const access_token = tokenJson.accessToken;

  // 2️⃣ Get connections
  const connectionsRes = await fetch(`${API_V2}/connections`, {
    headers: {
      "Authorization": `Bearer ${access_token}`
    }
  });

  const connections = await connectionsRes.json();

const list = connections.items || connections.data || connections;

const completed = list.find(
  (c) => c.status === "COMPLETED"
);

if (!completed) {
  return Response.json({
    error: "No COMPLETED connection found",
    connections
  });
}

const connectionId = completed?.id;

  

  // 3️⃣ Get accounts
  const accountsRes = await fetch(
    `${API_V2}/connections/${connectionId}/accounts`,
    {
      headers: {
        "Authorization": `Bearer ${access_token}`
      }
    }
  );

  const accounts = await accountsRes.json();
  const accountId = accounts.data?.[0]?.id;

  if (!accountId) {
    return Response.json({ error: "No accounts found", accounts });
  }

  // 4️⃣ Get transactions
  const txRes = await fetch(
    `${API_V2}/accounts/${accountId}/transactions`,
    {
      headers: {
        "Authorization": `Bearer ${access_token}`
      }
    }
  );

  const transactions = await txRes.json();

  return Response.json({
    success: true,
    connectionId,
    accounts,
    transactions
  });
});
