# Caer-Sidi E-Card website

Static, self-hosted copy of the Caer-Sidi website prepared for GitHub Pages.

## What is included

- English, Ukrainian, and Russian landing pages.
- Help Center, Use Cases, legal pages, and four product pages.
- Original self-hosted images, illustrations, icons, and animated GIFs.
- A small replacement runtime for responsive backgrounds, lazy images, mobile navigation, contact requests, product-order requests, and the cookie notice.

The contact form and product buttons open the visitor's email application addressed to `support@caersidi.net`. This avoids keeping the Weblium form and checkout backends after the Weblium subscription ends.

## Local preview

```powershell
npm run serve
```

Open <http://127.0.0.1:4173/>.

## Refresh from Weblium

```powershell
npm run sync
```

`sync` downloads the public site again and prepares a static version in `site/`. The raw download report and temporary source files are kept under `_source/` and are not committed.

## Deployment

Every push to `main` deploys the `site/` directory through GitHub Actions. The custom domain is intentionally not configured yet so DNS can be switched only after the GitHub Pages preview is approved.
