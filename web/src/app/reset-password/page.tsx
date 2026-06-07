"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthCard, AuthInput, AuthSubmit } from "@/components/auth-card";

type Status = "checking" | "ready" | "invalid";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState<Status>("checking");
  const [error, setError] = useState<string>();

  useEffect(() => {
    // The recovery link lands here with the session encoded in the URL —
    // the browser client picks it up automatically during initialization.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setStatus(session ? "ready" : "invalid");
    });
  }, [supabase]);

  async function handleSubmit(formData: FormData) {
    const password = formData.get("password") as string;
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      return;
    }

    await supabase.auth.signOut();
    router.push("/login?reset=1");
  }

  return (
    <AuthCard title="Set a new password" error={error}>
      {status === "checking" && (
        <p className="text-center text-sm text-gray-600">Checking your link…</p>
      )}

      {status === "invalid" && (
        <p className="text-center text-sm text-gray-700">
          This password reset link is invalid or has expired. Request a new
          one from the{" "}
          <a href="/forgot-password" className="text-blue-600 hover:underline">
            forgot password
          </a>{" "}
          page.
        </p>
      )}

      {status === "ready" && (
        <form action={handleSubmit}>
          <AuthInput
            label="New password"
            name="password"
            type="password"
            autoComplete="new-password"
          />
          <AuthSubmit label="Update password" />
        </form>
      )}
    </AuthCard>
  );
}
