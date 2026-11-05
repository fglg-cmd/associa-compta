import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireOrgMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { features } from "@/lib/env";
import { aiErrorCode, streamChat, type ChatTurn } from "@/lib/ai";
import { planOf } from "@/lib/plans";
import { track } from "@/lib/analytics";
import { buildFinancialContext } from "@/modules/ai/context";
import { AG_REPORT_INSTRUCTION, ASSISTANT_SYSTEM } from "@/modules/ai/prompts";

export const runtime = "nodejs";
export const maxDuration = 120;

const bodySchema = z.object({
  orgId: z.uuid(),
  conversationId: z.uuid().nullable().optional(),
  message: z.string().trim().min(1).max(8000),
  mode: z.enum(["chat", "ag-report"]).default("chat"),
  fiscalYearId: z.uuid().nullable().optional(),
});

export async function POST(req: NextRequest) {
  if (!features.ai) return NextResponse.json({ error: "L'assistant IA n'est pas configuré sur ce serveur." }, { status: 503 });
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  let ctx;
  try {
    ctx = await requireOrgMember(body.orgId);
  } catch {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const supabase = await createClient();
  const { org, user } = ctx;

  // Quotas : mensuel par association, et anti-rafale par utilisateur
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
  const [{ count: monthly }, { count: burst }] = await Promise.all([
    supabase.from("ai_messages").select("*", { count: "exact", head: true }).eq("organization_id", org.id).eq("role", "user").gte("created_at", monthStart),
    supabase.from("ai_messages").select("id, ai_conversations!inner(user_id)", { count: "exact", head: true }).eq("ai_conversations.user_id", user.id).eq("role", "user").gte("created_at", new Date(Date.now() - 60_000).toISOString()),
  ]);
  const quota = planOf(org.plan).limits.aiMessagesPerMonth;
  if ((monthly ?? 0) >= quota) return NextResponse.json({ error: `Quota mensuel de ${quota} questions atteint. Passez à l'offre supérieure pour continuer.` }, { status: 429 });
  if ((burst ?? 0) >= 8) return NextResponse.json({ error: "Trop de questions en une minute, patientez un instant." }, { status: 429 });

  let conversationId = body.conversationId ?? null;
  let history: ChatTurn[] = [];
  if (conversationId) {
    const { data: msgs } = await supabase.from("ai_messages").select("role, content").eq("conversation_id", conversationId).order("created_at").limit(40);
    history = (msgs ?? []) as ChatTurn[];
  } else {
    const title = body.mode === "ag-report" ? "Rapport financier d'AG" : body.message.slice(0, 80);
    const { data: conv, error } = await supabase.from("ai_conversations").insert({ organization_id: org.id, user_id: user.id, title }).select("id").single<{ id: string }>();
    if (error || !conv) return NextResponse.json({ error: "Impossible de créer la conversation" }, { status: 500 });
    conversationId = conv.id;
  }

  const userContent = body.mode === "ag-report" ? `${AG_REPORT_INSTRUCTION}\n\n${body.message}` : body.message;
  await supabase.from("ai_messages").insert({ organization_id: org.id, conversation_id: conversationId, role: "user", content: body.mode === "ag-report" ? "Rédige le rapport financier de l'AG." : body.message });

  const { context } = await buildFinancialContext(org.id, org.name, body.fiscalYearId);
  let result;
  try {
    result = streamChat({ system: ASSISTANT_SYSTEM, context, messages: [...history, { role: "user", content: userContent }] });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503 });
  }

  const encoder = new TextEncoder();
  let full = "";
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of result.stream) {
          full += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
        const meta = await result.done;
        if (meta.refused && !full) {
          full = "Je ne peux pas répondre à cette demande. Reformulez votre question sur la gestion financière de l'association.";
          controller.enqueue(encoder.encode(full));
        }
        await supabase.from("ai_messages").insert({ organization_id: org.id, conversation_id: conversationId, role: "assistant", content: full || "(réponse vide)", provider: meta.provider, model: meta.model, input_tokens: meta.inputTokens, output_tokens: meta.outputTokens });
        await supabase.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId!);
        await track("ai_message", org.id, { mode: body.mode, provider: meta.provider, output_tokens: meta.outputTokens });
      } catch (e) {
        console.error("[ai]", e);
        const code = aiErrorCode(e);
        const msg = full ? "\n\n_(Réponse interrompue, réessayez.)_" : `Le service d'IA est momentanément indisponible (${code}). Réessayez dans un instant.`;
        controller.enqueue(encoder.encode(msg));
        await supabase.from("ai_messages").insert({ organization_id: org.id, conversation_id: conversationId, role: "assistant", content: full + msg, provider: "error", model: code.slice(0, 60) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Conversation-Id": conversationId! },
  });
}
