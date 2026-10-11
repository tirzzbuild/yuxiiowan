const { cors, json, authenticate, supa, requireMethod, safeError } = require('./_lib');
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (!requireMethod(req, res, ['GET'])) return;
  try {
    const { user } = await authenticate(req);
    const requested = Number.parseInt(req.query?.limit || '40', 10);
    const limit = Math.max(1, Math.min(Number.isFinite(requested) ? requested : 40, 100));
    const items = await supa(`/rest/v1/request_logs?user_id=eq.${encodeURIComponent(user.id)}&select=id,action,detail,ok,status_code,duration_ms,created_at&order=created_at.desc&limit=${limit}`);
    return json(res, 200, { items });
  } catch (e) { return json(res, e.status || 500, { error: safeError(e) }); }
};
