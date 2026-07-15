# Changelog

All notable changes to the Module Repository are documented here.
Dates are YYYY-MM-DD. Changes are listed newest-first.

---

## 2026-07-14

### Added
- **Endplate face width** — the schematic editor now lets you set each endplate's
  face width (West/A and East/B), in inches. The Free-moN standard is 12″ minimum,
  24″ recommended, and a module may differ end to end (e.g. a transition). The width
  is saved with the module and used by Free-Dispatcher to draw each module's
  benchwork footprint and endplate faces to scale.
- **Benchwork outline** — draw your module's actual board shape (corners, L-shapes,
  angled fronts) instead of settling for a plain rectangle. Start from a rectangle,
  then drag corners; the endplate faces show as ◆ anchors you can snap corners to,
  so the board meets the standard interface. Free-Dispatcher draws that real
  footprint in the layout map. Leave it empty to keep the endplate-width band.
- **Curved benchwork edges** — drag an edge's ◇ handle to bow it into a true arc,
  for curved fronts and corner boards. Select a corner to straighten its edge again.
- **See the physical module** — a module's page now shows *what it looks like* (the
  benchwork and mainline, to scale) next to *how it operates* (the dispatcher
  schematic). Catalog cards lead with the physical shape, so you can spot a corner,
  a curve or a yard at a glance instead of decoding a line diagram.
- **In-app changelog** — this page. When there are updates you haven't seen yet, a
  note pops up after you log in so you can catch up on what changed.

### Changed
- **Benchwork editing has room to work** — it moved out of the cramped side panel
  into a full-width canvas, and it now draws the real module: the mainline, sidings,
  turnouts and signals appear where they actually sit on the board (following the
  module's curvature), so you're shaping the board around the real track rather than
  a straight placeholder line.
- **Place track by dragging** — on that canvas you can now drag a turnout (●) along
  its track, and drag a siding or spur's ends (○) along the mainline, instead of
  typing positions in inches. The numeric fields are still there when you want to be
  exact, and the dispatcher view updates as you drag.

### Fixed
- **Changelog entries were cut off mid-sentence** — longer entries that wrap across
  lines now read in full.

---

## [Unreleased] — 2026-06-28

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

## 2026-06-25

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

## 2026-06-18

### Added
- Module tracks (spurs and sidings) with capacity, linked to industries.
- MSS module type field (Crossover / Cascade).
- Owner profile: first/last name, phone number.
- Admin panel: suggestion review, lookup management, grants, user management, audit log.

---

## 2026-06-10 — Initial release (M1–M4)

- Authentication and user management.
- Module CRUD with new-module wizard.
- Endplates, industries, and image gallery.
- Module catalog with search and filtering.
