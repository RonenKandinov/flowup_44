
const base44 = globalThis.base44;Deno.serve(async (req) => {
  try {
    const base44 = globalThis.base44;

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    return Response.json({
      ok: true,
      userId: user.id
    });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});