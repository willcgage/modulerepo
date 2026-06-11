import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TextField, SubmitButton } from "@/components/form-fields";
import { updateProfile } from "./actions";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("owner_profiles")
    .select("display_name, contact_email, phone, location, role")
    .eq("id", user.id)
    .single();

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
        ← Back to dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-gray-900">Edit profile</h1>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <form action={updateProfile}>
          <TextField label="Display name" name="display_name" defaultValue={profile?.display_name ?? ""} maxLength={120} />
          <TextField
            label="Contact email"
            name="contact_email"
            type="email"
            defaultValue={profile?.contact_email ?? ""}
            required={false}
          />
          <TextField
            label="Phone"
            name="phone"
            type="tel"
            defaultValue={profile?.phone ?? ""}
            required={false}
            placeholder="(555) 555-5555"
          />
          <TextField
            label="Location"
            name="location"
            defaultValue={profile?.location ?? ""}
            required={false}
            placeholder="City, region, or club"
          />
          <p className="mb-4 text-sm text-gray-500">
            Role: <span className="font-medium text-gray-700">{profile?.role ?? "owner"}</span>
          </p>
          <SubmitButton label="Save changes" />
        </form>
      </div>
    </div>
  );
}
