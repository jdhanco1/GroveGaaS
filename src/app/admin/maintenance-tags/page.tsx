import { prisma } from "@/lib/prisma";
import { saveMaintenanceTag, deleteMaintenanceTag } from "./actions";

const CATEGORIES = ["OIL_CHANGE", "REPAIR", "INSPECTION", "OTHER"] as const;

export default async function MaintenanceTagsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const [tags, editing] = await Promise.all([
    prisma.maintenanceTag.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { generatorLinks: true } } },
    }),
    edit ? prisma.maintenanceTag.findUnique({ where: { id: edit } }) : null,
  ]);

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Maintenance Tags</h1>
        <p className="text-sm text-slate-500">
          Reusable tags for oil changes, repairs, and inspections — attach them to generators.
        </p>
      </div>

      <form action={saveMaintenanceTag} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
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
            <label className="block text-sm font-medium text-slate-700">Category</label>
            <select
              name="category"
              defaultValue={editing?.category ?? "OTHER"}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Description</label>
          <input
            name="description"
            defaultValue={editing?.description ?? ""}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
          {editing ? "Save changes" : "Add tag"}
        </button>
        {editing && (
          <a href="/admin/maintenance-tags" className="ml-3 text-sm text-slate-500 hover:underline">
            Cancel
          </a>
        )}
      </form>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-2">Name</th>
            <th className="py-2">Category</th>
            <th className="py-2">In use</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {tags.map((t) => (
            <tr key={t.id} className="border-b border-slate-100">
              <td className="py-2">{t.name}</td>
              <td className="py-2">{t.category.replace("_", " ")}</td>
              <td className="py-2">{t._count.generatorLinks}</td>
              <td className="py-2 space-x-3 text-right">
                <a href={`/admin/maintenance-tags?edit=${t.id}`} className="text-slate-600 hover:underline">
                  Edit
                </a>
                <form action={deleteMaintenanceTag} className="inline">
                  <input type="hidden" name="id" value={t.id} />
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
