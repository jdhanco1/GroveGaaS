import {
  countGeneratorsInOperation,
  getTotalRuntimeMinutes,
  getTotalGallonsUsed,
  getComplaintCountsByCustomer,
} from "@/lib/reports";

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from: fromStr, to: toStr } = await searchParams;
  const from = parseDate(fromStr);
  const to = parseDate(toStr);
  const range = from && to ? { from, to } : undefined;

  const [inOperation, runtimeMinutes, gallonsUsed, complaints] = await Promise.all([
    countGeneratorsInOperation(),
    getTotalRuntimeMinutes(range),
    getTotalGallonsUsed(range ? { from: range.from, to: range.to } : {}),
    getComplaintCountsByCustomer(range),
  ]);

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500">
          Filter by date range to report on a specific window (e.g. football season).
        </p>
      </div>

      <form className="flex items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">From</label>
          <input
            type="date"
            name="from"
            defaultValue={fromStr}
            className="mt-1 rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">To</label>
          <input
            type="date"
            name="to"
            defaultValue={toStr}
            className="mt-1 rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
          Apply
        </button>
        {range && (
          <a href="/admin/reports" className="text-sm text-slate-500 hover:underline">
            Clear
          </a>
        )}
      </form>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Generators in operation now</p>
          <p className="text-3xl font-semibold text-slate-900">{inOperation}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Total run time</p>
          <p className="text-3xl font-semibold text-slate-900">{(runtimeMinutes / 60).toFixed(1)}h</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Total gallons used</p>
          <p className="text-3xl font-semibold text-slate-900">{gallonsUsed} gal</p>
        </div>
      </div>

      <section>
        <h2 className="mb-2 font-medium text-slate-900">Complaints by customer</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2">Customer</th>
              <th className="py-2">Complaints</th>
            </tr>
          </thead>
          <tbody>
            {complaints.map((c) => (
              <tr key={c.customerId} className="border-b border-slate-100">
                <td className="py-2">{c.customerName}</td>
                <td className="py-2">{c.count}</td>
              </tr>
            ))}
            {complaints.length === 0 && (
              <tr>
                <td colSpan={2} className="py-3 text-slate-400">
                  No complaints in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
