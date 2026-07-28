"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import Link from "next/link";

const SEEN_KEY = "mr:changelog:lastSeen";

/**
 * The seen-key lives in localStorage, which is external mutable state. Reading
 * it through `useSyncExternalStore` rather than an effect means dismissing the
 * modal never has to call setState from inside an effect, and other tabs stay
 * in sync for free.
 *
 * The snapshot has three states, so no sentinel string is needed:
 *   `undefined` — don't show at all (server render, or storage unavailable)
 *   `null`      — storage readable, nothing acknowledged yet
 *   `string`    — the entry key this browser last acknowledged
 */
type Seen = string | null | undefined;

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === SEEN_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): Seen {
  try {
    return window.localStorage.getItem(SEEN_KEY);
  } catch {
    return undefined; // private mode / storage disabled — just don't nag
  }
}

/** Nothing renders during SSR; the client re-reads once hydrated. */
function getServerSnapshot(): Seen {
  return undefined;
}

function markSeenKey(latestKey: string) {
  try {
    window.localStorage.setItem(SEEN_KEY, latestKey);
  } catch {
    /* ignore — the modal closes either way, it just reappears next visit */
  }
  for (const notify of listeners) notify();
}

/**
 * Post-login "what's new" notice. When the newest changelog entry differs from
 * the one this browser last acknowledged, a modal pops up with a few highlights
 * and a link to the full changelog. Seen-state is per-device (localStorage), so
 * there's no account/database dependency. Dismissing (any path) marks it seen.
 */
export function WhatsNewModal({
  latestKey,
  title,
  items,
  moreCount,
}: {
  /** Stable id of the newest entry (its date, usually). */
  latestKey: string;
  /** Heading shown in the modal (the entry's date/title). */
  title: string;
  /** A few highlight bullets. */
  items: string[];
  /** How many additional bullets exist beyond `items`. */
  moreCount: number;
}) {
  const seen = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const open = seen !== undefined && seen !== latestKey;

  const dismiss = useCallback(() => markSeenKey(latestKey), [latestKey]);

  // Close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="whats-new-title"
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
              What&apos;s new
            </p>
            <h2 id="whats-new-title" className="mt-0.5 text-lg font-semibold text-gray-900">
              {title}
            </h2>
          </div>
          <button
            onClick={dismiss}
            aria-label="Close"
            className="-mr-1 -mt-1 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-gray-700 marker:text-gray-400">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
        {moreCount > 0 && (
          <p className="mt-2 text-sm text-gray-500">
            …and {moreCount} more {moreCount === 1 ? "change" : "changes"}.
          </p>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={dismiss}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Got it
          </button>
          <Link
            href="/changelog"
            onClick={dismiss}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            See what changed
          </Link>
        </div>
      </div>
    </div>
  );
}
