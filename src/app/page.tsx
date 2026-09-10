import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center gap-6 bg-slate-100 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">Generator Fuel Tracker</h1>
      <div className="flex gap-4">
        <Link
          href="/dashboard"
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Live Dashboard
        </Link>
        <Link
          href="/admin"
          className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Admin Portal
        </Link>
      </div>
    </div>
  );
}

