const { send, supabase, verifyPassword } = require("./_lib/core");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" });
  const result = {
    ok: false,
    env: {
      supabaseUrl: Boolean(process.env.SUPABASE_URL),
      supabaseKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      sessionSecret: Boolean(process.env.SESSION_SECRET)
    },
    database: {
      usersTable: false,
      stateTable: false,
      usersCount: 0,
      adminPresent: false,
      adminPasswordCheck: false
    }
  };
  try {
    const db = supabase();
    const users = await db.from("driver_shift_users").select("username,password_hash", { count: "exact" });
    if (users.error) throw users.error;
    result.database.usersTable = true;
    result.database.usersCount = users.count || users.data.length;
    const admin = users.data.find((user) => String(user.username).toLowerCase() === "admin");
    result.database.adminPresent = Boolean(admin);
    result.database.adminPasswordCheck = admin ? verifyPassword("123456", admin.password_hash) : false;

    const state = await db.from("driver_shift_state").select("id").eq("id", "main").limit(1);
    if (state.error) throw state.error;
    result.database.stateTable = true;
    result.ok = result.env.supabaseUrl && result.env.supabaseKey && result.env.sessionSecret && result.database.adminPresent && result.database.adminPasswordCheck;
    return send(res, 200, result);
  } catch (error) {
    result.error = error.message || "Health check failed";
    return send(res, 500, result);
  }
};

