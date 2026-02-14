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

  

  // 3️⃣ Get accounts (flat endpoint)
const accountsRes = await fetch(
  `${API_V2}/accounts?connectionId=${connectionId}`,
  {
    headers: {
      "Authorization": `Bearer ${access_token}`
    }
  }
);

const accounts = await accountsRes.json();

if (!accountsRes.ok) {
  return Response.json({
    error: "Accounts fetch failed",
    accounts
  });
}

// 4️⃣ Get transactions (flat endpoint)
const txRes = await fetch(
  `${API_V2}/transactions?connectionId=${connectionId}`,
  {
    headers: {
      "Authorization": `Bearer ${access_token}`
    }
  }
);

const transactions = await txRes.json();

if (!txRes.ok) {
  return Response.json({
    error: "Transactions fetch failed",
    transactions
  });
}

return Response.json({
  success: true,
  connectionId,
  accounts,
  transactions
});
});
