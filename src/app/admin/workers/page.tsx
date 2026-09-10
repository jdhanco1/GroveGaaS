import { prisma } from "@/lib/prisma";
import { saveWorker, deleteWorker } from "./actions";
import Link from "next/link";

export default async function WorkersPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; error?: string }>;
}) {
  const { edit, error } = await searchParams;
  const [workers, editing] = await Promise.all([
    prisma.worker.findMany({ orderBy: { name: "asc" } }),
    edit ? prisma.worker.findUnique({ where: { id: edit } }) : null,
  ]);

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Workers</h1>
        <p className="text-sm text-slate-500">Manage field workers and their refuel PIN.</p>
      </div>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <form action={saveWorker} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Name</label>
            <input
              name="name"
              required
              defaultValue={editing?.name}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Refuel PIN {editing ? "(leave blank to keep current)" : "(4-6 digits)"}
            </label>
            <input
              name="pin"
              inputMode="numeric"
              maxLength={6}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <button className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
          {editing ? "Save changes" : "Add worker"}
        </button>
        {editing && (
          <Link href="/admin/workers" className="ml-3 text-sm text-slate-500 hover:underline">
            Cancel
          </Link>
        )}
      </form>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-2">Name</th>
            <th className="py-2">Active</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {workers.map((w) => (
            <tr key={w.id} className="border-b border-slate-100">
              <td className="py-2">
                <Link href={`/admin/workers/${w.id}`} className="text-slate-700 hover:underline">
                  {w.name}
                </Link>
              </td>
              <td className="py-2">{w.active ? "Yes" : "No"}</td>
              <td className="py-2 space-x-3 text-right">
                <Link href={`/admin/workers?edit=${w.id}`} className="text-slate-600 hover:underline">
                  Edit
                </Link>
                <form action={deleteWorker} className="inline">
                  <input type="hidden" name="id" value={w.id} />
                  <button className="text-red-600 hover:underline">Delete</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
