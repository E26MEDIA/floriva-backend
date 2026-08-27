const slugify = (value, fallback = 'item') => {
  const slug = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return slug || fallback;
};

const normalizePath = (value) => {
  let path = String(value || '').trim();
  if (!path) return '/';
  if (!path.startsWith('/')) path = `/${path}`;
  path = path.replace(/\/{2,}/g, '/');
  if (path.length > 1) path = path.replace(/\/+$/, '');
  return path;
};

const ensureUniqueSlug = async (Model, baseSlug, excludeId, field = 'slug') => {
  let candidate = slugify(baseSlug);
  let n = 2;
  const query = () => {
    const q = { [field]: candidate };
    if (excludeId) q._id = { $ne: excludeId };
    return q;
  };

  while (await Model.exists(query())) {
    candidate = `${slugify(baseSlug)}-${n}`;
    n += 1;
  }
  return candidate;
};

module.exports = { slugify, normalizePath, ensureUniqueSlug };
