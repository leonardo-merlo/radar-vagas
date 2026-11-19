"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireDashboardUser } from "@/lib/auth";
import type { ContactStatus, JobStatus } from "@/lib/database.types";
import { createSupabase } from "@/lib/supabase/server";

const TRIAGE_STATUSES: readonly JobStatus[] = ["new", "approved", "skipped"];
const CONTACT_STATUSES: readonly ContactStatus[] = ["found", "invited", "messaged", "replied", "ignored"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Approve, skip or reset a job. Applying is the skill's job, not the dashboard's. */
export async function setJobStatus(formData: FormData): Promise<void> {
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as JobStatus;
  if (!UUID.test(id) || !TRIAGE_STATUSES.includes(status)) throw new Error("Pedido inválido");

  const db = await requireDashboardUser();
  const { error } = await db
    .from("jobs")
    .update({ status, status_reason: status === "skipped" ? "Descartada no painel" : null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath(`/vaga/${id}`);
}

export async function setContactStatus(formData: FormData): Promise<void> {
  const id = String(formData.get("id"));
  const jobId = String(formData.get("jobId"));
  const status = String(formData.get("status")) as ContactStatus;
  if (!UUID.test(id) || !UUID.test(jobId) || !CONTACT_STATUSES.includes(status)) throw new Error("Pedido inválido");

  const db = await requireDashboardUser();
  const contactedAt = status === "found" || status === "ignored" ? null : new Date().toISOString();
  const { error } = await db.from("job_contacts").update({ status, contacted_at: contactedAt }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/vaga/${jobId}`);
}

export async function signIn(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect("/login?erro=email");

  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const supabase = await createSupabase();
  // shouldCreateUser: false — only accounts created by hand in Supabase can log in.
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/callback` },
  });
  redirect(error ? "/login?erro=envio" : "/login?enviado=1");
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}
