const { currentUser, getState, send, supabase } = require("./_lib/core");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" });
  try {
    const db = supabase();
    const user = await currentUser(req, db);
    if (!user) return send(res, 200, { authenticated: false });
    const state = await getState(db);
    return send(res, 200, { authenticated: true, user, state });
  } catch (error) {
    console.error(error);
    return send(res, 500, { error: "Session check failed" });
  }
};

