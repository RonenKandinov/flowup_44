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
// 3️⃣ Get full connection details
const fullConnRes = await fetch(
  `${API_V2}/connections/${connectionId}`,
  {
    headers: {
      "Authorization": `Bearer ${access_token}`
    }
  }
);

const fullConnection = await fullConnRes.json();

if (!fullConnRes.ok) {
  return Response.json({
    error: "Failed to fetch connection details",
    fullConnection
  });
}

return Response.json({
  success: true,
  connectionId,
  connectionData: fullConnection
});
  


});
