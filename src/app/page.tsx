import Link from "next/link";
import GroveBrand from "@/components/grove-brand";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-7 bg-slate-100 px-6 text-center">
      <GroveBrand large priority />
      <div>
        <p className="gg-eyebrow">Generator operations</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Keep game day running.</h1>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/dashboard"
          className="rounded bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800"
        >
          Live Dashboard
        </Link>
        <Link
          href="/admin"
          className="rounded border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Admin Portal
        </Link>
      </div>
    </main>
  );
}

