import { setJobStatus } from "@/app/actions";
import type { JobStatus } from "@/lib/database.types";

/** Approve or skip. Applied and pending jobs belong to the apply skill, so they get no buttons. */
export function TriageButtons({ id, status }: { id: string; status: JobStatus }) {
  if (status !== "new" && status !== "approved" && status !== "skipped") return null;
  const actions: { value: JobStatus; label: string; primary?: boolean }[] =
    status === "new"
      ? [
          { value: "approved", label: "Aprovar", primary: true },
          { value: "skipped", label: "Descartar" },
        ]
      : [{ value: "new", label: "Desfazer" }];

  return (
    <form action={setJobStatus} className="flex justify-center gap-2">
      <input type="hidden" name="id" value={id} />
      {actions.map((action) => (
        <button
          key={action.value}
          className={action.primary ? "botao botao-principal" : "botao"}
          type="submit"
          name="status"
          value={action.value}
          data-testid={`triagem-${action.value}`}
        >
          {action.label}
        </button>
      ))}
    </form>
  );
}
