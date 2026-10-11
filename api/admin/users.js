const { cors, json, authenticate, supa, requireMethod, safeError } = require('../_lib');
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (!requireMethod(req, res, ['GET', 'PATCH'])) return;
  try {
    const { user, profile } = await authenticate(req);
    if (profile.role !== 'admin') return json(res, 403, { error: 'Administrator role required.' });
    if (req.method === 'GET') {
      const users = await supa('/rest/v1/profiles?select=id,email,display_name,role,created_at&order=created_at.desc&limit=500');
      return json(res, 200, { users });
    }
    const { user_id, role } = req.body || {};
    if (typeof user_id !== 'string' || !['admin', 'user'].includes(role)) return json(res, 400, { error: 'Provide user_id and role=admin|user.' });
    if (user_id === user.id) return json(res, 400, { error: 'You cannot change your own role.' });
    const updated = await supa(`/rest/v1/profiles?id=eq.${encodeURIComponent(user_id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ role }) });
    if (!updated.length) return json(res, 404, { error: 'User not found.' });
    return json(res, 200, { profile: updated[0] });
  } catch (e) { return json(res, e.status || 500, { error: safeError(e) }); }
};
