import { AuthCard, AuthInput, AuthSubmit } from "@/components/auth-card";
import { register } from "./actions";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; confirmed?: string }>;
}) {
  const { error, confirmed } = await searchParams;

  if (confirmed) {
    return (
      <AuthCard
        title="Check your email"
        footer={{
          href: "/login",
          label: "Already confirmed?",
          linkText: "Log in",
        }}
      >
        <p className="text-sm text-gray-600">
          We sent a confirmation link to your email address. Click the link to
          activate your account.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create an account"
      error={error}
      footer={{
        href: "/login",
        label: "Already have an account?",
        linkText: "Log in",
      }}
    >
      <form action={register}>
        <AuthInput label="Display name" name="display_name" autoComplete="name" />
        <AuthInput label="Email" name="email" type="email" autoComplete="email" />
        <AuthInput
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
        />
        <AuthSubmit label="Register" />
      </form>
    </AuthCard>
  );
}
