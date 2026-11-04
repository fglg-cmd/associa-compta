import { getOrgContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { features } from "@/lib/env";
import { planOf } from "@/lib/plans";
import { Chat } from "./chat";

export const metadata = { title: "Assistant" };

export default async function AssistantPage({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ c?: string }> }) {
  const { org: slug } = await params;
  const { c } = await searchParams;
  const { org, userId } = await getOrgContext(slug);
  const supabase = await createClient();
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
  const [{ data: convs }, { data: msgs }, { count: used }] = await Promise.all([
    supabase.from("ai_conversations").select("id, title, updated_at").eq("organization_id", org.id).eq("user_id", userId).order("updated_at", { ascending: false }).limit(30),
    c ? supabase.from("ai_messages").select("id, role, content").eq("conversation_id", c).order("created_at") : Promise.resolve({ data: [] }),
    supabase.from("ai_messages").select("*", { count: "exact", head: true }).eq("organization_id", org.id).eq("role", "user").gte("created_at", monthStart),
  ]);
  return (
    <Chat
      key={c ?? "new"}
      orgId={org.id}
      slug={slug}
      enabled={features.ai}
      conversationId={c ?? null}
      conversations={(convs ?? []) as { id: string; title: string; updated_at: string }[]}
      initialMessages={(msgs ?? []) as { id: string; role: "user" | "assistant"; content: string }[]}
      quota={{ used: used ?? 0, limit: planOf(org.plan).limits.aiMessagesPerMonth }}
    />
  );
}
