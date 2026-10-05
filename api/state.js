const { currentUser, saveState, send, supabase } = require("./_lib/core");

module.exports = async function handler(req, res) {
  if (req.method !== "PUT") return send(res, 405, { error: "Method not allowed" });
  try {
    const db = supabase();
    const user = await currentUser(req, db);
    if (!user) return send(res, 401, { error: "Unauthorized" });
    const state = await saveState(req.body?.state || {}, db);
    return send(res, 200, { ok: true, state });
  } catch (error) {
    console.error(error);
    return send(res, 500, { error: "State save failed" });
  }
};

