# Changelog

All notable changes to the Module Repository, newest first.
Headings are `version — date` (YYYY-MM-DD).

---

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
