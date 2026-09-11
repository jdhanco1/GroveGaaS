import Link from "next/link";
import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import GroveBrand from "@/components/grove-brand";

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
    <div className="gg-shell">
      <a className="gg-skip" href="#admin-main">Skip to main content</a>
      <aside className="gg-sidebar">
        <GroveBrand href="/admin" priority />
        <p className="gg-eyebrow">Admin workspace</p>
        <nav className="gg-nav" aria-label="Admin navigation">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
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
          <button className="w-full rounded px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50">
            Sign out
          </button>
        </form>
      </aside>
      <div className="gg-content">
        <header className="gg-topbar">
          <strong>Generator operations</strong>
          <span className="text-sm text-slate-500">{session.user.name ?? session.user.email}</span>
        </header>
        <main id="admin-main" tabIndex={-1} className="gg-main">{children}</main>
      </div>
    </div>
  );
}
