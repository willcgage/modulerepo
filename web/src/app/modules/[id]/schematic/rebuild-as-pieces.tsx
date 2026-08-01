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
  type PlaceOnTrack,
  partGeometryGap,
  type ConversionAnswers,
  type ModuleSchematicDoc,
  type TrackPart,
} from "@/lib/module-schematic";

const SAME = "";

/** Real products that can answer "which turnout is this?" — PLACEABLE ones only,
 * and never a stand-in. Offering a part we cannot draw would be an answer that
 * does not answer; offering a placeholder here would let one be picked as though
 * it were a product. */
function answerableParts(library: TrackPart[]): TrackPart[] {
  return library
    .filter(
      (p) =>
        (p.kind === "turnout" || p.kind === "wye") &&
        !p.provisional &&
        partGeometryGap(p) == null,
    )
    .sort((a, b) =>
      (a.manufacturer ?? "").localeCompare(b.manufacturer ?? "") ||
      (a.frogNumber ?? 0) - (b.frogNumber ?? 0),
    );
}

/**
 * The stand-ins, offered SEPARATELY and second.
 *
 * ⭐ An owner who cannot say what they laid should not be stuck — 35 turnouts in
 * the database say nothing at all, and their owners may genuinely not know. But
 * a placeholder is a different KIND of answer from "Atlas #7", so it sits in its
 * own group, below, and says what it costs.
 */
function placeholderParts(library: TrackPart[]): TrackPart[] {
  return library
    .filter((p) => p.provisional && p.kind === "turnout")
    .sort((a, b) => (a.frogNumber ?? 0) - (b.frogNumber ?? 0));
}

const labelOf = (p: TrackPart) =>
  p.provisional
    ? `#${p.frogNumber} — make unknown`
    : `${p.manufacturer ?? ""} ${p.line ?? ""} #${p.frogNumber}${p.kind === "wye" ? " wye" : ""}`.trim();

export function RebuildAsPieces({
  doc,
  library,
  readOnly,
  onRebuild,
  placeAt = null,
}: {
  doc: ModuleSchematicDoc;
  library: TrackPart[];
  readOnly?: boolean;
  /** Apply it. The caller owns the undo snapshot and the save. */
  onRebuild: (answers: ConversionAnswers) => void;
  /** ⚠️ THE PREVIEW MUST BE GIVEN WHAT THE BUTTON IS GIVEN. This is the same
   * placer `onRebuild` uses; without it the preview runs a DIFFERENT
   * conversion from the one it is previewing, and on a module whose track
   * curves it refused ("would need each bend's radius") for a reason that no
   * longer applied to the actual rebuild. */
  placeAt?: PlaceOnTrack | null;
}) {
  const [open, setOpen] = useState(false);
  const [showEach, setShowEach] = useState(false);
  const [moduleWide, setModuleWide] = useState<string>(SAME);
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const report = useMemo(() => moduleConversionReport(doc, library), [doc, library]);
  const options = useMemo(() => answerableParts(library), [library]);
  const placeholders = useMemo(() => placeholderParts(library), [library]);
  const chosePlaceholder =
    !!moduleWide && placeholders.some((p) => p.id === moduleWide);
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
    () => (open ? docToGraph(doc, answers, library, placeAt) : null),
    [open, doc, answers, library, placeAt],
  );

  const asked = report.unanswered.length;

  /**
   * Why each unanswered turnout is unanswered, grouped.
   *
   * The two causes are genuinely different and an owner can act on the
   * difference: one is a fact only they hold, the other a measurement nobody
   * has taken yet — and a turnout in the second group may be described
   * perfectly well in their document.
   */
  const reasons = useMemo(() => {
    const unanswered = report.turnouts.filter((t) => !t.partId);
    const silent = unanswered.filter((t) => t.size == null).length;
    const unmeasured = unanswered.filter((t) => t.size != null);
    const sizes = [...new Set(unmeasured.map((t) => `#${t.size}`))].join(", ");
    return [
      silent && {
        text: `The document doesn't say what ${
          silent === unanswered.length ? (silent === 1 ? "it" : "any of them") : `${silent} of them`
        } ${silent === 1 ? "is" : "are"}.`,
      },
      unmeasured.length && {
        // ⚠️ Count AND coverage both bend the sentence: "1 are recorded as #6"
        // is what falls out of getting only one of them right.
        text: `${
          unmeasured.length === unanswered.length
            ? unmeasured.length === 1
              ? "It's"
              : "They're"
            : `${unmeasured.length} ${unmeasured.length === 1 ? "is" : "are"}`
        } recorded as ${sizes}, which nobody has measured yet — so tell us what you actually laid.`,
      },
    ].filter(Boolean) as { text: string }[];
  }, [report.turnouts]);

  if (report.alreadyGraph) return null;

  // ⚠️ A BLOCKER IS NOT A QUESTION — no answer supplies a shape the model cannot
  // express, so say so plainly instead of offering something that cannot finish.
  if (!report.offerable)
    return (
      <span className="text-xs text-gray-500">
        This module can&rsquo;t be rebuilt as pieces yet — {report.blockers[0]?.why}.
      </span>
    );

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
            {/* ⭐ SECOND, AND IN ITS OWN GROUP. A placeholder is a different kind
                of answer from "Atlas #7", and an owner who genuinely does not
                know should not be stuck — but it must not read as an equal. */}
            <optgroup label="I don't know what make they are">
              {placeholders.map((p) => (
                <option key={p.id} value={p.id}>
                  {labelOf(p)}
                </option>
              ))}
            </optgroup>
          </select>
          {/* ⭐ SAY WHAT A PLACEHOLDER COSTS, at the moment it is chosen. It is
              a real answer — the module converts and the track connects — but
              its shape is interpolated, and an owner who is not told that will
              reasonably read the drawing as a measurement of their turnout. */}
          {chosePlaceholder && (
            <span className="mt-1 block rounded border border-amber-300 bg-amber-50 p-1.5 font-normal text-amber-900">
              These will be drawn from the frog number alone — the right angle
              and roughly the right length, but not any particular product. The
              module converts and the track joins up; come back and name the real
              turnout whenever you find out, and the drawing sharpens.
            </span>
          )}
          {/* ⚠️ WHY IT IS BEING ASKED IS NOT ONE REASON. "The document never
              says what this is" needs the owner's knowledge; "no measured #6 in
              the library yet" needs a measurement from us, and the turnout may
              be perfectly well described. Collapsing them into "the document
              doesn't say" told an owner their document was silent when it had
              named a #6 all along — the report distinguishes them, so show it. */}
          <span className="mt-0.5 block font-normal text-gray-500">
            {reasons.map((r) => r.text).join(" ")}
            {asked < report.turnouts.length &&
              ` The other ${report.turnouts.length - asked} already name a part.`}
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
                    <optgroup label="I don't know what make it is">
                      {placeholders.map((p) => (
                        <option key={p.id} value={p.id}>
                          {labelOf(p)}
                        </option>
                      ))}
                    </optgroup>
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
