/**
 * Changelog parser — turns the Module Repository CHANGELOG.md (Keep a Changelog
 * style, date-headed) into structured entries the UI can render without a
 * markdown dependency. Pure (no fs/DOM) so it's easy to reason about.
 *
 * Handles these heading styles:
 *   ## 2026-07-14
 *   ## [Unreleased] — 2026-06-28
 *   ## 2026-06-10 — Initial release (M1–M4)
 * and bullets grouped under `### Added` / `### Changed` / `### Database` / etc.
 */
export interface ChangelogSection {
  /** e.g. "Added", "Changed", or null for ungrouped bullets. */
  heading: string | null;
  items: string[];
}

export interface ChangelogEntry {
  /** Heading text with the date stripped (e.g. "Initial release", "Unreleased"),
   * or the date itself when the heading is just a date. */
  title: string;
  date: string | null;
  sections: ChangelogSection[];
}

/** A stable id for an entry, used to tell whether a reader has seen it. */
export function entryKey(e: ChangelogEntry): string {
  return e.date ?? e.title;
}

/** Reduce inline markdown (links, bold, code) to plain text for rendering. */
function cleanItem(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [label](url) -> label
    .replace(/\*\*([^*]+)\*\*/g, "$1") // **bold** -> bold
    .replace(/`([^`]+)`/g, "$1") // `code` -> code
    .replace(/\s{2,}/g, " ")
    .trim();
}

function parseHeading(raw: string): { title: string; date: string | null } {
  const rest = raw.trim();
  const date = rest.match(/(\d{4}-\d{2}-\d{2})/);
  const title = rest
    .replace(/\(?\d{4}-\d{2}-\d{2}\)?/, "") // drop the date
    .replace(/^[[]|[\]]/g, "") // drop [ ] brackets around "Unreleased"
    .replace(/^[\s—–-]+|[\s—–-]+$/g, "") // trim separators (—, –, -) + space
    .trim();
  return { title: title || (date ? date[1] : rest), date: date ? date[1] : null };
}

export function parseChangelog(markdown: string): ChangelogEntry[] {
  const lines = markdown.split(/\r?\n/);
  const entries: ChangelogEntry[] = [];
  let entry: ChangelogEntry | null = null;
  let currentHeading: string | null = null;

  const pushItem = (text: string) => {
    if (!entry) return;
    let section = entry.sections[entry.sections.length - 1];
    if (!section || section.heading !== currentHeading) {
      section = { heading: currentHeading, items: [] };
      entry.sections.push(section);
    }
    section.items.push(text);
  };

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      const { title, date } = parseHeading(h2[1]);
      entry = { title, date, sections: [] };
      currentHeading = null;
      entries.push(entry);
      continue;
    }
    if (!entry) continue; // skip the file preamble

    const h3 = line.match(/^###\s+(.+?)\s*$/);
    if (h3) {
      currentHeading = h3[1].trim();
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      const text = cleanItem(bullet[1]);
      if (text) pushItem(text);
    }
  }

  // Drop entries with no bullets (an empty heading isn't worth showing).
  return entries.filter((e) => e.sections.some((s) => s.items.length > 0));
}

/** Flatten an entry's bullets into a single list (for a compact preview). */
export function entryItems(e: ChangelogEntry): string[] {
  return e.sections.flatMap((s) => s.items);
}
