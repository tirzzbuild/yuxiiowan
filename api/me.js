const { cors, json, authenticate, supa, requireMethod, safeError } = require('./_lib');
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (!requireMethod(req, res, ['GET', 'PATCH'])) return;
  try {
    const { user, profile } = await authenticate(req);
    if (req.method === 'GET') return json(res, 200, { profile: { ...profile, email: user.email } });
    const name = typeof req.body?.display_name === 'string' ? req.body.display_name.trim().slice(0, 60) : '';
    const updated = await supa(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,email,display_name,role,created_at`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ display_name: name })
    });
    return json(res, 200, { profile: updated[0] || profile });
  } catch (e) { return json(res, e.status || 500, { error: safeError(e) }); }
};
