# Changelog

All notable changes to the Module Repository, newest first.
Headings are `version — date` (YYYY-MM-DD).

---

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
