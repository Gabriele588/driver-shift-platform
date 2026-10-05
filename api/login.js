const { ensureSeedData, getState, send, setSessionCookie, supabase, verifyPassword } = require("./_lib/core");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  try {
    const db = supabase();
    await ensureSeedData(db);
    const { username, password } = req.body || {};
    const { data: user, error } = await db
      .from("driver_shift_users")
      .select("*")
      .ilike("username", String(username || ""))
      .eq("active", true)
      .single();
    if (error || !user || !verifyPassword(password, user.password_hash)) {
      return send(res, 401, { error: "Invalid credentials" });
    }
    setSessionCookie(res, user);
    const state = await getState(db);
    return send(res, 200, {
      authenticated: true,
      user: {
        id: user.id,
        fullName: user.full_name,
        station: user.station,
        username: user.username,
        password: "",
        role: user.role
      },
      state
    });
  } catch (error) {
    console.error(error);
    return send(res, 500, { error: "Login failed" });
  }
};

