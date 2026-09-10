import { prisma } from "@/lib/prisma";
import { resolveIssue } from "./actions";

export default async function IssuesPage() {
  const issues = await prisma.issueReport.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      generator: true,
      scanEvent: true,
    },
  });

  const open = issues.filter((i) => i.status === "OPEN");
  const resolved = issues.filter((i) => i.status === "RESOLVED");

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Reported Issues</h1>
        <p className="text-sm text-slate-500">Customer-reported problems, independent of fuel status.</p>
      </div>

      <section>
        <h2 className="mb-2 font-medium text-slate-900">Open ({open.length})</h2>
        <ul className="space-y-2">
          {open.map((i) => (
            <li key={i.id} className="rounded border border-red-200 bg-red-50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{i.generator.label}</p>
                  <p className="text-sm text-slate-600">{i.note || "No description provided."}</p>
                  <p className="text-xs text-slate-400">{i.createdAt.toLocaleString()}</p>
                </div>
                <form action={resolveIssue}>
                  <input type="hidden" name="id" value={i.id} />
                  <button className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800">
                    Resolve
                  </button>
                </form>
              </div>
            </li>
          ))}
          {open.length === 0 && <p className="text-sm text-slate-400">No open issues.</p>}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-medium text-slate-900">Resolved ({resolved.length})</h2>
        <ul className="space-y-2">
          {resolved.map((i) => (
            <li key={i.id} className="rounded border border-slate-200 p-3 text-sm text-slate-500">
              {i.generator.label} — {i.note || "No description"} (resolved{" "}
              {i.resolvedAt?.toLocaleDateString()})
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
