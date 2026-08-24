import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteDir = path.join(projectDir, "site");
const baseUrl = new URL("https://static.caersidi.test/");

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

for (const sourceFile of sourceFiles) {
  const contents = await readFile(sourceFile, "utf8");
  const references = [];

  if (sourceFile.endsWith(".html")) {
    for (const match of contents.matchAll(/\b(?:href|src|data-src)=["']([^"']+)["']/gi)) {
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
    const missing = await localTarget(reference, sourceFile);
    if (missing) failures.push(`${path.relative(projectDir, sourceFile)} -> ${missing}`);
  }
}

if (failures.length) {
  console.error(`Found ${failures.length} missing local reference(s):`);
  failures.slice(0, 50).forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Checked ${sourceFiles.length} HTML/CSS files: all local references resolve.`);
}
