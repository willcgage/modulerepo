import Link from "next/link";

export function AuthCard({
  title,
  error,
  children,
  footer,
}: {
  title: string;
  error?: string;
  children: React.ReactNode;
  footer?: { href: string; label: string; linkText: string };
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-center text-2xl font-semibold text-gray-900">
          {title}
        </h1>

        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {children}

        {footer && (
          <p className="mt-6 text-center text-sm text-gray-600">
            {footer.label}{" "}
            <Link
              href={footer.href}
              className="font-medium text-blue-600 hover:underline"
            >
              {footer.linkText}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

export function AuthInput({
  label,
  name,
  type = "text",
  required = true,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className="mb-4 block text-sm font-medium text-gray-700">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </label>
  );
}

export function AuthSubmit({ label }: { label: string }) {
  return (
    <button
      type="submit"
      className="mt-2 w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700"
    >
      {label}
    </button>
  );
}
