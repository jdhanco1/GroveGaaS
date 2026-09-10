import Link from "next/link";
import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/generators", label: "Generators" },
  { href: "/admin/generator-types", label: "Generator Types" },
  { href: "/admin/maintenance-tags", label: "Maintenance Tags" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/workers", label: "Workers" },
  { href: "/admin/issues", label: "Reported Issues" },
  { href: "/admin/reports", label: "Reports" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white p-4">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Admin
        </h2>
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
          className="mt-6"
        >
          <button className="w-full rounded px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50">
            Sign out
          </button>
        </form>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
