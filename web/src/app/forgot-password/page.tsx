import { AuthCard, AuthInput, AuthSubmit } from "@/components/auth-card";
import { requestPasswordReset } from "./actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  return (
    <AuthCard
      title="Reset your password"
      footer={{ href: "/login", label: "Remembered it?", linkText: "Log in" }}
    >
      {sent ? (
        <p className="text-center text-sm text-gray-700">
          If an account exists for that email, a password reset link is on its
          way. Check your inbox.
        </p>
      ) : (
        <form action={requestPasswordReset}>
          <p className="mb-4 text-sm text-gray-600">
            Enter your email and we&apos;ll send you a link to reset your
            password.
          </p>
          <AuthInput label="Email" name="email" type="email" autoComplete="email" />
          <AuthSubmit label="Send reset link" />
        </form>
      )}
    </AuthCard>
  );
}
