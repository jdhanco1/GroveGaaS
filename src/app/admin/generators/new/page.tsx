import { prisma } from "@/lib/prisma";
import { saveGenerator } from "../actions";

export default async function NewGeneratorPage() {
  const types = await prisma.generatorType.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Add Generator</h1>

      {types.length === 0 ? (
        <p className="text-sm text-slate-500">
          Create a generator type first before adding generators.
        </p>
      ) : (
        <form action={saveGenerator} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Label / Serial</label>
            <input name="label" required className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Generator type</label>
            <select
              name="generatorTypeId"
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-slate-500">
            Location is shown on the map from the customer this generator is assigned to — assign it after
            creating.
          </p>
          <button className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
            Create generator
          </button>
        </form>
      )}
    </div>
  );
}
