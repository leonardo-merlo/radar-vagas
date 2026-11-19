"use server";

import { revalidatePath } from "next/cache";
import type { ContactStatus, JobStatus } from "@/lib/database.types";
import { setContactStatus as updateContact, setJobStatus as updateJob } from "@/lib/queries";

const TRIAGE_STATUSES: readonly JobStatus[] = ["new", "approved", "skipped"];
const CONTACT_STATUSES: readonly ContactStatus[] = ["found", "invited", "messaged", "replied", "ignored"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Approve, skip or reset a job. Applying is the skill's job, not the dashboard's. */
export async function setJobStatus(formData: FormData): Promise<void> {
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as JobStatus;
  if (!UUID.test(id) || !TRIAGE_STATUSES.includes(status)) throw new Error("Pedido inválido");
  await updateJob(id, status);
  revalidatePath("/");
  revalidatePath(`/vaga/${id}`);
}

export async function setContactStatus(formData: FormData): Promise<void> {
  const id = String(formData.get("id"));
  const jobId = String(formData.get("jobId"));
  const status = String(formData.get("status")) as ContactStatus;
  if (!UUID.test(id) || !UUID.test(jobId) || !CONTACT_STATUSES.includes(status)) throw new Error("Pedido inválido");
  await updateContact(id, status);
  revalidatePath(`/vaga/${jobId}`);
}
