import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(SCRIPT_DIR, "..");
const OUTPUT_DIR = path.join(PROJECT_DIR, "site");
const SOURCE_DIR = path.join(PROJECT_DIR, "_source", "html");
const SITE_ORIGIN = "https://ecard.caersidi.net";

const ALLOWED_ASSET_HOSTS = new Set([
  "ecard.caersidi.net",
  "res2.weblium.site",
  "download.caersidi.net",
  "wl-apps.yourwebsite.life",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "img.youtube.com",
]);

const SKIP_PROTOCOLS = /^(?:data:|blob:|mailto:|tel:|javascript:|#)/i;
const PAGE_FALLBACKS = [
  "/",
  "/ua",
  "/ru",
  "/home/help-center",
  "/home/use-cases",
  "/home/privacy-policy",
  "/home/terms-of-use",
  "/home/refund-and-shipping-policy",
  "/shop/e-card-individual",
  "/shop/e-card-business",
  "/shop/e-card-enterprise",
  "/shop/e-card-integration",
];

const downloaded = new Map();
const failures = [];
const assetQueue = [];
const queuedAssets = new Set();
const pages = new Set();

function decodeXml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function extractSitemapUrls(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) =>
    decodeXml(match[1].trim()),
  );
}

function stripFragment(url) {
  const parsed = new URL(url);
  parsed.hash = "";
  return parsed.href;
}

function pageOutputPath(url) {
  const parsed = new URL(url);
  let pathname = decodeURIComponent(parsed.pathname);
  if (pathname.endsWith("/")) pathname = pathname.slice(0, -1);
  if (!pathname) return path.join(OUTPUT_DIR, "index.html");
  return path.join(OUTPUT_DIR, ...pathname.slice(1).split("/"), "index.html");
}

function sourceOutputPath(url) {
  const parsed = new URL(url);
  let pathname = decodeURIComponent(parsed.pathname);
  if (pathname.endsWith("/")) pathname = pathname.slice(0, -1);
  const stem = pathname ? pathname.slice(1).replaceAll("/", "__") : "index";
  return path.join(SOURCE_DIR, `${stem}.html`);
}

function safeSegment(value) {
  return value.replace(/[<>:"|?*\x00-\x1F]/g, "_");
}

function extensionForContentType(contentType) {
  const normalized = contentType.split(";", 1)[0].trim().toLowerCase();
  return {
    "font/otf": ".otf",
    "font/ttf": ".ttf",
    "font/woff": ".woff",
    "font/woff2": ".woff2",
    "image/gif": ".gif",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/svg+xml": ".svg",
    "image/webp": ".webp",
    "text/css": ".css",
    "text/javascript": ".js",
  }[normalized] || "";
}

function assetOutputPath(url, contentType = "") {
  const parsed = new URL(url);
  const decoded = decodeURIComponent(parsed.pathname);
  const segments = decoded.split("/").filter(Boolean).map(safeSegment);
  const extension = extensionForContentType(contentType);
  if (segments.length && !path.extname(segments.at(-1)) && extension) {
    segments[segments.length - 1] += extension;
  }
  if (parsed.hostname === "ecard.caersidi.net") {
    return path.join(OUTPUT_DIR, ...segments);
  }
  return path.join(
    OUTPUT_DIR,
    "assets",
    "vendor",
    safeSegment(parsed.hostname),
    ...segments,
  );
}

function publicUrlForTarget(target) {
  return `/${path.relative(OUTPUT_DIR, target).split(path.sep).join("/")}`;
}

function localPublicUrl(url) {
  const item = downloaded.get(url);
  if (item?.publicUrl) return item.publicUrl;
  const parsed = new URL(url);
  if (parsed.hostname === "ecard.caersidi.net") return parsed.pathname;
  return `/assets/vendor/${parsed.hostname}${parsed.pathname}`;
}

function absolutize(raw, baseUrl) {
  const value = raw.trim().replace(/^['"]|['"]$/g, "");
  if (!value || SKIP_PROTOCOLS.test(value)) return null;
  try {
    return stripFragment(new URL(value, baseUrl).href);
  } catch {
    return null;
  }
}

function extractReferences(text, baseUrl) {
  const refs = new Set();
  const attributePattern = /\b(?:src|href|poster|data-src|data-lazy-src)\s*=\s*["']([^"']+)["']/gi;
  const srcsetPattern = /\b(?:srcset|data-srcset)\s*=\s*["']([^"']+)["']/gi;
  const cssUrlPattern = /url\(\s*(["']?)([^"')]+)\1\s*\)/gi;
  const importPattern = /@import\s+(?:url\()?\s*["']([^"']+)["']/gi;
  const quotedAssetPattern = /["'](\/(?:components|site|common|editor\/static)\/[^"']+\.(?:js|css|woff2?|ttf|otf|png|jpe?g|gif|webp|svg))["']/gi;
  const absoluteUrlPattern = /https?:\/\/[^\s"'<>\\]+/gi;
  const protocolRelativeUrlPattern = /\/\/(?:res2\.weblium\.site|download\.caersidi\.net|wl-apps\.yourwebsite\.life|fonts\.googleapis\.com|fonts\.gstatic\.com|img\.youtube\.com)\/[^\s"'<>&\\]+/gi;

  for (const match of text.matchAll(attributePattern)) {
    const url = absolutize(match[1], baseUrl);
    if (url) refs.add(url);
  }
  for (const match of text.matchAll(srcsetPattern)) {
    for (const candidate of match[1].split(",")) {
      const raw = candidate.trim().split(/\s+/)[0];
      const url = absolutize(raw, baseUrl);
      if (url) refs.add(url);
    }
  }
  for (const match of text.matchAll(cssUrlPattern)) {
    const url = absolutize(match[2], baseUrl);
    if (url) refs.add(url);
  }
  for (const match of text.matchAll(importPattern)) {
    const url = absolutize(match[1], baseUrl);
    if (url) refs.add(url);
  }
  for (const match of text.matchAll(quotedAssetPattern)) {
    const url = absolutize(match[1], baseUrl);
    if (url) refs.add(url);
  }
  for (const match of text.matchAll(absoluteUrlPattern)) {
    const raw = match[0].replace(/[\])},;]+$/g, "");
    const url = absolutize(raw, baseUrl);
    if (url) refs.add(url);
  }
  for (const match of text.matchAll(protocolRelativeUrlPattern)) {
    const raw = match[0].replace(/[\])},;]+$/g, "");
    const url = absolutize(raw, baseUrl);
    if (url) refs.add(url);
  }
  return [...refs];
}

function queueAsset(url) {
  const parsed = new URL(url);
  if (!ALLOWED_ASSET_HOSTS.has(parsed.hostname)) return;
  if (queuedAssets.has(url)) return;
  queuedAssets.add(url);
  assetQueue.push(url);
}

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; CaerSidiMigration/1.0)",
      accept: "text/html,application/xhtml+xml,application/xml,text/css,*/*;q=0.8",
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return { text: await response.text(), response };
}

async function discoverPages() {
  const sitemapQueue = [`${SITE_ORIGIN}/sitemap.xml`];
  const seenSitemaps = new Set();

  while (sitemapQueue.length) {
    const sitemapUrl = sitemapQueue.shift();
    if (seenSitemaps.has(sitemapUrl)) continue;
    seenSitemaps.add(sitemapUrl);
    try {
      const { text } = await fetchText(sitemapUrl);
      for (const url of extractSitemapUrls(text)) {
        if (url.endsWith(".xml")) sitemapQueue.push(url);
        else if (new URL(url).hostname === "ecard.caersidi.net") pages.add(stripFragment(url));
      }
    } catch (error) {
      failures.push({ url: sitemapUrl, reason: String(error) });
    }
  }

  for (const pathname of PAGE_FALLBACKS) pages.add(`${SITE_ORIGIN}${pathname}`);
}

async function downloadPage(url) {
  try {
    const { text, response } = await fetchText(url);
    const finalUrl = response.url || url;
    await mkdir(path.dirname(sourceOutputPath(url)), { recursive: true });
    await writeFile(sourceOutputPath(url), text, "utf8");
    downloaded.set(url, { type: "page", text, finalUrl });

    for (const ref of extractReferences(text, finalUrl)) {
      const parsed = new URL(ref);
      if (!ALLOWED_ASSET_HOSTS.has(parsed.hostname)) continue;
      if (parsed.hostname === "ecard.caersidi.net" && pages.has(ref)) continue;
      queueAsset(ref);
    }
  } catch (error) {
    failures.push({ url, reason: String(error) });
  }
}

async function downloadAsset(url) {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; CaerSidiMigration/1.0)" },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "";
    if (/text\/html/i.test(contentType)) {
      return;
    }
    const target = assetOutputPath(url, contentType);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
    downloaded.set(url, {
      type: "asset",
      target,
      publicUrl: publicUrlForTarget(target),
      contentType,
      finalUrl: response.url || url,
    });

    if (/text\/css/i.test(contentType) || target.endsWith(".css")) {
      const css = bytes.toString("utf8");
      for (const ref of extractReferences(css, response.url || url)) queueAsset(ref);
    }
  } catch (error) {
    failures.push({ url, reason: String(error) });
  }
}

async function runPool(items, worker, concurrency = 8) {
  let cursor = 0;
  async function next() {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => next()));
}

function rewriteText(text) {
  const replacements = [...downloaded.entries()]
    .filter(([, item]) => item.type === "asset")
    .map(([url]) => [url, localPublicUrl(url)])
    .sort((a, b) => b[0].length - a[0].length);

  let result = text;
  for (const [remote, local] of replacements) {
    const parsed = new URL(remote);
    const protocolRelative = `//${parsed.host}${parsed.pathname}${parsed.search}`;
    result = result.replaceAll(remote.replaceAll("&", "&amp;"), local.replaceAll("&", "&amp;"));
    result = result.replaceAll(remote, local);
    result = result.replaceAll(protocolRelative.replaceAll("&", "&amp;"), local.replaceAll("&", "&amp;"));
    result = result.replaceAll(protocolRelative, local);
  }
  result = result.replaceAll(`${SITE_ORIGIN}/`, "/");
  result = result.replaceAll(SITE_ORIGIN, "/");
  return result;
}

async function writeRewrittenPages() {
  for (const [url, item] of downloaded.entries()) {
    if (item.type !== "page") continue;
    const target = pageOutputPath(url);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, rewriteText(item.text), "utf8");
  }
}

async function rewriteCssFiles() {
  for (const [, item] of downloaded.entries()) {
    if (item.type !== "asset" || !/text\/css/i.test(item.contentType)) continue;
    const css = await readFile(item.target, "utf8");
    await writeFile(item.target, rewriteText(css), "utf8");
  }
}

async function main() {
  if (!OUTPUT_DIR.startsWith(`${PROJECT_DIR}${path.sep}`)) {
    throw new Error(`Refusing to clear unsafe output directory: ${OUTPUT_DIR}`);
  }
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(SOURCE_DIR, { recursive: true });
  await discoverPages();
  console.log(`Discovered ${pages.size} pages`);
  await runPool([...pages], downloadPage, 5);
  console.log(`Queued ${assetQueue.length} initial assets`);

  let cursor = 0;
  while (cursor < assetQueue.length) {
    const batch = assetQueue.slice(cursor, cursor + 40);
    cursor += batch.length;
    await runPool(batch, downloadAsset, 8);
    console.log(`Assets ${cursor}/${assetQueue.length}`);
  }

  await writeRewrittenPages();
  await rewriteCssFiles();
  await writeFile(
    path.join(PROJECT_DIR, "_source", "mirror-report.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        pages: [...pages],
        downloaded: [...downloaded.keys()],
        failures,
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`Done: ${downloaded.size} downloads, ${failures.length} failures`);
}

await main();
