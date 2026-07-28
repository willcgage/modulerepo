/**
 * Every released version needs an entry owners can read.
 *
 * The changelog is not developer bookkeeping here — the post-login "What's new"
 * notice draws its bullets from the newest entry, so a version without one ships
 * silently. That happened for fifteen versions (v0.38.1 → v0.47.1) and only
 * surfaced by accident, which is what this check exists to prevent.
 *
 * Fails when web/package.json's version has no `## vX.Y.Z — YYYY-MM-DD` heading,
 * or when that heading exists but carries no bullets (the changelog parser drops
 * bullet-less entries, so an empty one is invisible to owners anyway).
 *
 * Run locally with:  node .github/scripts/check-changelog.mjs
 */
import { readFileSync } from "node:fs";

const PKG = "web/package.json";
const CHANGELOG = "web/src/content/CHANGELOG.md";

/** GitHub Actions annotation when running in CI, plain text otherwise. */
const inCI = Boolean(process.env.GITHUB_ACTIONS);
function fail(message, { line } = {}) {
  if (inCI) {
    const where = line ? `file=${CHANGELOG},line=${line}` : `file=${CHANGELOG}`;
    console.log(`::error ${where},title=Changelog::${message.replace(/\n/g, "%0A")}`);
  }
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

let version;
try {
  version = JSON.parse(readFileSync(PKG, "utf8")).version;
} catch (err) {
  fail(`Could not read a version from ${PKG}: ${err.message}`);
}
if (!version) fail(`${PKG} has no "version" field.`);

let md;
try {
  md = readFileSync(CHANGELOG, "utf8");
} catch (err) {
  fail(`Could not read ${CHANGELOG}: ${err.message}`);
}

const lines = md.split(/\r?\n/);
const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const headingRe = new RegExp(`^## v${escaped} — \\d{4}-\\d{2}-\\d{2}$`);
const index = lines.findIndex((l) => headingRe.test(l));

if (index === -1) {
  // A near-miss is the common case: right version, wrong dash or date format.
  const looseRe = new RegExp(`^##\\s*v?${escaped}\\b`);
  const near = lines.findIndex((l) => looseRe.test(l));
  if (near !== -1) {
    fail(
      `${CHANGELOG} line ${near + 1} mentions v${version} but the heading is not in the required form.\n` +
        `Found:    ${lines[near]}\n` +
        `Expected: ## v${version} — YYYY-MM-DD   (an em dash "—", not a hyphen)`,
      { line: near + 1 },
    );
  }
  fail(
    `${PKG} is v${version}, but ${CHANGELOG} has no entry for it.\n` +
      `Add one at the top, newest first:\n\n` +
      `    ## v${version} — YYYY-MM-DD\n\n` +
      `    ### Added\n` +
      `    - **What changed, in a sentence an owner would recognise.** Why it changed,\n` +
      `      and what does NOT change about modules they already have.\n`,
  );
}

// An entry with no bullets is dropped by the changelog parser, so it would pass
// a heading-only check while still showing owners nothing.
let hasBullet = false;
for (let i = index + 1; i < lines.length; i++) {
  if (/^## /.test(lines[i])) break;
  if (/^\s*[-*]\s+\S/.test(lines[i])) {
    hasBullet = true;
    break;
  }
}
if (!hasBullet) {
  fail(
    `${CHANGELOG} has a heading for v${version} but no bullets under it.\n` +
      `The changelog parser drops entries without bullets, so owners would see nothing.`,
    { line: index + 1 },
  );
}

// The newest entry should be the version being shipped, or the "What's new"
// notice announces something other than what just went out. A warning, not a
// failure: an unreleased section on top is a legitimate way to work.
const firstHeading = lines.findIndex((l) => /^## /.test(l));
if (firstHeading !== -1 && firstHeading !== index) {
  const msg =
    `v${version} is not the newest entry in ${CHANGELOG} — "${lines[firstHeading].replace(/^##\s*/, "")}" is. ` +
    `The post-login notice shows the newest entry, so owners will be shown that one.`;
  if (inCI) console.log(`::warning file=${CHANGELOG},line=${firstHeading + 1},title=Changelog::${msg}`);
  console.warn(`\n⚠ ${msg}\n`);
}

console.log(`✓ v${version} has a changelog entry (${CHANGELOG} line ${index + 1})`);
