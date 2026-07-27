import type { StoredTrackPart } from "@willcgage/module-schematic";
import { createClient } from "@/lib/supabase/server";

/** The columns a stored part is made of — one place, so the loader and the admin
 * page can't drift apart on what a part record holds. */
export const TRACK_PART_COLUMNS =
  "id, slug, manufacturer, line, scale, name, kind, " +
  "part_number_left, part_number_right, part_number_single, frog_number, " +
  "points_offset_inches, points_offset_source, " +
  "frog_offset_inches, frog_offset_source, " +
  "overall_length_inches, overall_length_source, " +
  "diverging_length_inches, diverging_length_source, " +
  "minimum_length_inches, minimum_length_source, " +
  "substitution_radius_inches, substitution_radius_source, buildable, " +
  "track_spacing_inches, track_spacing_source, " +
  "secondary_frog_angle_deg, secondary_frog_angle_source, pieces_per_assembly, " +
  "lead_inches, lead_source, " +
  "outer_radius_inches, inner_radius_inches, radius_source, " +
  "actual_angle_deg, actual_angle_source, " +
  "measurement_note, status, created_at, updated_at";

export interface TrackPartRow {
  id: number;
  slug: string;
  manufacturer: string;
  line: string;
  scale: string | null;
  name: string;
  kind: string | null;
  part_number_left: string | null;
  part_number_right: string | null;
  part_number_single: string | null;
  frog_number: number | string | null;
  points_offset_inches: number | string | null;
  points_offset_source: string | null;
  frog_offset_inches: number | string | null;
  frog_offset_source: string | null;
  overall_length_inches: number | string | null;
  overall_length_source: string | null;
  diverging_length_inches: number | string | null;
  diverging_length_source: string | null;
  minimum_length_inches: number | string | null;
  minimum_length_source: string | null;
  substitution_radius_inches: number | string | null;
  substitution_radius_source: string | null;
  buildable: boolean | null;
  track_spacing_inches: number | string | null;
  track_spacing_source: string | null;
  secondary_frog_angle_deg: number | string | null;
  secondary_frog_angle_source: string | null;
  pieces_per_assembly: number | string | null;
  lead_inches: number | string | null;
  lead_source: string | null;
  outer_radius_inches: number | string | null;
  inner_radius_inches: number | string | null;
  radius_source: string | null;
  actual_angle_deg: number | string | null;
  actual_angle_source: string | null;
  measurement_note: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
}

/** Postgres hands `numeric` back as a string — a dimension that arrives as
 * "4.21875" would fail every `typeof === "number"` test downstream and silently
 * drop out of the drawing. */
const num = (v: number | string | null | undefined): number | null =>
  v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null;

/** Map a database row onto the package's flat stored-part shape. */
export function rowToStoredPart(r: TrackPartRow): StoredTrackPart {
  return {
    slug: r.slug,
    manufacturer: r.manufacturer,
    line: r.line,
    scale: r.scale,
    name: r.name,
    kind: r.kind,
    partNumberLeft: r.part_number_left,
    partNumberRight: r.part_number_right,
    partNumberSingle: r.part_number_single,
    frogNumber: num(r.frog_number),
    pointsOffsetInches: num(r.points_offset_inches),
    pointsOffsetSource: r.points_offset_source,
    frogOffsetInches: num(r.frog_offset_inches),
    frogOffsetSource: r.frog_offset_source,
    overallLengthInches: num(r.overall_length_inches),
    overallLengthSource: r.overall_length_source,
    divergingLengthInches: num(r.diverging_length_inches),
    divergingLengthSource: r.diverging_length_source,
    minimumLengthInches: num(r.minimum_length_inches),
    minimumLengthSource: r.minimum_length_source,
    substitutionRadiusInches: num(r.substitution_radius_inches),
    substitutionRadiusSource: r.substitution_radius_source,
    buildable: r.buildable,
    trackSpacingInches: num(r.track_spacing_inches),
    trackSpacingSource: r.track_spacing_source,
    secondaryFrogAngleDeg: num(r.secondary_frog_angle_deg),
    secondaryFrogAngleSource: r.secondary_frog_angle_source,
    piecesPerAssembly: num(r.pieces_per_assembly),
    leadInches: num(r.lead_inches),
    leadSource: r.lead_source,
    outerRadiusInches: num(r.outer_radius_inches),
    innerRadiusInches: num(r.inner_radius_inches),
    radiusSource: r.radius_source,
    actualAngleDeg: num(r.actual_angle_deg),
    actualAngleSource: r.actual_angle_source,
    measurementNote: r.measurement_note,
  };
}

/**
 * The stored library — the parts an admin has entered, including the built-in
 * Atlas ones the table was seeded with.
 *
 * Returns [] on any failure rather than throwing: the package's built-ins are
 * the floor, so a module still draws its turnouts if this table is unreachable.
 * A blank canvas would be a much worse failure than slightly older dimensions.
 */
export async function loadStoredTrackParts(): Promise<StoredTrackPart[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("track_parts")
      .select(TRACK_PART_COLUMNS)
      .eq("status", "active")
      .order("manufacturer")
      .order("frog_number", { nullsFirst: false });
    if (error || !data) return [];
    return (data as unknown as TrackPartRow[]).map(rowToStoredPart);
  } catch {
    return [];
  }
}
