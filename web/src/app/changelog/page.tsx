import Link from "next/link";
import { changelogEntries } from "@/lib/changelog";
import { entryItems } from "@/lib/changelog/parse";

export const metadata = {
  title: "What's new — Module Repository",
  description: "Recent changes and updates to the Module Repository.",
};

export default function ChangelogPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">What&apos;s new</h1>
        <Link
          href="/dashboard"
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to dashboard
        </Link>
      </div>
      <p className="mt-2 text-gray-600">
        Recent changes to the Module Repository, newest first.
      </p>

      {changelogEntries.length === 0 ? (
        <p className="mt-8 text-gray-500">No changes recorded yet.</p>
      ) : (
        <ol className="mt-8 space-y-8">
          {changelogEntries.map((entry, i) => (
            <li key={`${entry.title}-${i}`} className="border-l-2 border-blue-100 pl-4">
              <div className="flex items-baseline gap-3">
                <h2 className="text-lg font-semibold text-gray-900">
                  {entry.date ?? entry.title}
                </h2>
                {entry.date && entry.title !== entry.date && (
                  <span className="text-sm text-gray-500">{entry.title}</span>
                )}
              </div>
              {entry.sections.map((section, si) => (
                <div key={si} className="mt-3">
                  {section.heading && (
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {section.heading}
                    </h3>
                  )}
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-700 marker:text-gray-400">
                    {section.items.map((item, ii) => (
                      <li key={ii}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
              {/* Fallback if an entry somehow has no sections but has items */}
              {entry.sections.length === 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
                  {entryItems(entry).map((item, ii) => (
                    <li key={ii}>{item}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
