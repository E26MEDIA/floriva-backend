# Floriva API (Backend)

Node.js + Express + MongoDB API for Florivagifts.

- **Live:** https://api.florivagifts.com  
- **Port (local):** 7000  

## Local dev

```bash
npm install
cp .env.example .env   # if you have an example file
npm start
```

Requires `MONGO_URL` and `JWT_SECRET` in `.env`.

## Deploy (VPS)

SSH into your server, then:

```bash
cd /var/www/floriva-backend
bash scripts/update-vps-backend.sh
```

Or manually:

```bash
git pull origin main
npm ci --omit=dev
mkdir -p uploads/products uploads/categories uploads/site-content uploads/blog
pm2 restart all
```

## SEO & blog CMS

Admins can edit page meta tags, publish blogs, manage product SEO, 301 redirects, sitemap/robots, and Google tag IDs without changing website code.

- **CMS:** `/seo-cms/` (same admin login as the main panel)
- **Guide:** [docs/SEO.md](docs/SEO.md)
- **Blog images:** insert with WordPress-style placement (left/center/right/full + size). Storefront CSS: `/blog-content.css`


## Repos

| App | GitHub |
|-----|--------|
| Backend (this) | floriva-backend |
| Admin | floriva-admin |
| Frontend | floriva-frontend |
