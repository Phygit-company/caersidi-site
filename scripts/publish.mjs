import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const safeDirectory = projectDir.replaceAll(path.sep, "/");

const git = (...args) =>
  execFileSync("git", ["-c", `safe.directory=${safeDirectory}`, ...args], {
    cwd: projectDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();

const siteStatus = git("status", "--porcelain", "--", "site");
if (siteStatus) {
  throw new Error("Commit the prepared site/ changes on main before publishing.");
}

git("fetch", "origin", "gh-pages");
const siteTree = git("rev-parse", "HEAD:site");
const currentDeployment = git("rev-parse", "refs/remotes/origin/gh-pages");
const deploymentCommit = git(
  "commit-tree",
  siteTree,
  "-p",
  currentDeployment,
  "-m",
  "Publish Caer-Sidi static site",
);

git("push", "origin", `${deploymentCommit}:refs/heads/gh-pages`);
console.log(`Published ${deploymentCommit.slice(0, 7)} to gh-pages.`);
