"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { suggestCarType, validateModuleName } from "@/lib/edge";

export type BasicsInput = {
  module_name: string;
  description: string;
  category: string;
  geometry_type: string;
  geometry_degrees: string;
  geometry_offset_inches: string;
  length_feet: string;
  length_inches: string;
  has_mss: boolean;
  mss_block_count: string;
};

export type EndplateInput = {
  endplate_number: number;
  track_config: string;
  width_inches: string;
  height_inches: string;
  notes: string;
};

export type TrackInput = {
  track_name: string;
  capacity_scale_feet: string;
  notes: string;
};

export type IndustryInput = {
  industry_name: string;
  industry_type: string;
  track_index: string; // "" = mainline (no spur), otherwise index into tracks[]
  notes: string;
  car_type_values: string[];
};

export async function checkModuleName(moduleName: string) {
  if (!moduleName.trim()) return { valid: true as const };
  return validateModuleName(moduleName.trim());
}

export async function submitCarTypeSuggestion(
  value: string,
  displayLabel: string,
  notes: string,
) {
  return suggestCarType(value, displayLabel, notes);
}

function toNullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

export async function createModule(
  basics: BasicsInput,
  endplates: EndplateInput[],
  tracks: TrackInput[],
  industries: IndustryInput[],
): Promise<{ error: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: module, error: moduleError } = await supabase
    .from("freemon_modules")
    .insert({
      owner_id: user.id,
      module_name: basics.module_name.trim(),
      description: basics.description.trim() || null,
      category: basics.category,
      geometry_type: basics.geometry_type,
      geometry_degrees: toNullableNumber(basics.geometry_degrees),
      geometry_offset_inches: toNullableNumber(basics.geometry_offset_inches),
      length_feet: Number(basics.length_feet),
      length_inches: Number(basics.length_inches),
      has_mss: basics.has_mss,
      mss_block_count: basics.has_mss
        ? toNullableNumber(basics.mss_block_count)
        : null,
    })
    .select("id")
    .single();

  if (moduleError || !module) {
    return { error: moduleError?.message ?? "Could not create the module." };
  }

  const moduleId = module.id;

  if (endplates.length > 0) {
    const { error: endplatesError } = await supabase
      .from("freemon_endplates")
      .insert(
        endplates.map((ep) => ({
          module_id: moduleId,
          endplate_number: ep.endplate_number,
          track_config: ep.track_config,
          width_inches: toNullableNumber(ep.width_inches),
          height_inches: toNullableNumber(ep.height_inches),
          notes: ep.notes.trim() || null,
        })),
      );

    if (endplatesError) {
      redirect(
        `/modules/${moduleId}/edit?warning=${encodeURIComponent(
          `Module created, but endplates could not be saved: ${endplatesError.message}. Add them here.`,
        )}`,
      );
    }
  }

  let trackIds: number[] = [];
  if (tracks.length > 0) {
    const { data: createdTracks, error: tracksError } = await supabase
      .from("module_tracks")
      .insert(
        tracks.map((track) => ({
          module_id: moduleId,
          track_name: track.track_name.trim() || null,
          capacity_scale_feet: Number(track.capacity_scale_feet),
          notes: track.notes.trim() || null,
        })),
      )
      .select("id");

    if (tracksError || !createdTracks) {
      redirect(
        `/modules/${moduleId}/edit?warning=${encodeURIComponent(
          `Module created, but tracks could not be saved: ${tracksError?.message ?? "unknown error"}. Add them here.`,
        )}`,
      );
    }

    trackIds = createdTracks.map((t) => t.id);
  }

  for (const industry of industries) {
    const trackId = industry.track_index === "" ? null : trackIds[Number(industry.track_index)] ?? null;

    const { data: createdIndustry, error: industryError } = await supabase
      .from("freemon_industries")
      .insert({
        module_id: moduleId,
        industry_name: industry.industry_name.trim(),
        industry_type: industry.industry_type,
        track_id: trackId,
        notes: industry.notes.trim() || null,
      })
      .select("id")
      .single();

    if (industryError || !createdIndustry) {
      redirect(
        `/modules/${moduleId}/edit?warning=${encodeURIComponent(
          `Module created, but "${industry.industry_name}" could not be saved: ${
            industryError?.message ?? "unknown error"
          }. Add it here.`,
        )}`,
      );
    }

    if (industry.car_type_values.length > 0) {
      const { data: carTypes } = await supabase
        .from("rail_car_types")
        .select("id, value")
        .in("value", industry.car_type_values);

      if (carTypes && carTypes.length > 0) {
        await supabase.from("freemon_industry_car_types").insert(
          carTypes.map((ct) => ({
            industry_id: createdIndustry.id,
            car_type_id: ct.id,
          })),
        );
      }
    }
  }

  redirect(`/modules/${moduleId}`);
}
