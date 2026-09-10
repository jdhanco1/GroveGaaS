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

  const workerIds = new Set<string>();
  for (const i of issues) {
    if (i.resolvedByWorkerId) workerIds.add(i.resolvedByWorkerId);
  }
  const workers = await prisma.worker.findMany({ where: { id: { in: [...workerIds] } } });
  const workerNameById = new Map(workers.map((w) => [w.id, w.name]));

  const open = issues.filter((i) => i.status === "OPEN" && !i.needsHelp);
  const needsHelp = issues.filter((i) => i.status === "OPEN" && i.needsHelp);
  const resolved = issues.filter((i) => i.status === "RESOLVED");

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Reported Issues</h1>
        <p className="text-sm text-slate-500">
          Customer- and worker-reported problems, independent of fuel status.
        </p>
      </div>

      <section>
        <h2 className="mb-2 font-medium text-slate-900">Needs help ({needsHelp.length})</h2>
        <ul className="space-y-2">
          {needsHelp.map((i) => (
            <li key={i.id} className="rounded border border-purple-300 bg-purple-50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{i.generator.label}</p>
                  <p className="text-sm text-slate-600">{i.note || "No description provided."}</p>
                  {i.workerNote && <p className="text-sm text-purple-700">Worker note: {i.workerNote}</p>}
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
          {needsHelp.length === 0 && <p className="text-sm text-slate-400">Nothing flagged for help.</p>}
        </ul>
      </section>

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
              {i.resolvedAt?.toLocaleDateString()}
              {i.resolvedByWorkerId
                ? ` by ${workerNameById.get(i.resolvedByWorkerId) ?? "a worker"} in the field`
                : i.resolvedById
                  ? " by admin"
                  : ""}
              )
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
