import "server-only";
import { redirect } from "next/navigation";
import { createSupabase } from "./supabase/server";

/** Data Access Layer entry: returns a client for a signed-in user listed in dashboard_users, or redirects. */
export async function requireDashboardUser() {
  const supabase = await createSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: allowed, error } = await supabase.rpc("is_dashboard_user");
  if (error || !allowed) redirect("/login?erro=sem-acesso");
  return supabase;
}
