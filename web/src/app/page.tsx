import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">
          Module Repository — Owner Portal
        </h1>
        <p className="mt-2 text-gray-600">
          Manage your Free-moN module submissions and account.
        </p>
      </div>

      {user ? (
        <Link
          href="/dashboard"
          className="rounded-md bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700"
        >
          Go to dashboard
        </Link>
      ) : (
        <div className="flex gap-4">
          <Link
            href="/login"
            className="rounded-md bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="rounded-md border border-gray-300 px-6 py-2 font-medium text-gray-700 hover:bg-gray-50"
          >
            Register
          </Link>
        </div>
      )}
    </div>
  );
}
