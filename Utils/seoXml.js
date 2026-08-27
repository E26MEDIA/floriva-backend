const escapeXml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const joinUrl = (siteUrl, path) => {
  const base = String(siteUrl || '').replace(/\/+$/, '');
  const suffix = path === '/' ? '/' : String(path || '').startsWith('/') ? path : `/${path}`;
  if (!base) return suffix;
  if (suffix === '/') return `${base}/`;
  return `${base}${suffix}`;
};

const buildSitemapXml = ({ siteUrl, urls }) => {
  const body = (urls || [])
    .filter((entry) => entry && entry.loc)
    .map((entry) => {
      const loc = escapeXml(entry.loc.startsWith('http') ? entry.loc : joinUrl(siteUrl, entry.loc));
      const lastmod = entry.lastmod
        ? `\n    <lastmod>${escapeXml(new Date(entry.lastmod).toISOString().slice(0, 10))}</lastmod>`
        : '';
      const changefreq = entry.changefreq
        ? `\n    <changefreq>${escapeXml(entry.changefreq)}</changefreq>`
        : '';
      const priority =
        entry.priority !== undefined && entry.priority !== null
          ? `\n    <priority>${escapeXml(entry.priority)}</priority>`
          : '';
      return `  <url>\n    <loc>${loc}</loc>${lastmod}${changefreq}${priority}\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
};

const buildRobotsTxt = ({ siteUrl, extraRules, sitemapPath = '/sitemap.xml' }) => {
  const sitemap = joinUrl(siteUrl, sitemapPath);
  const extra = String(extraRules || '').trim();
  const lines = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /checkout',
    'Disallow: /cart',
    'Disallow: /account',
    extra,
    `Sitemap: ${sitemap}`,
  ].filter((line, index, arr) => line !== '' || arr[index - 1] !== '');

  return `${lines.join('\n')}\n`;
};

module.exports = { escapeXml, joinUrl, buildSitemapXml, buildRobotsTxt };
