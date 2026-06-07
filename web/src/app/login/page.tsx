import { AuthCard, AuthInput, AuthSubmit } from "@/components/auth-card";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string }>;
}) {
  const { error, reset } = await searchParams;

  return (
    <AuthCard
      title="Log in"
      error={error}
      footer={{
        href: "/register",
        label: "Don't have an account?",
        linkText: "Register",
      }}
    >
      {reset && (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Your password has been updated. Log in with your new password.
        </p>
      )}
      <form action={login}>
        <AuthInput label="Email" name="email" type="email" autoComplete="email" />
        <AuthInput
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
        />
        <AuthSubmit label="Log in" />
      </form>
      <p className="mt-4 text-center text-sm">
        <a href="/forgot-password" className="text-blue-600 hover:underline">
          Forgot your password?
        </a>
      </p>
    </AuthCard>
  );
}
