const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const STATE_ID = "main";
const COOKIE_NAME = "driver_shift_session";

function supabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

function defaultState() {
  return {
    station: "OSI2",
    weekStart: "",
    weeks: 6,
    forecastIncrease: 0,
    drivers: [],
    forecast: [],
    absences: [],
    constraints: [],
    actualRoutes: [],
    plan: {},
    confirmedDates: [],
    log: [],
    users: []
  };
}

function defaultUsers() {
  return [
    { id: "USR-ADMIN", fullName: "Gabriele Fiumara", station: "Tutte", username: "Admin", password: "123456", role: "admin" },
    { id: "USR-CAM", fullName: "Danilo Santacroce", station: "Tutte", username: "CAM", password: "123456", role: "kam" },
    { id: "USR-DSP1", fullName: "Nome Cognome", station: "DSI2", username: "DSP1", password: "654321", role: "dispatcher" }
  ];
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, expected] = String(stored || "").split(":");
  if (!salt || !expected) return false;
  const actual = hashPassword(password, salt).split(":")[1];
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function sanitizeUser(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    station: row.station,
    username: row.username,
    password: "",
    role: row.role
  };
}

async function listUsers(db = supabase()) {
  const { data, error } = await db.from("driver_shift_users").select("*").eq("active", true).order("full_name");
  if (error) throw error;
  return data.map(sanitizeUser);
}

async function ensureSeedData(db = supabase()) {
  const { data: existingUsers, error: userError } = await db.from("driver_shift_users").select("username").limit(1);
  if (userError) throw userError;
  if (!existingUsers.length) {
    const rows = defaultUsers().map((user) => ({
      id: user.id,
      full_name: user.fullName,
      station: user.station,
      username: user.username,
      password_hash: hashPassword(user.password),
      role: user.role,
      active: true
    }));
    const { error } = await db.from("driver_shift_users").insert(rows);
    if (error) throw error;
  }

  const { data: stateRows, error: stateError } = await db.from("driver_shift_state").select("id").eq("id", STATE_ID).limit(1);
  if (stateError) throw stateError;
  if (!stateRows.length) {
    const data = { ...defaultState(), users: await listUsers(db) };
    const { error } = await db.from("driver_shift_state").insert({ id: STATE_ID, data });
    if (error) throw error;
  }
}

async function getState(db = supabase()) {
  await ensureSeedData(db);
  const { data, error } = await db.from("driver_shift_state").select("data").eq("id", STATE_ID).single();
  if (error) throw error;
  return { ...defaultState(), ...data.data, users: await listUsers(db) };
}

async function syncUsersFromState(state, db = supabase()) {
  const incoming = Array.isArray(state.users) ? state.users.filter((user) => user.username) : [];
  const { data: current, error } = await db.from("driver_shift_users").select("*");
  if (error) throw error;
  const incomingNames = new Set(incoming.map((user) => user.username.toLowerCase()));

  for (const oldUser of current) {
    if (!incomingNames.has(oldUser.username.toLowerCase())) {
      await db.from("driver_shift_users").update({ active: false, updated_at: new Date().toISOString() }).eq("username", oldUser.username);
    }
  }

  for (const user of incoming) {
    const existing = current.find((item) => item.username.toLowerCase() === user.username.toLowerCase());
    const row = {
      id: user.id || existing?.id || crypto.randomUUID(),
      full_name: user.fullName || user.full_name || user.username,
      station: user.station || "Tutte",
      username: user.username,
      role: user.role || "dispatcher",
      active: true,
      updated_at: new Date().toISOString()
    };
    if (user.password) row.password_hash = hashPassword(user.password);
    else if (!existing) row.password_hash = hashPassword(crypto.randomBytes(12).toString("hex"));
    const { error: upsertError } = await db.from("driver_shift_users").upsert(row, { onConflict: "username" });
    if (upsertError) throw upsertError;
  }
}

async function saveState(state, db = supabase(), options = {}) {
  if (options.syncUsers) await syncUsersFromState(state, db);
  const sanitized = { ...defaultState(), ...state, users: await listUsers(db) };
  const { error } = await db
    .from("driver_shift_state")
    .upsert({ id: STATE_ID, data: sanitized, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw error;
  return sanitized;
}

function signSession(payload) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Missing SESSION_SECRET");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function readSession(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  const [body, sig] = match[1].split(".");
  const expected = crypto.createHmac("sha256", process.env.SESSION_SECRET || "").update(body).digest("base64url");
  if (!sig || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (!payload.exp || payload.exp < Date.now()) return null;
  return payload;
}

function setSessionCookie(res, user) {
  const token = signSession({ username: user.username, role: user.role, exp: Date.now() + 12 * 60 * 60 * 1000 });
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=43200`);
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
}

async function currentUser(req, db = supabase()) {
  const session = readSession(req);
  if (!session) return null;
  const { data, error } = await db.from("driver_shift_users").select("*").eq("username", session.username).eq("active", true).single();
  if (error || !data) return null;
  return sanitizeUser(data);
}

function send(res, status, body) {
  res.status(status).json(body);
}

module.exports = {
  clearSessionCookie,
  currentUser,
  ensureSeedData,
  getState,
  hashPassword,
  listUsers,
  saveState,
  send,
  setSessionCookie,
  supabase,
  verifyPassword
};
