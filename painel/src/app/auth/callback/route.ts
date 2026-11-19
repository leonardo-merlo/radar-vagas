import { NextResponse, type NextRequest } from "next/server";
import { createSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get("code");
  const target = new URL("/", request.url);
  if (!code) return NextResponse.redirect(new URL("/login?erro=link", request.url));

  const supabase = await createSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return NextResponse.redirect(error ? new URL("/login?erro=link", request.url) : target);
}
