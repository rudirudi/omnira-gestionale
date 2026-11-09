"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { type ActionResult, fromDbError } from "@/lib/action-result";

const ENTITY = z.enum(["task", "project", "client", "lead", "discussion"]);

export async function fetchCommentsAction(entityType: z.infer<typeof ENTITY>, entityId: string) {
  await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("comments")
    .select("*, author:profiles!comments_author_id_fkey(id, full_name)")
    .eq("entity_type", ENTITY.parse(entityType))
    .eq("entity_id", z.guid().parse(entityId))
    .order("created_at");
  return data ?? [];
}
export type CommentWithAuthor = Awaited<ReturnType<typeof fetchCommentsAction>>[number];

export async function addCommentAction(input: {
  entityType: z.infer<typeof ENTITY>;
  entityId: string;
  body: string;
  mentions: string[];
}): Promise<ActionResult> {
  const me = await getCurrentUser();
  const body = input.body.trim();
  if (!body) return { ok: false, error: "Il commento è vuoto" };
  if (body.length > 5000) return { ok: false, error: "Commento troppo lungo (max 5000 caratteri)" };
  const supabase = await createClient();
  const { error } = await supabase.from("comments").insert({
    entity_type: ENTITY.parse(input.entityType),
    entity_id: z.guid().parse(input.entityId),
    body,
    mentions: z.array(z.guid()).max(20).parse([...new Set(input.mentions)]),
    author_id: me.id,
  });
  if (error) return fromDbError(error);
  return { ok: true };
}

export async function deleteCommentAction(id: string): Promise<ActionResult> {
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("comments").delete().eq("id", z.guid().parse(id));
  if (error) return fromDbError(error);
  return { ok: true };
}
