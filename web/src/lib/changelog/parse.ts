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

/**
 * A stable id for an entry, used to tell whether a reader has seen it. Keyed on
 * the entry's CONTENT, not just its date — so any revision (a new entry, or new
 * bullets added to today's entry) produces a new key and re-shows "What's new".
 * Two releases on the same day must not silently reuse the same key.
 */
export function entryKey(e: ChangelogEntry): string {
  const body = [
    e.date ?? "",
    e.title,
    ...e.sections.flatMap((s) => [s.heading ?? "", ...s.items]),
  ].join("");
  return `${e.date ?? e.title}#${fnv1a(body)}`;
}

/** Small stable content hash (FNV-1a → base36). */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Reduce inline markdown (links, bold, code) to plain text for rendering. */
function cleanItem(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [label](url) -> label
    .replace(/\*\*([^*]+)\*\*/g, "$1") // **bold** -> bold
    .replace(/\*([^*]+)\*/g, "$1") // *italic* -> italic (after bold)
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
  /** The section holding the bullet a wrapped line can continue onto. */
  let openSection: ChangelogSection | null = null;

  /** Append an item, returning the section it landed in (so the caller can keep
   * it open for wrapped continuation lines). */
  const pushItem = (text: string): ChangelogSection | null => {
    if (!entry) return null;
    let section = entry.sections[entry.sections.length - 1];
    if (!section || section.heading !== currentHeading) {
      section = { heading: currentHeading, items: [] };
      entry.sections.push(section);
    }
    section.items.push(text);
    return section;
  };

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      const { title, date } = parseHeading(h2[1]);
      entry = { title, date, sections: [] };
      currentHeading = null;
      openSection = null;
      entries.push(entry);
      continue;
    }
    if (!entry) continue; // skip the file preamble

    const h3 = line.match(/^###\s+(.+?)\s*$/);
    if (h3) {
      currentHeading = h3[1].trim();
      openSection = null;
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      const text = cleanItem(bullet[1]);
      if (text) openSection = pushItem(text);
      continue;
    }

    // A wrapped bullet: markdown hard-wraps long entries onto indented
    // continuation lines. Fold them back into the item — otherwise every
    // multi-line bullet reads as a sentence cut off mid-thought.
    if (
      openSection &&
      openSection.items.length > 0 &&
      /^\s+\S/.test(line) && // indented, non-empty
      !/^\s*(-{3,}|#{1,6}\s)/.test(line) // not a rule or heading
    ) {
      const cont = cleanItem(line.trim());
      if (cont) {
        openSection.items[openSection.items.length - 1] += ` ${cont}`;
        continue;
      }
    }

    // Anything else (notably a blank line) closes the open bullet.
    openSection = null;
  }

  // Drop entries with no bullets (an empty heading isn't worth showing).
  return entries.filter((e) => e.sections.some((s) => s.items.length > 0));
}

/** Flatten an entry's bullets into a single list (for a compact preview). */
export function entryItems(e: ChangelogEntry): string[] {
  return e.sections.flatMap((s) => s.items);
}
