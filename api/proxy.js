const { cors, json, authenticate, supa, UPSTREAM_BASE_URL, UPSTREAM_API_KEY, requireMethod, safeError } = require('./_lib');
const ACTIONS = {
  deploy: { endpoint: '/api/deploy', fields: ['name', 'repo'] },
  subdomain: { endpoint: '/api/subdomain', fields: ['name'] },
  amprem: { endpoint: '/api/amprem', fields: ['email'] },
  buildapk: { endpoint: '/api/build-apk', fields: ['repo'] }
};
function validPayload(action, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return 'Payload must be a JSON object.';
  for (const key of action.fields) {
    if (typeof payload[key] !== 'string' || !payload[key].trim()) return `Field "${key}" is required.`;
    if (payload[key].length > 500) return `Field "${key}" is too long.`;
  }
  for (const key of Object.keys(payload)) if (!action.fields.includes(key)) return `Unexpected field "${key}".`;
  if (payload.repo !== undefined) {
    try { const u = new URL(payload.repo); if (!['https:', 'http:'].includes(u.protocol)) throw Error(); }
    catch { return 'Repository must be a valid HTTP/HTTPS URL.'; }
  }
  if (payload.email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) return 'Email format is invalid.';
  if (payload.name !== undefined && !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,62}$/.test(payload.name)) return 'Name contains unsupported characters.';
  return null;
}
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (!requireMethod(req, res, ['POST'])) return;
  let actor, actionId = 'unknown', payload = {}, started = Date.now(), statusCode = null, ok = false;
  try {
    const auth = await authenticate(req); actor = auth.user;
    if (!UPSTREAM_API_KEY) return json(res, 500, { error: 'Upstream API key is not configured on the server.' });
    const action = ACTIONS[req.body?.action]; actionId = req.body?.action || 'unknown'; payload = req.body?.payload || {};
    if (!action) return json(res, 400, { error: 'Unsupported API action.' });
    const invalid = validPayload(action, payload); if (invalid) return json(res, 400, { error: invalid });

    // Basic per-user rate limit: max 20 requests in a rolling 10-minute window.
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const recent = await supa(`/rest/v1/request_logs?user_id=eq.${encodeURIComponent(actor.id)}&created_at=gte.${encodeURIComponent(since)}&select=id&limit=21`);
    if (recent.length >= 20) return json(res, 429, { error: 'Rate limit: maksimal 20 request per 10 menit.' });

    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 30000);
    let responseBody;
    try {
      const upstream = await fetch(UPSTREAM_BASE_URL + action.endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': UPSTREAM_API_KEY },
        body: JSON.stringify(payload), signal: controller.signal
      });
      statusCode = upstream.status;
      const raw = await upstream.text();
      try { responseBody = raw ? JSON.parse(raw) : null; } catch { responseBody = raw.slice(0, 12000); }
      ok = upstream.ok;
    } finally { clearTimeout(timer); }
    const duration = Date.now() - started;
    await writeLog(actor.id, actionId, payload, ok, statusCode, duration);
    return json(res, 200, { ok, action: actionId, upstream_status: statusCode, duration_ms: duration, response: responseBody });
  } catch (e) {
    const duration = Date.now() - started;
    if (actor) await writeLog(actor.id, actionId, payload, false, statusCode, duration).catch(() => {});
    const status = e.status || (e.name === 'AbortError' ? 504 : 500);
    return json(res, status, { error: e.name === 'AbortError' ? 'Upstream request timed out.' : safeError(e), duration_ms: duration });
  }
};
async function writeLog(userId, action, payload, ok, statusCode, duration) {
  const safeDetail = {};
  // Keep only submitted field names/values needed for the user's private history.
  for (const [k, v] of Object.entries(payload || {})) safeDetail[k] = String(v).slice(0, 200);
  await supa('/rest/v1/request_logs', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ user_id: userId, action, detail: safeDetail, ok, status_code: statusCode, duration_ms: duration }) });
}
