/**
 * The parsed Module Repository changelog — the single source both the /changelog
 * page and the post-login "what's new" notice read from. Server-only: the
 * markdown is read from disk (bundled on Vercel via outputFileTracingIncludes).
 */
import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseChangelog, entryKey, type ChangelogEntry } from "./parse";

function loadMarkdown(): string {
  // process.cwd() is the web app root in dev and on Vercel; fall back to the
  // app root itself just in case.
  for (const p of [
    join(process.cwd(), "src/content/CHANGELOG.md"),
    join(process.cwd(), "CHANGELOG.md"),
  ]) {
    try {
      return readFileSync(p, "utf8");
    } catch {
      /* try the next candidate */
    }
  }
  return "";
}

export const changelogEntries: ChangelogEntry[] = parseChangelog(loadMarkdown());
export const latestEntry: ChangelogEntry | null = changelogEntries[0] ?? null;

/** Stable id of the newest entry — compared against what a reader has seen. */
export const latestChangelogKey: string | null = latestEntry
  ? entryKey(latestEntry)
  : null;

export { entryKey };
export type { ChangelogEntry };
