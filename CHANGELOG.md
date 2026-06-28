# Changelog

All notable changes to the Module Repository are documented here.
Dates are YYYY-MM-DD. Changes are listed newest-first.

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
