const { clearSessionCookie, send } = require("./_lib/core");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  clearSessionCookie(res);
  return send(res, 200, { ok: true });
};

