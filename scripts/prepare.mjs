import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(SCRIPT_DIR, "..");
const SITE_DIR = path.join(PROJECT_DIR, "site");
const SOURCE_DIR = path.join(PROJECT_DIR, "src");
const ASSET_DIR = path.join(SITE_DIR, "assets");

async function listHtmlFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listHtmlFiles(target)));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(target);
  }
  return files;
}

async function listFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(target)));
    else if (entry.isFile()) files.push(target);
  }
  return files;
}

async function buildAssetIndex() {
  const vendorRoot = path.join(ASSET_DIR, "vendor", "res2.weblium.site");
  const index = {};
  for (const file of await listFiles(vendorRoot)) {
    const relative = path.relative(vendorRoot, file).split(path.sep).join("/");
    const extension = path.extname(relative);
    if (!/\.(?:gif|jpe?g|png|svg|webp)$/i.test(extension)) continue;
    const withoutExtension = relative.slice(0, -extension.length);
    const resourceRef = withoutExtension.replace(/_optimized(?:_\d+)?$/i, "");
    index[resourceRef] ||= `/assets/vendor/res2.weblium.site/${relative}`;
  }
  await writeFile(
    path.join(ASSET_DIR, "asset-index.js"),
    `window.__CAERSIDI_ASSET_INDEX__=${JSON.stringify(index)};\n`,
    "utf8",
  );
}

function removeWebliumScripts(html) {
  return html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (full, attributes) => {
    return /type\s*=\s*["']application\/ld\+json["']/i.test(attributes) ? full : "";
  });
}

function fixLegacyMarkup(html, file) {
  const relative = path.relative(SITE_DIR, file).split(path.sep);
  const language = relative[0] === "ua" ? "uk" : relative[0] === "ru" ? "ru" : "en";
  return html
    .replace(/<html\b([^>]*?)\blang=["'][^"']*["']/i, `<html$1lang="${language}"`)
    .replaceAll("mailto:ten.idisreac%40troppus", "mailto:support@caersidi.net")
    .replaceAll("ten.idisreac%40troppus", "support@caersidi.net");
}

function injectMigrationAssets(html) {
  let result = html.replace(
    /\s*<link\b[^>]*href=["']\/assets\/migration\.css["'][^>]*>\s*/gi,
    "\n",
  );
  result = result.replace(
    /<\/head>/i,
    '  <link rel="stylesheet" href="/assets/migration.css" />\n</head>',
  );
  result = result.replace(
    /<\/body>/i,
    '  <script src="/assets/asset-index.js"></script>\n  <script defer src="/assets/migration.js"></script>\n</body>',
  );
  return result;
}

async function main() {
  await mkdir(ASSET_DIR, { recursive: true });
  await cp(path.join(SOURCE_DIR, "migration.css"), path.join(ASSET_DIR, "migration.css"));
  await cp(path.join(SOURCE_DIR, "migration.js"), path.join(ASSET_DIR, "migration.js"));
  await buildAssetIndex();

  const htmlFiles = await listHtmlFiles(SITE_DIR);
  for (const file of htmlFiles) {
    const html = await readFile(file, "utf8");
    const prepared = injectMigrationAssets(fixLegacyMarkup(removeWebliumScripts(html), file));
    await writeFile(file, prepared, "utf8");
  }
  for (const file of await listFiles(SITE_DIR)) {
    if (!file.endsWith(".js")) continue;
    if (file === path.join(ASSET_DIR, "asset-index.js")) continue;
    if (file === path.join(ASSET_DIR, "migration.js")) continue;
    await rm(file, { force: true });
  }
  console.log(`Prepared ${htmlFiles.length} HTML pages`);
}

await main();
