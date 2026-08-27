# SEO & Blog CMS

Admins can manage SEO and publish blogs from **Floriva Admin** (`admin.florivagifts.com`), the same panel as Banner & Images.

- Add the Blog page with [admin-panel/INTEGRATE.md](../admin-panel/INTEGRATE.md)
- APIs: `/api/admin/blog` (Bearer admin JWT, same as products)
- Temporary HTML CMS remains at `/api/cms/blog` until the admin page is wired in

On **Blog → New post**, upload a featured image and use **Insert image + placement** (left / center / right / full width). The storefront should wrap HTML in `.blog-content` and load `/blog-content.css`.

One-time website work is still required so the storefront **reads** these settings (meta tags, GTM, 404, slugs). After that, SEO edits happen only in the CMS.

## What you can manage

| Area | CMS tab | Notes |
|------|---------|--------|
| Meta title, meta description, URL, index/noindex | Pages | Changing a URL writes a 301 redirect |
| Blog posts, headings H1–H3, images with placement + ALT + caption, featured image align, internal links, meta, slug | Blog | Draft or publish. Images insert as WordPress-style `<figure class="alignleft size-medium">`. Load `/blog-content.css` on the storefront. |
| Product title, description, slug, meta, image ALT | Products | SEO-friendly `/product/{slug}` |
| 301/302 redirects | Redirects | From URL → To URL |
| XML sitemap, robots.txt, 404 copy, URL prefixes | Technical SEO | `/sitemap.xml` and `/robots.txt` on the API |
| GA4, GTM, Search Console verification | Google tools | Paste IDs / verification file |

## Public API (for the website)

- `GET /api/seo/public` — GA4 ID, GTM ID, Search Console meta, default titles, 404 copy
- `GET /api/seo/resolve?path=/about` — meta + robots + redirect or 404 for a path
- `GET /api/blog` and `GET /api/blog/:slug` — published posts
- `GET /api/productview/:slug` — product by SEO slug (ObjectIds still work)
- `GET /sitemap.xml` and `GET /robots.txt`

On the **public domain** (`www.florivagifts.com`), proxy `/sitemap.xml` and `/robots.txt` to the API so Google sees them on the website origin.

### Storefront checklist (one-time)

1. On each route, call `/api/seo/resolve?path=...` and set `<title>`, meta description, and `<meta name="robots">`.
2. If `type` is `redirect`, issue the returned 301/302.
3. If `type` is `not_found`, render the 404 title/body from the payload (HTTP 404).
4. Inject GTM / GA4 from `/api/seo/public`.
5. Use product and blog slugs in URLs (`/product/{slug}`, `/blog/{slug}`).
6. Proxy sitemap and robots on the public hostname.
7. Render blog `content` as HTML (not escaped text). Wrap it in `.blog-content` and include `https://api.florivagifts.com/blog-content.css` so left/center/right/full image placement works. Use `featuredImageAlign` (`left` | `center` | `right` | `full` | `none`) on the hero image.

## Google tools

These cannot be “granted” from the server; they live on Google accounts.

1. **Google Tag Manager** — create a container, paste `GTM-XXXX` into Google tools. Frontend reads it from `/api/seo/public`.
2. **GA4** — create a property, paste `G-XXXXXXXX` the same way (or publish GA4 via GTM only).
3. **Search Console** — add `https://www.florivagifts.com`, verify with the meta tag or `google*.html` file stored in Google tools. Then submit `https://www.florivagifts.com/sitemap.xml`.

## Admin API

All `/api/admin/seo/*` and `/api/admin/blog*` routes require a Bearer admin JWT.
