const { cors, json, authenticate, UPSTREAM_BASE_URL, requireMethod, safeError } = require('./_lib');
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (!requireMethod(req, res, ['GET'])) return;
  try {
    await authenticate(req);
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const r = await fetch(`${UPSTREAM_BASE_URL}/api/docs`, { method: 'GET', signal: controller.signal });
      return json(res, 200, { ok: true, upstream: r.ok, status: r.status });
    } finally { clearTimeout(timer); }
  } catch (e) { return json(res, e.status || 200, { ok: false, upstream: false, error: safeError(e) }); }
};
