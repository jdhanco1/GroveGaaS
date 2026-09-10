import { prisma } from "@/lib/prisma";
import { saveGeneratorType, deleteGeneratorType } from "./actions";

export default async function GeneratorTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const [types, editing] = await Promise.all([
    prisma.generatorType.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { generators: true } } } }),
    edit ? prisma.generatorType.findUnique({ where: { id: edit } }) : null,
  ]);

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Generator Types</h1>
        <p className="text-sm text-slate-500">
          Define tank capacity and expected runtime per full tank for each generator model.
        </p>
      </div>

      <form action={saveGeneratorType} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <div className="grid grid-cols-3 gap-3">
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
            <label className="block text-sm font-medium text-slate-700">Tank capacity (gal)</label>
            <input
              name="tankCapacityGallons"
              type="number"
              step="0.1"
              required
              defaultValue={editing?.tankCapacityGallons}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Runtime (minutes/tank)</label>
            <input
              name="runtimeMinutes"
              type="number"
              required
              defaultValue={editing?.runtimeMinutes}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <button className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
          {editing ? "Save changes" : "Add generator type"}
        </button>
        {editing && (
          <a href="/admin/generator-types" className="ml-3 text-sm text-slate-500 hover:underline">
            Cancel
          </a>
        )}
      </form>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-2">Name</th>
            <th className="py-2">Capacity</th>
            <th className="py-2">Runtime</th>
            <th className="py-2">Generators</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {types.map((t) => (
            <tr key={t.id} className="border-b border-slate-100">
              <td className="py-2">{t.name}</td>
              <td className="py-2">{t.tankCapacityGallons} gal</td>
              <td className="py-2">{t.runtimeMinutes} min</td>
              <td className="py-2">{t._count.generators}</td>
              <td className="py-2 space-x-3 text-right">
                <a href={`/admin/generator-types?edit=${t.id}`} className="text-slate-600 hover:underline">
                  Edit
                </a>
                <form action={deleteGeneratorType} className="inline">
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
