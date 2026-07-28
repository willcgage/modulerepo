"use client";

/**
 * The offer to rebuild a module's track as pieces (ADR 0001 amendment, MR #199).
 *
 * ⭐ **OFFERED PER MODULE, NEVER RUN SILENTLY.** Will's call, 2026-07-27. The
 * original ADR forbade auto-migration because converting supplies geometry the
 * 1-D document never recorded; done in front of the owner, with the cost shown
 * and their answer taken, it is an edit they made — and one Undo puts back.
 *
 * ⭐⭐ **ONE QUESTION FOR THE WHOLE MODULE.** Owners lay one kind of turnout
 * throughout, or at most two. Asking per turnout asks the same question eight
 * times on a yard, and across the production database it would be 41 questions
 * instead of 14. So the module-wide answer IS the question and the per-turnout
 * list is the exception, folded away until it is wanted.
 */

import { useMemo, useState } from "react";
import {
  docToGraph,
  moduleConversionReport,
  partGeometryGap,
  type ConversionAnswers,
  type ModuleSchematicDoc,
  type TrackPart,
} from "@/lib/module-schematic";

const SAME = "";

/** Parts that can answer "which turnout is this?" — PLACEABLE ones only.
 * Offering a part we cannot draw would be an answer that does not answer. */
function answerableParts(library: TrackPart[]): TrackPart[] {
  return library
    .filter((p) => (p.kind === "turnout" || p.kind === "wye") && partGeometryGap(p) == null)
    .sort((a, b) =>
      (a.manufacturer ?? "").localeCompare(b.manufacturer ?? "") ||
      (a.frogNumber ?? 0) - (b.frogNumber ?? 0),
    );
}

const labelOf = (p: TrackPart) =>
  `${p.manufacturer ?? ""} ${p.line ?? ""} #${p.frogNumber}${p.kind === "wye" ? " wye" : ""}`.trim();

export function RebuildAsPieces({
  doc,
  library,
  readOnly,
  onRebuild,
}: {
  doc: ModuleSchematicDoc;
  library: TrackPart[];
  readOnly?: boolean;
  /** Apply it. The caller owns the undo snapshot and the save. */
  onRebuild: (answers: ConversionAnswers) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showEach, setShowEach] = useState(false);
  const [moduleWide, setModuleWide] = useState<string>(SAME);
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const report = useMemo(() => moduleConversionReport(doc, library), [doc, library]);
  const options = useMemo(() => answerableParts(library), [library]);
  /** An owner knows "yard 1", not "mt16" — name a loss the way they named it. */
  const nameOf = (id: string) =>
    doc.tracks?.find((t) => t.id === id)?.trackName || id;

  const answers: ConversionAnswers = useMemo(
    () => ({
      turnoutPartId: moduleWide || null,
      overrides: Object.fromEntries(Object.entries(overrides).filter(([, v]) => v)),
    }),
    [moduleWide, overrides],
  );

  // ⭐ THE PREVIEW IS THE CONVERSION ITSELF, run on the current answers — not a
  // description of it. What it reports is exactly what pressing the button does.
  const preview = useMemo(
    () => (open ? docToGraph(doc, answers, library) : null),
    [open, doc, answers, library],
  );

  if (report.alreadyGraph) return null;

  // ⚠️ A BLOCKER IS NOT A QUESTION — no answer supplies a shape the model cannot
  // express, so say so plainly instead of offering something that cannot finish.
  if (!report.offerable)
    return (
      <span className="text-xs text-gray-500">
        This module can&rsquo;t be rebuilt as pieces yet — {report.blockers[0]?.why}.
      </span>
    );

  const asked = report.unanswered.length;

  if (!open)
    return (
      <button
        type="button"
        disabled={readOnly}
        onClick={() => setOpen(true)}
        className="rounded border border-teal-600 px-2 py-0.5 text-xs font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-50"
      >
        Rebuild this module&rsquo;s track as pieces…
      </button>
    );

  return (
    <div className="w-full rounded border border-teal-300 bg-teal-50/60 p-3 text-xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-teal-900">Rebuild this module&rsquo;s track as pieces</p>
          <p className="mt-0.5 text-gray-600">
            The mainline, sidings and spurs become real parts you can move, and the
            module keeps the same drawing. Nothing else on the module changes, and
            Undo puts it back.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="shrink-0 text-gray-400 hover:text-gray-700"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* ⚠️ THE DOCUMENT USUALLY DOES NOT SAY WHAT THE TURNOUTS ARE. Across the
          production database not one turnout names a part and most give no frog
          number either, so this is the question — and no measurement of ours can
          answer it. Only the owner knows what they laid. */}
      {asked > 0 && (
        <label className="mt-3 block font-medium text-gray-700">
          The turnouts on this module are
          <select
            value={moduleWide}
            onChange={(e) => setModuleWide(e.target.value)}
            className="mt-0.5 block w-full rounded border border-gray-300 px-2 py-1 text-xs"
          >
            <option value={SAME}>Choose a turnout…</option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {labelOf(p)}
              </option>
            ))}
          </select>
          <span className="mt-0.5 block font-normal text-gray-500">
            {asked === report.turnouts.length
              ? `The document doesn't say, for any of its ${asked} turnout${asked === 1 ? "" : "s"}.`
              : `${asked} of ${report.turnouts.length} need this; the rest already name a part.`}
          </span>
        </label>
      )}

      {report.turnouts.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowEach((v) => !v)}
            className="text-teal-700 underline decoration-dotted"
          >
            {showEach ? "Hide" : "One of them is different…"}
          </button>
          {showEach && (
            <div className="mt-1 space-y-1">
              {report.turnouts.map((t) => (
                <div key={t.id} className="flex items-center gap-2">
                  <span className="w-40 shrink-0 truncate text-gray-600" title={t.why ?? ""}>
                    {t.name || t.id} <span className="text-gray-400">· {t.pos}&Prime;</span>
                  </span>
                  <select
                    value={overrides[t.id] ?? SAME}
                    onChange={(e) =>
                      setOverrides((o) => ({ ...o, [t.id]: e.target.value }))
                    }
                    className="min-w-0 flex-1 rounded border border-gray-300 px-1.5 py-0.5 text-xs"
                  >
                    <option value={SAME}>
                      {t.partId ? `${labelOf(library.find((p) => p.id === t.partId)!)} (from the document)` : "Same as the module"}
                    </option>
                    {options.map((p) => (
                      <option key={p.id} value={p.id}>
                        {labelOf(p)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* What it will actually do — computed by running the conversion, so the
          preview cannot drift from the result. */}
      <div className="mt-3 border-t border-teal-200 pt-2">
        {preview?.refused ? (
          <p className="text-gray-600">{preview.refused}.</p>
        ) : (
          <>
            <p className="text-gray-700">
              <span className="font-medium">
                {preview?.graph?.pieces.length ?? 0} pieces
              </span>
              {report.turnouts.length === 0
                ? " — the mainline, cut into lengths of flex."
                : ` — the mainline cut into flex, ${report.turnouts.length} turnout${
                    report.turnouts.length === 1 ? "" : "s"
                  }, and the track they open.`}
            </p>
            {/* ⚠️ A LOSS THE OWNER MUST SEE. Unshown, a "successful" rebuild
                would quietly be missing a named siding. Named the way THEY named
                it — an owner knows "yard 1", not "mt16". */}
            {!!preview?.notLaid.length && (
              <div className="mt-1 rounded border border-amber-300 bg-amber-50 p-1.5">
                <p className="font-medium text-amber-800">
                  {`${preview.notLaid.length} track${
                    preview.notLaid.length === 1 ? "" : "s"
                  } can’t be laid:`}
                </p>
                <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-amber-900">
                  {preview.notLaid.map((n) => (
                    <li key={n.id}>
                      <span className="font-medium">{nameOf(n.id)}</span>
                      {` — ${n.why}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {preview?.warnings.map((w) => (
              <p key={w} className="mt-1 text-amber-700">
                {w}
              </p>
            ))}
          </>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={readOnly || !!preview?.refused || !preview?.graph}
          onClick={() => {
            onRebuild(answers);
            setOpen(false);
          }}
          className="rounded bg-teal-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          Rebuild as pieces
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
