# Caer-Sidi migration audit remediation

Date: 24 August 2026

## Scope

This report covers the five migration defects identified in the independent 30-URL review, plus the broken Kyiv International Economic Forum demo links.

## Remediation status

| Finding | Status | Resolution |
| --- | --- | --- |
| Desktop fallback images were not hydrated | Fixed | Images with `data-fallback-url` now receive a site-aware `src` when no desktop source is present. |
| Product quantity controls did not update | Fixed | Quantity inputs are now resolved from the enclosing `.js-product-specs-quantity` component; updates also dispatch `input` and `change` events. |
| Cookie banner Privacy Policy URL returned 404 on GitHub Pages | Fixed | The URL is now produced by the project-path-aware `toSiteUrl()` helper. |
| Contact form omitted the selected region | Fixed | The selected USA, Poland, or Ukraine value is now included as `Region` in the generated email body. |
| Canonical/OG URLs were relative; robots and sitemap were missing | Fixed | All 23 pages now have absolute production canonical and `og:url` values. `robots.txt` and a 23-URL `sitemap.xml` are generated during preparation. |
| Kyiv Forum demo hostname no longer resolved | Fixed | Six demo links and three visible hostname references were changed from `ecard.forumkyiv.org` to `phyg.it`. |

## Kyiv Forum verification

`phyg.it` resolves to `34.102.234.207`. Both URL shapes used by the site were checked over HTTPS on 24 August 2026 and returned `200 OK`:

- `https://phyg.it/asset/b868790b-d634-4400-ac26-533ab42db87f`
- `https://phyg.it/assets/KIEFECARDSITEDEMO241120210001MMUXGCC4BSF`

## Verification

- `npm run prepare` completed for 23 HTML pages.
- `npm run check` completed for 68 HTML/CSS files.
- All local asset references and linked hash targets resolve.
- All 23 canonical and Open Graph URLs match their expected production URLs.
- `robots.txt` references the production sitemap.
- `sitemap.xml` contains all 23 migrated pages.
- The audit fails if the retired `ecard.forumkyiv.org` hostname reappears.
- The generated migration runtime contains the desktop image fallback, corrected quantity scope, Region field, and project-aware Privacy Policy URL.

## Published build verification

- Code commits: `f169b90` and `703b102` (including the fallback-asset regression check).
- GitHub Pages branch: `0a4515f`.
- Preview: `https://phygit-company.github.io/caersidi-site/`.
- All 23 published page routes returned `200 OK`.
- All 72 unique `data-fallback-url` assets returned `200 OK` from GitHub Pages.
- The published migration runtime, root canonical, `robots.txt`, and 23-entry `sitemap.xml` returned `200 OK` and contained the expected new values.

The in-app browser could not replay the final click tests after its failed localhost connection was converted into a policy-blocked browser error page. No browser-policy workaround was used. The corrected interaction selectors and generated public runtime were verified directly; a short manual quantity/cookie smoke test remains advisable before the DNS cutover.

## Remaining limitation

The contact and product-order flows still use `mailto:`. They do not submit to a server and do not retain a copy if the visitor has no configured email application or abandons the draft. This was not introduced by the remediation. A hosted form endpoint or small serverless handler is required for reliable delivery and storage.

## Follow-up UI remediation

A second visual review identified additional Weblium components that depended on removed runtime code:

| Finding | Resolution |
| --- | --- |
| The How it works block showed only a blurred low-quality placeholder | The YouTube URL is now read from the preserved component configuration and rendered as a privacy-enhanced embedded player. |
| Contact Information, Contacts Exchange, and Meetings Scheduler did not switch | Native tab behavior, active/hidden states, keyboard navigation, and accessibility roles were restored. |
| PARIMATCH, SPROOGEEK, and REVIZION images were covered by the card background | The media layer in reversed Use Cases cards now renders above the background layer. |
| Current-page Help Center links reloaded because trailing slashes differed | Same-page paths are normalized; section links scroll without reload and the current Help Center link returns to the page top. |

Local browser verification confirmed the YouTube player, all three How to Use panels, the three reversed Use Cases images, and reload-free Help Center navigation before publication.
