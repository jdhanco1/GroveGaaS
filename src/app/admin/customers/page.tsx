import { prisma } from "@/lib/prisma";
import { saveCustomer, deleteCustomer, assignGeneratorToCustomer, unassignGeneratorFromCustomer } from "./actions";
import LocationPicker from "@/components/location-picker";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; error?: string }>;
}) {
  const { edit, error } = await searchParams;
  const [customers, editing, assignedGenerators, availableGenerators] = await Promise.all([
    prisma.customer.findMany({
      orderBy: { name: "asc" },
      include: { assignments: { where: { unassignedAt: null }, include: { generator: true } } },
    }),
    edit ? prisma.customer.findUnique({ where: { id: edit } }) : null,
    edit
      ? prisma.generator.findMany({
          where: { assignments: { some: { customerId: edit, unassignedAt: null } } },
          include: { assignments: { where: { customerId: edit, unassignedAt: null } } },
        })
      : [],
    edit
      ? prisma.generator.findMany({
          where: { active: true, assignments: { none: { unassignedAt: null } } },
          orderBy: { label: "asc" },
        })
      : [],
  ]);

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Customers</h1>
        <p className="text-sm text-slate-500">
          Manage customer accounts and their issue-reporting PIN.
        </p>
      </div>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <form action={saveCustomer} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
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
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input
              name="email"
              type="email"
              defaultValue={editing?.email ?? ""}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Phone</label>
            <input
              name="phone"
              defaultValue={editing?.phone ?? ""}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Issue-report PIN {editing ? "(leave blank to keep current)" : "(4-6 digits)"}
            </label>
            <input
              name="pin"
              inputMode="numeric"
              maxLength={6}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <LocationPicker
          latitudeName="latitude"
          longitudeName="longitude"
          defaultLatitude={editing?.latitude}
          defaultLongitude={editing?.longitude}
        />
        <button className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
          {editing ? "Save changes" : "Add customer"}
        </button>
        {editing && (
          <a href="/admin/customers" className="ml-3 text-sm text-slate-500 hover:underline">
            Cancel
          </a>
        )}
      </form>

      {editing && (
        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-medium text-slate-900">Assigned generators</h2>
          {assignedGenerators.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {assignedGenerators.map((g) => (
                <li key={g.id} className="flex items-center justify-between rounded border border-slate-100 px-3 py-2">
                  <span className="text-slate-700">{g.label}</span>
                  <form action={unassignGeneratorFromCustomer}>
                    <input type="hidden" name="assignmentId" value={g.assignments[0].id} />
                    <input type="hidden" name="customerId" value={editing.id} />
                    <button className="text-sm text-red-600 hover:underline">Unassign</button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No generators assigned yet.</p>
          )}

          {availableGenerators.length > 0 && (
            <form action={assignGeneratorToCustomer} className="flex items-end gap-3">
              <input type="hidden" name="customerId" value={editing.id} />
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700">Assign a generator</label>
                <select
                  name="generatorId"
                  required
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Select a generator…</option>
                  {availableGenerators.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
              <button className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                Assign
              </button>
            </form>
          )}
        </section>
      )}

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-2">Name</th>
            <th className="py-2">Contact</th>
            <th className="py-2">Assigned generators</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c.id} className="border-b border-slate-100">
              <td className="py-2">{c.name}</td>
              <td className="py-2">{c.email ?? c.phone ?? "—"}</td>
              <td className="py-2">
                {c.assignments.length > 0
                  ? c.assignments.map((a) => a.generator.label).join(", ")
                  : "—"}
              </td>
              <td className="py-2 space-x-3 text-right">
                <a href={`/admin/customers?edit=${c.id}`} className="text-slate-600 hover:underline">
                  Edit
                </a>
                <form action={deleteCustomer} className="inline">
                  <input type="hidden" name="id" value={c.id} />
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
