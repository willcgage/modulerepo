import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";

const NAV_LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/car-types", label: "Suggestions" },
  { href: "/admin/lookups", label: "Lookup tables" },
  { href: "/admin/grants", label: "Grants" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/audit-log", label: "Audit log" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  await requireAdmin(supabase);

  return (
    <div className="mx-auto flex max-w-6xl gap-8 px-4 py-12">
      <aside className="w-48 shrink-0">
        <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
          ← Back to dashboard
        </Link>
        <h2 className="mt-3 text-lg font-semibold text-gray-900">Admin</h2>
        <nav className="mt-4 flex flex-col gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
