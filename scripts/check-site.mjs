import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteDir = path.join(projectDir, "site");
const baseUrl = new URL("https://static.caersidi.test/");
const productionOrigin = "https://ecard.caersidi.net";

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? walk(target) : [target];
    }),
  );
  return nested.flat();
};

const exists = async (target) => {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
};

const localTarget = async (rawReference, sourceFile) => {
  const reference = rawReference
    .replaceAll("&#x2F;", "/")
    .replaceAll("&#47;", "/")
    .replaceAll("&amp;", "&")
    .trim();
  if (
    !reference ||
    reference.startsWith("#") ||
    /^(?:data|mailto|tel|javascript):/i.test(reference) ||
    reference.startsWith("//")
  ) {
    return null;
  }

  const sourceUrl = new URL(path.relative(siteDir, sourceFile).replaceAll(path.sep, "/"), baseUrl);
  const resolved = new URL(reference, sourceUrl);
  if (resolved.origin !== baseUrl.origin) return null;

  const decodedPath = decodeURIComponent(resolved.pathname).replace(/^\/+/, "");
  const directTarget = path.resolve(siteDir, decodedPath);
  if (!directTarget.startsWith(siteDir + path.sep) && directTarget !== siteDir) {
    return `unsafe path: ${reference}`;
  }
  if (await exists(directTarget)) return null;
  if (await exists(path.join(directTarget, "index.html"))) return null;
  return reference;
};

const files = await walk(siteDir);
const sourceFiles = files.filter((file) => /\.(?:html|css)$/i.test(file));
const failures = [];
const htmlCache = new Map();

const pageUrl = (file) => {
  const relative = path.relative(siteDir, file).split(path.sep).join("/");
  const route = relative === "index.html" ? "/" : `/${relative.replace(/\/index\.html$/, "")}`;
  return `${productionOrigin}${route}`;
};

const tagAttribute = (tag, name) => {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])([^"']*)\\1`, "i"));
  return match?.[2] || "";
};

for (const sourceFile of sourceFiles) {
  const contents = await readFile(sourceFile, "utf8");
  if (contents.includes("ecard.forumkyiv.org")) {
    failures.push(`${path.relative(projectDir, sourceFile)} -> stale Kyiv Forum domain`);
  }
  const referenceSource =
    sourceFile.endsWith(".html") && contents.includes("data-caersidi-base")
      ? path.join(siteDir, "index.html")
      : sourceFile;
  const references = [];

  if (sourceFile.endsWith(".html")) {
    for (const match of contents.matchAll(
      /\b(?:href|src|data-src|data-fallback-url)=["']([^"']+)["']/gi,
    )) {
      references.push(match[1]);
    }
    for (const match of contents.matchAll(/\b(?:srcset|data-srcset)=["']([^"']+)["']/gi)) {
      references.push(...match[1].split(",").map((candidate) => candidate.trim().split(/\s+/)[0]));
    }
  } else {
    for (const match of contents.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
      references.push(match[1]);
    }
  }

  for (const reference of new Set(references)) {
    const missing = await localTarget(reference, referenceSource);
    if (missing) failures.push(`${path.relative(projectDir, sourceFile)} -> ${missing}`);
  }

  if (sourceFile.endsWith(".html")) {
    const expectedPageUrl = pageUrl(sourceFile);
    const canonicalTag = [...contents.matchAll(/<link\b[^>]*>/gi)]
      .map((match) => match[0])
      .find((tag) => tagAttribute(tag, "rel").toLowerCase() === "canonical");
    const openGraphUrlTag = [...contents.matchAll(/<meta\b[^>]*>/gi)]
      .map((match) => match[0])
      .find((tag) => tagAttribute(tag, "property").toLowerCase() === "og:url");
    if (tagAttribute(canonicalTag || "", "href") !== expectedPageUrl) {
      failures.push(`${path.relative(projectDir, sourceFile)} -> invalid canonical URL`);
    }
    if (tagAttribute(openGraphUrlTag || "", "content") !== expectedPageUrl) {
      failures.push(`${path.relative(projectDir, sourceFile)} -> invalid og:url`);
    }

    const hashReferences = [...contents.matchAll(/\bhref=["']([^"']+#[^"']*)["']/gi)].map(
      (match) => match[1],
    );
    for (const reference of new Set(hashReferences)) {
      const resolved = new URL(reference, baseUrl);
      if (resolved.origin !== baseUrl.origin || !resolved.hash || resolved.hash === "#") continue;
      const decodedPath = decodeURIComponent(resolved.pathname).replace(/^\/+/, "");
      const directTarget = path.resolve(siteDir, decodedPath);
      const targetFile = directTarget.endsWith(".html")
        ? directTarget
        : path.join(directTarget, "index.html");
      if (!(await exists(targetFile))) continue;
      if (!htmlCache.has(targetFile)) htmlCache.set(targetFile, await readFile(targetFile, "utf8"));
      const targetHtml = htmlCache.get(targetFile);
      const anchor = decodeURIComponent(resolved.hash.slice(1));
      const hasTarget =
        targetHtml.includes(`id="${anchor}"`) ||
        targetHtml.includes(`id='${anchor}'`) ||
        targetHtml.includes(`data-anchor="${anchor}"`) ||
        targetHtml.includes(`data-anchor='${anchor}'`);
      if (!hasTarget) {
        failures.push(`${path.relative(projectDir, sourceFile)} -> missing anchor ${reference}`);
      }
    }
  }
}

const robotsFile = path.join(siteDir, "robots.txt");
const sitemapFile = path.join(siteDir, "sitemap.xml");
if (!(await exists(robotsFile))) failures.push("site/robots.txt -> missing");
if (!(await exists(sitemapFile))) failures.push("site/sitemap.xml -> missing");
if (await exists(robotsFile)) {
  const robots = await readFile(robotsFile, "utf8");
  if (!robots.includes(`Sitemap: ${productionOrigin}/sitemap.xml`)) {
    failures.push("site/robots.txt -> missing production sitemap URL");
  }
}
if (await exists(sitemapFile)) {
  const sitemap = await readFile(sitemapFile, "utf8");
  for (const htmlFile of sourceFiles.filter((file) => file.endsWith(".html"))) {
    const url = pageUrl(htmlFile);
    if (!sitemap.includes(`<loc>${url}</loc>`)) {
      failures.push(`site/sitemap.xml -> missing ${url}`);
    }
  }
}

if (failures.length) {
  console.error(`Found ${failures.length} missing local reference(s):`);
  failures.slice(0, 50).forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(
    `Checked ${sourceFiles.length} HTML/CSS files: local references and SEO metadata are valid.`,
  );
}
