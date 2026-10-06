const crypto = require("crypto");
const { currentUser, hashPassword, listUsers, send, supabase } = require("./_lib/core");

function canManageUsers(user) {
  return user && ["admin", "kam"].includes(user.role);
}

module.exports = async function handler(req, res) {
  if (!["POST", "DELETE"].includes(req.method)) return send(res, 405, { error: "Method not allowed" });
  try {
    const db = supabase();
    const operator = await currentUser(req, db);
    if (!canManageUsers(operator)) return send(res, 403, { error: "Forbidden" });

    if (req.method === "POST") {
      const user = req.body?.user || {};
      const username = String(user.username || "").trim();
      if (!username) return send(res, 400, { error: "Username required" });
      if (user.role === "dispatcher" && user.station === "Tutte") {
        return send(res, 400, { error: "Dispatcher station required" });
      }
      const { data: existing } = await db
        .from("driver_shift_users")
        .select("*")
        .ilike("username", username)
        .maybeSingle();

      if (!existing && !user.password) return send(res, 400, { error: "Password required" });

      const row = {
        id: user.id || existing?.id || crypto.randomUUID(),
        full_name: user.fullName || username,
        station: user.station || "Tutte",
        username,
        role: user.role || "dispatcher",
        active: true,
        updated_at: new Date().toISOString()
      };
      if (user.password) row.password_hash = hashPassword(user.password);
      const { error } = await db.from("driver_shift_users").upsert(row, { onConflict: "username" });
      if (error) throw error;
      return send(res, 200, { ok: true, users: await listUsers(db) });
    }

    const id = req.body?.id;
    if (!id) return send(res, 400, { error: "User id required" });
    if (id === operator.id) return send(res, 400, { error: "Cannot remove current user" });
    const { error } = await db
      .from("driver_shift_users")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return send(res, 200, { ok: true, users: await listUsers(db) });
  } catch (error) {
    console.error(error);
    return send(res, 500, { error: "Users request failed", detail: error.message || "" });
  }
};

