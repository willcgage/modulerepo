# Changelog

All notable changes to the Module Repository, newest first.
Headings are `version — date` (YYYY-MM-DD).

---

## v0.15.31 — 2026-07-19

### Changed
- **Joined tracks become one track.** When you drag a track's end onto another track on the same lane (the snap makes them meet exactly), they now **merge into a single track** — one name, one capacity, spanning both — and everything attached (turnouts, industries, crossings, signals) follows onto the merged track. Spurs and crossover connectors never merge.

## v0.15.30 — 2026-07-19

### Added
- **Track ends snap together.** Dragging a track's ○ end near another track's end on the same lane snaps to it exactly — so the parallel tracks of two crossovers (or a siding and a yard track) join into one continuous run without fiddling. The readout shows which track it meets.

## v0.15.29 — 2026-07-19

### Fixed
- **Crossover diagonals sit where the crossover is** in the operations preview. Turnout positions are now always absolute (inches from A) — the crossover was storing its far-side turnouts relative to the parallel track, so the dispatcher drew its diagonals stretched across half the module.

## v0.15.28 — 2026-07-19

### Fixed
- **Cleaner dispatcher view around crossovers.** A crossover's parallel track no longer draws spurious end-dips into the main in the operations preview — it renders flat, with the crossover diagonal as its only connection. (Classic passing sidings are unchanged.)
- **No more doubled switch nodes.** The frog circle is drawn once per switch — a crossover put a turnout on both ends of its connector and the shared frog drew twice.
- **Tidy lengths in the Objects list.** Track lengths and positions round to 0.1″ instead of showing floating-point noise (18.800000000000004″).

## v0.15.27 — 2026-07-19

### Added
- **Crossovers** — the palette's **single LH, single RH, and double (scissors) crossover** glyphs are now live. Drop one on the main: the side you drop on picks where the parallel lane goes, a turnout lands on each track with the **diagonal connector** between them (sized by the frog # — the diagonal crosses one track-spacing at the frog angle), and if a parallel track already covers that spot it's **reused** (a siding, say); otherwise a short parallel stub appears for you to **draw out to length**.

## v0.15.26 — 2026-07-19

### Changed
- **True 2-way wyes** — the straight main no longer draws through a wye; the two mirrored legs take over where it splits, so it reads as a real Y. (The main stays the coordinate spine underneath.)

## v0.15.25 — 2026-07-19

### Changed
- **Wyes render symmetrically.** A wye turnout now splits into **two mirrored routes**, each diverging at half the frog angle from center — a proper Y — instead of a single one-sided leg. (Based on the Fast Tracks wye template.)

## v0.15.24 — 2026-07-19

### Changed
- **Diverging routes angle away like the real turnout.** A turnout's spur now continues at the frog angle — a straight turnout throws a single clean diagonal (atan(1/#)), a curved one carries the curve on — instead of bending back to run alongside the main. Drag the far end to lengthen the diverging track. (Based on the Fast Tracks prototype geometry.)

## v0.15.23 — 2026-07-19

### Changed
- **Prominent switch nodes** — a turnout now shows clear white **snap circles** at its points (where the diverging route leaves the main) and at its frog, so a switch reads as connected sections meeting at the round node, like a track plan.

## v0.15.22 — 2026-07-19

### Fixed
- **Drawing the mainline keeps the board aligned.** The main's end clicks now snap onto the endplates (the board's fixed ends), so a slightly-off click no longer tilts the main, drifts the endplate faces off the benchwork, or grows the board. Click near either end and it lands exactly on the endplate.

### Changed
- **Curved turnouts are more pronounced and stay on curved track.** A curved turnout's diverging route now sweeps over a longer arc so it reads as a real curve, not a subtle bow. And a curved turnout can only be dropped on **curved** track — drop one on a straight section and it tells you to bend the track first (or use a straight turnout).

## v0.15.21 — 2026-07-19

### Added
- **Curved turnouts** — the turnout palette's **curved left/right** glyphs are now live. Drop one and the diverging leg **bows into an arc** (both routes curve the same way) instead of leaving as a straight diagonal — the prototypical look for a switch on a curve. Any turnout can be made curved (or straightened) with the new **Curved** toggle in its inspector.

## v0.15.20 — 2026-07-19

### Fixed
- **Creating a new module works again.** Since the blank-module change, the new-module form submitted no geometry — but the database still required one, so every create failed with a foreign-key error. Geometry is now genuinely optional (a module's mainline is drawn on the canvas, not declared up front), and creation succeeds.

## v0.15.19 — 2026-07-19

### Added
- **Turnout palette** — the Turnout tool now shows draggable switch glyphs (**left-hand, right-hand, wye**). Drag one onto a track — or click a glyph, then click the board — and the turnout lands **already carrying a short diverging spur stub** you drag by its ○ end to size. Curved turnouts, crossovers, and slips appear as placeholders for what's next.

### Fixed
- **Turnout/spur length no longer changes on release.** Dropping a turnout is now a point placement, and its spur is positioned by its end (which you drag), so the track can't shift out from under what you placed — the old draw-to-create re-projected the drawn end onto the main and changed its length.

## v0.15.18 — 2026-07-19

### Added
- **Confirm before deleting a module** — the Delete module button now asks you to confirm first (it permanently removes the module and its whole schematic), so a stray click can't wipe one.

## v0.15.17 — 2026-07-19

### Added
- **Signal tool (S)** — drop a signal on the main by clicking; each signal is a **control point** (a block boundary, or an interlocking once you group turnouts under it). Signal masts are now **clickable** — select one to set its direction, side, position, and the turnouts/crossings it governs in the inspector.

## v0.15.16 — 2026-07-19

### Changed
- **A new module opens blank** — just the board, no track. **Geometry is gone from the new-module form**; you draw the mainline on the canvas (Track tool — click one end of the board, then the other), then build up the layers: track, turnouts, signals, industries. Existing modules (which carry a geometry) are unchanged.

## v0.15.15 — 2026-07-19

### Added
- **Benchwork sections** — set how many bench-work **sections** a module is built from (in the Module panel with nothing selected). The joints where the boards split are drawn as dashed dividers across the board, marked with their position. The module still operates as one unit — the joints are just construction/transport seams.

## v0.15.14 — 2026-07-19

### Fixed
- **Drop a turnout on a spur** — with the **W** tool, clicking a spur now drops a turnout on it instead of just selecting the spur, so house-track turnouts work again.

## v0.15.13 — 2026-07-19

### Added
- **Multi-track industries (house tracks)** — one industry can now be served by **several tracks**. In an industry's inspector there's a **House-track spots** section: add a spot on another track (its own span), and it draws on the layout beside that track. Capacity totals across all the industry's tracks. Clicking any of its tracks selects the whole industry.

## v0.15.12 — 2026-07-19

### Changed
- **Curved turnouts** — on a curved mainline, a turnout's diverging leg now **follows the curve** (a smooth arc easing out to one track over at the frog) instead of poking out as a straight chord, so the whole switch reads as one curved piece. Straight-main turnouts are unchanged.

## v0.15.11 — 2026-07-19

### Added
- **Turnouts on a spur (house tracks)** — the **W** tool now drops a turnout onto the nearest track, so you can put one **on a spur**, not just the main. Then draw another spur from it — the switch's frog geometry follows the track it sits on. This is how an industry's **house track** branches to multiple spot tracks.

## v0.15.10 — 2026-07-18

### Changed
- **Cleaner track & switches** — track now draws as a simple **outlined band** with **no ties**, and a turnout shows its **points and frog** through the band geometry with small node markers instead of the old triangle symbols.

## v0.15.9 — 2026-07-18

### Changed
- **Turnouts look like switches** — a turnout now draws its diverging leg as real **ballasted track** (rails + ties) running from the throat, with a **frog** casting and **points** symbol, instead of a plain line. The whole switch-and-spur reads as one continuous piece of track.

## v0.15.8 — 2026-07-18

### Changed
- **Spurs start at the frog** — a drawn spur now begins at its turnout's **frog** point, so the switch's diverging rail and the spur read as **one continuous route** instead of two lines leaving the throat. (Fixes the stray extra line that appeared next to a drawn spur.)

## v0.15.7 — 2026-07-18

### Changed
- **Turnouts draw as switches** — a turnout that a spur or siding diverges from now shows its **frog rail** leaving the main at the real frog angle (from its #), on the correct hand/side, instead of a bare dot. Higher numbers diverge more gently. (A turnout with nothing diverging yet stays a marker until you draw a track from it.)

## v0.15.6 — 2026-07-18

### Fixed
- **Drag a drawn spur to resize or reorient it** — a spur/siding you drew is now grab-and-drag editable with the **Select** tool too, not only the Track tool. Select it and drag its stub end to lengthen, shorten, or swing it; its throat stays on the turnout.

## v0.15.5 — 2026-07-18

### Added
- **Turnout tool (W)** — drop a turnout on the main by clicking. Pick its **number (frog size)** — #4 to #10 — in the toolbar first; it shows in the turnout's inspector and saves with the module. Then draw a spur or siding from the turnout with the Track tool.

### Fixed
- **You can extend a spur you just drew** — a freshly drawn spur or siding is now selected, so the Track tool edits *that track* (click the line to add a bend) instead of accidentally bending the mainline and breaking it.

## v0.15.4 — 2026-07-18

### Changed
- **Draw sidings & spurs from a turnout** — a siding or spur now diverges from a **turnout** you place on the main first, instead of dropping at a default spot. Place a turnout, then pick **Spur** and drag out from it to the stub, or pick **Siding** and drag from one turnout to another. The **+ Track** menu keeps Spur/Siding disabled until enough turnouts exist (one for a spur, two for a siding). **Esc** or **Cancel** aborts; shape the track with the Track tool afterwards.

## v0.15.3 — 2026-07-18

### Changed
- **One Track tool** — the Mainline (M) and Track (T) tools are now a single **Track (T)** tool. With nothing selected you draw and bend the mainline; click a siding or spur to bend/rotate it. Press **Esc** to deselect and go back to the mainline. The separate M tool is gone.

### Fixed
- **Clear now clears everything** — the drawn/curved mainline and any industries used to survive a Clear; they're wiped too. (The mainline collapses back to a plain straight line — the module's baseline — since positions are measured along it.)

## v0.15.2 — 2026-07-18

### Changed
- **"+ Track" menu on the drawing tools** — the add-track menu (set the main to single/double, add a siding or spur/yard, a crossover) now appears in the toolbar above the canvas whenever the **Mainline** or **Track** tool is active, so you add and draw track in the same place. It's still in the Objects list too.

## v0.15.1 — 2026-07-18

### Changed
- **Tool rail grouped by job** — the left rail now reads in sections: **Select**, then everything you draw on the board (**Benchwork · Mainline · Track · Turnout · Signal**), then **Industry**. Turnout and Signal sit with the track tools instead of below Industry.

### Removed
- **"Mainline length" field** — gone from the module inspector, the new-module wizard, and the edit form. A module whose rail runs a different distance than its board is now expressed by **drawing the mainline** (the **M** tool), not by typing a second length.

## v0.15.0 — 2026-07-18

### Changed
- **One "+ Track" menu** — add track from a single menu: set the mainline to single or double track, or add a siding or spur/yard (and a crossover on a double main).

## v0.14.1 — 2026-07-18

### Fixed
- **Both endplates follow a drawn mainline** — curving the mainline now rotates endplate A as well as B to match the track at each end.
- **Remove drawn points** — Alt-click a mainline or spur point to delete it; a **Straighten** / **Un-draw** button resets a drawn path back to derived.

### Added
- **Save button** — save now on demand (changes still autosave).

## v0.14.0 — 2026-07-18

### Added
- **Draw sidings & spurs** — the **T** tool: select a siding/spur, then drag its points to bend or rotate it (◇ to curve), or click to add a bend. The throat stays snapped to its turnout. The dispatcher view is unchanged.

## v0.13.0 — 2026-07-18

### Added
- **Draw the mainline** — a new **M** tool: drag mainline points, bend a stretch into a curve (drag its ◇), or click the line to add a bend. The board and endplate B follow the shape you draw; the dispatcher view stays straightened. The length/geometry fields seed the initial path.

## v0.12.1 — 2026-07-18

### Fixed
- **Saving a module with industries no longer errors** — removing a track was blocked when an industry still pointed at it; the save now re-points industries first, then cleans up tracks.

## v0.12.0 — 2026-07-18

### Added
- **Linked dispatcher view** — select a track, turnout or crossing on the board and it lights up in the dispatcher strip below, so the physical-to-dispatcher mapping is visible.

## v0.11.2 — 2026-07-18

### Added
- **Industry tool** — the left-rail **I** tool (or key `I`): click a track to drop an industry there.
- **Suggest a car type** — request a car type that isn't in the list yet, right from an industry's inspector.

## v0.11.1 — 2026-07-18

### Added
- **Car types per industry** — pick which cars each industry receives (boxcar, hopper, tank…) in its inspector; they load and save with the module.

## v0.11.0 — 2026-07-18

### Added
- **Industries on the canvas** — place a rail-served customer as a car-spot span on a track (name, type, side, span). Capacity in cars derives from the span; a name + optional car/length label draws on the board. Existing industries load in ready to position; a new **Industries** step appears in the readiness checklist.

## v0.10.0 — 2026-07-17

### Changed
- **Track looks like track** — a ballast band with two rails and ties once you zoom in, a clean single line at overview.
- **The board reads as a board** — a solid fill the track sits on, with the endplate faces hatched to show the standard interface.
- **Signals are masts** — a mast on the track it governs with a head, instead of a bare dot.

## v0.9.0 — 2026-07-17

### Added
- **Quick new-module** — name, category, geometry and length, then straight to the canvas with a board already drawn. The full step-by-step wizard is still one click away.

### Changed
- **New modules open on a seeded board** instead of an empty canvas with a button.
- **Track capacity shows car count** (≈40 ft cars) alongside scale feet, and is always derived from the drawn length — never typed.

## v0.8.0 — 2026-07-17

### Added
- **Tool rail** down the left — Select (V) and Benchwork (B), with single-key shortcuts. More tools are stubbed for later.
- **Undo / redo** — Ctrl+Z and Ctrl+Shift+Z, with rapid drags folded into one step.
- **Autosave** — changes save automatically about a second after you stop; the Save button is gone, replaced by a Saved / Saving / Unsaved indicator.

### Changed
- **Clear** now asks first, and empties the drawing (autosave persists it).

## v0.7.0 — 2026-07-17

### Added
- **Drafting grid** — an inch grid that adapts as you zoom, with rulers down the top and left edges (origin at endplate A).
- **Zoom & pan** — scroll to zoom toward the pointer, space-drag to pan, Fit to frame the board; the view no longer jumps every time you edit.
- **Dimension callouts** — the board's overall length and depth are marked automatically, in inches and feet.
- **Live measurements** — dragging a corner, turnout or siding end shows its position/length (with a car count) as you move it.
- **Status bar** — board size, grid step, zoom and pointer position along the bottom.

## v0.6.0 — 2026-07-16

### Changed
- **The canvas is now the editor** — full-height board in the middle, one inspector on the right. The form stack and the stage rail are gone.
- **Nothing selected shows the module** — geometry, lengths and loop settings live in the inspector.
- **Endplates are objects** — click one on the board to set its track config, face width and pose.
- **Objects list** — every track, turnout, crossing and control point in one place; click to select, and it highlights on the board.
- **Dispatcher view moved to a strip** at the bottom (it's derived, so it no longer takes a column from the board).
- **Readiness replaces the stage gate** — a checklist in the top bar says what's missing instead of hiding fields.

### Fixed
- **Track under the benchwork is clickable again** — the board's shading sat on top of the track and swallowed every click, so turnouts, signals and endplates couldn't be selected or dragged on any module with an outline drawn.
- **Clicking empty canvas no longer adds a benchwork corner** — the Select tool means select; the Benchwork tool draws.

## v0.5.0 — 2026-07-14

### Added
- **Endplate face width** — set each endplate's face width (12″ min, 24″ recommended); ends may differ.
- **Benchwork outline** — draw the module's real board shape; corners snap to the endplate faces (◆). Empty = plain endplate-width band.
- **Curved edges** — drag an edge's ◇ to bow it into an arc.
- **Physical module view** — module pages and catalog cards now show the board and track to scale, beside the dispatcher schematic.
- **In-app changelog** — this page, plus a note after login when there's something new.

### Changed
- **Benchwork editor is a full-width canvas** of the real module — mainline, sidings, turnouts and signals drawn where they actually sit.
- **Place track by dragging** — drag a turnout (●) or a siding's ends (○) along the main. Numeric fields still available.
- **Click to edit** — select a turnout or track on the canvas to edit it in place.
- **Build order** — the builder now runs Dimensions → Benchwork → Track → Operations, one stage at a time. Jump freely; nothing is locked.
- **Dimensions live in the builder** — geometry and lengths reshape the board as you type. One Save writes both.

### Fixed
- Builder uses the full window instead of a narrow column.
- Changelog entries no longer cut off mid-sentence.

---

## v0.4.0 — 2026-06-28

### Added
- **Decimal inch length entry** — module length is now entered as a single total-inches
  decimal field (e.g. `48.5`) instead of separate feet + inches boxes. Supports three
  decimal places.
- **Mainline track length** — optional second length field for modules where the rail
  distance through the module differs from the physical footprint (curves, wyes, etc.).
  Helper text explains when to use it. The detail page only shows the mainline length
  when it differs from the module footprint.
- **Custom endplate labels** — endplate label field added to the new-module wizard and
  the add/edit endplate forms. Leave blank to auto-assign EP-1, EP-2, etc.; enter a
  direction (e.g. "West", "East") for a custom label. Maximum 30 characters.

### Changed
- **MSS wording** — "Has a Modular Signal System (MSS)" changed to "Supports Modular
  Signal System (MSS)" throughout the wizard and edit form.
- **Image upload reliability** — filenames with spaces or special characters no longer
  cause a server error; they are sanitised before upload. Upload failures now surface an
  error message to the user instead of silently failing.

### Database
- `freemon_modules`: `length_feet` (SMALLINT) and `length_inches` (SMALLINT) replaced
  by `length_total_inches` (DECIMAL 7,3) and `mainline_length_inches` (DECIMAL 7,3).
  Existing rows were converted automatically (`feet × 12 + inches`).
- `freemon_endplates`: label `CHECK` constraint widened from the previous limit to 30
  characters. The auto-assign trigger now fires on `INSERT` only and only when the label
  is blank, so custom labels are preserved on subsequent edits.

---

## v0.3.0 — 2026-06-25

### Added
- **File uploads up to 10 MB** — the Next.js server-action body-size limit was raised
  from the default ~1 MB to 10 MB.
- **Email confirmation on sign-up** — new registrations now show a "Check your email"
  screen instead of redirecting straight to the dashboard.
- **Curve degree precision** — `geometry_degrees` now accepts 1–359 degrees with up to
  three decimal places (previously unconstrained with two decimal places).
- **CAD / schematic attachments** — module owners can upload track-plan files (DWG, DXF,
  AnyRail, SCARM, XTrackCAD, Templot, RailModeller, 3PlanIt, PDF) and download them from
  the module detail page.

---

## v0.2.0 — 2026-06-18

### Added
- Module tracks (spurs and sidings) with capacity, linked to industries.
- MSS module type field (Crossover / Cascade).
- Owner profile: first/last name, phone number.
- Admin panel: suggestion review, lookup management, grants, user management, audit log.

---

## v0.1.0 — 2026-06-10

- Initial release (M1–M4).
- Authentication and user management.
- Module CRUD with new-module wizard.
- Endplates, industries, and image gallery.
- Module catalog with search and filtering.
