const { currentUser, getState, saveState, send, supabase } = require("./_lib/core");

module.exports = async function handler(req, res) {
  if (!["GET", "PUT"].includes(req.method)) return send(res, 405, { error: "Method not allowed" });
  try {
    const db = supabase();
    const user = await currentUser(req, db);
    if (!user) return send(res, 401, { error: "Unauthorized" });
    if (req.method === "GET") {
      const state = await getState(db);
      return send(res, 200, { ok: true, user, state, ts: Date.now() });
    }
    const state = await saveState(req.body?.state || {}, db);
    return send(res, 200, { ok: true, user, state, ts: Date.now() });
  } catch (error) {
    console.error(error);
    return send(res, 500, { error: "State request failed" });
  }
};
