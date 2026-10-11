// Shared server-only helpers for Vercel Functions.
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const UPSTREAM_BASE_URL = (process.env.AXZYEDEV_BASE_URL || 'https://axzy.my.id').replace(/\/+$/, '');
const UPSTREAM_API_KEY = process.env.AXZYEDEV_API_KEY || '';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';

function headers(res) {
  res.setHeader('Vary', 'Origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
}
function cors(req, res) {
  headers(res);
  const origin = req.headers.origin;
  if (ALLOWED_ORIGIN && origin === ALLOWED_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  }
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  return false;
}
function json(res, status, data) { return res.status(status).json(data); }
function envReady() { return SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY; }
function serviceHeaders(extra = {}) { return { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', ...extra }; }
async function supa(path, options = {}) {
  const r = await fetch(`${SUPABASE_URL}${path}`, { ...options, headers: { ...serviceHeaders(), ...(options.headers || {}) } });
  const raw = await r.text(); let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!r.ok) { const e = new Error(data?.message || data?.msg || `Supabase returned ${r.status}`); e.status = r.status; throw e; }
  return data;
}
async function authenticate(req) {
  if (!envReady()) throw Object.assign(new Error('Backend environment variables are not configured.'), { status: 500 });
  const auth = req.headers.authorization || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) throw Object.assign(new Error('Authentication required.'), { status: 401 });
  const token = match[1];
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
  if (!r.ok) throw Object.assign(new Error('Invalid or expired session.'), { status: 401 });
  const user = await r.json();
  const rows = await supa(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,email,display_name,role,created_at&limit=1`);
  if (!rows?.length) throw Object.assign(new Error('User profile not found.'), { status: 403 });
  return { user, profile: rows[0] };
}
function requireMethod(req, res, methods) {
  if (!methods.includes(req.method)) { res.setHeader('Allow', methods.join(', ')); json(res, 405, { error: 'Method not allowed.' }); return false; }
  return true;
}
function safeError(err) { return err?.status ? err.message : 'Internal server error.'; }
module.exports = { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, UPSTREAM_BASE_URL, UPSTREAM_API_KEY, cors, json, envReady, supa, authenticate, requireMethod, safeError };
