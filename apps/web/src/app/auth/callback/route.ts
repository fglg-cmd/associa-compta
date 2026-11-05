import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/utils";

/** Retour OAuth / lien magique / confirmation e-mail (flux PKCE). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/app";
  const next = safeNextPath(rawNext);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    return NextResponse.redirect(`${origin}/connexion?error=${encodeURIComponent("Lien invalide ou expiré.")}`);
  }
  const err = searchParams.get("error_description");
  return NextResponse.redirect(`${origin}/connexion?error=${encodeURIComponent(err ?? "Connexion impossible.")}`);
}
