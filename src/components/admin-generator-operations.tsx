"use client";

import { useActionState } from "react";
import {
  recordAdminGeneratorOperation,
  restoreTemporarySwap,
  startTemporarySwap,
  type GeneratorActionState,
} from "@/app/admin/generators/actions";

const INITIAL_STATE: GeneratorActionState = { status: "idle", message: "" };

interface ReplacementOption {
  id: string;
  label: string;
  typeName: string;
}

interface ActiveSwap {
  id: string;
  customerName: string;
  originalLabel: string;
  replacementLabel: string;
  reason: string | null;
  startedAt: string;
}

interface AdminGeneratorOperationsProps {
  generatorId: string;
  status: "IDLE" | "RUNNING" | "NEEDS_FUEL_SOON" | "OVERDUE";
  activeAssignment: { id: string; customerName: string } | null;
  replacements: ReplacementOption[];
  activeSwap: ActiveSwap | null;
}

function ResultMessage({ state }: { state: GeneratorActionState }) {
  if (state.status === "idle") return null;
  return (
    <p className={`text-sm ${state.status === "error" ? "text-red-700" : "text-green-700"}`} aria-live="polite">
      {state.message}
    </p>
  );
}

export default function AdminGeneratorOperations({
  generatorId,
  status,
  activeAssignment,
  replacements,
  activeSwap,
}: AdminGeneratorOperationsProps) {
  const [operationState, operationAction, operationPending] = useActionState(
    recordAdminGeneratorOperation,
    INITIAL_STATE
  );
  const [swapState, swapAction, swapPending] = useActionState(startTemporarySwap, INITIAL_STATE);
  const [restoreState, restoreAction, restorePending] = useActionState(restoreTemporarySwap, INITIAL_STATE);
  const isIdle = status === "IDLE";

  return (
    <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <h2 className="font-medium text-slate-900">Operations</h2>
        <p className="text-sm text-slate-500">Update this generator without scanning its QR code.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <form action={operationAction}>
          <input type="hidden" name="generatorId" value={generatorId} />
          <input type="hidden" name="operation" value="POWER_ON" />
          <button
            disabled={!isIdle || operationPending}
            className="rounded bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Set running
          </button>
        </form>
        <form action={operationAction}>
          <input type="hidden" name="generatorId" value={generatorId} />
          <input type="hidden" name="operation" value="SHUTDOWN" />
          <button
            disabled={isIdle || operationPending}
            className="rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Shut down
          </button>
        </form>
      </div>

      <form action={operationAction} className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <input type="hidden" name="generatorId" value={generatorId} />
        <input type="hidden" name="operation" value="REFUEL" />
        <div>
          <label className="block text-sm font-medium text-slate-700">Gallons added</label>
          <input
            name="gallonsAdded"
            type="number"
            min="0.1"
            step="0.1"
            placeholder="Optional"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Note</label>
          <input
            name="note"
            maxLength={500}
            placeholder="Optional"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          disabled={operationPending}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {operationPending ? "Saving..." : "Record refuel"}
        </button>
      </form>
      <ResultMessage state={operationState} />

      <div className="border-t border-slate-100 pt-4">
        <h3 className="text-sm font-medium text-slate-900">Temporary replacement</h3>
        {activeSwap ? (
          <div className="mt-2 space-y-3 rounded border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-950">
              <strong>{activeSwap.replacementLabel}</strong> is replacing <strong>{activeSwap.originalLabel}</strong> for{" "}
              <strong>{activeSwap.customerName}</strong> since {new Date(activeSwap.startedAt).toLocaleString()}.
            </p>
            {activeSwap.reason && <p className="text-sm text-amber-900">Reason: {activeSwap.reason}</p>}
            <form action={restoreAction}>
              <input type="hidden" name="swapId" value={activeSwap.id} />
              <button
                disabled={restorePending}
                className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {restorePending ? "Restoring..." : "Restore original"}
              </button>
            </form>
            <ResultMessage state={restoreState} />
          </div>
        ) : activeAssignment ? (
          replacements.length > 0 ? (
            <form
              action={swapAction}
              onSubmit={(event) => {
                if (!window.confirm("Assign this temporary replacement now?")) event.preventDefault();
              }}
              className="mt-2 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
            >
              <input type="hidden" name="originalGeneratorId" value={generatorId} />
              <input type="hidden" name="originalAssignmentId" value={activeAssignment.id} />
              <div>
                <label className="block text-sm font-medium text-slate-700">Replacement for {activeAssignment.customerName}</label>
                <select
                  name="replacementGeneratorId"
                  required
                  defaultValue=""
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="" disabled>Select an available generator...</option>
                  {replacements.map((replacement) => (
                    <option key={replacement.id} value={replacement.id}>
                      {replacement.label} ({replacement.typeName})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Reason</label>
                <input
                  name="reason"
                  maxLength={500}
                  placeholder="Optional"
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                disabled={swapPending}
                className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {swapPending ? "Swapping..." : "Swap now"}
              </button>
              <div className="sm:col-span-3"><ResultMessage state={swapState} /></div>
            </form>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No active, unassigned generators are available.</p>
          )
        ) : (
          <p className="mt-2 text-sm text-slate-500">Assign this generator to a customer before creating a temporary swap.</p>
        )}
      </div>
    </section>
  );
}