import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function listProjectPrompts(projectId: string) {
  const supabase = await createClient();
  const [prompts, counts] = await Promise.all([
    supabase
      .from("ai_prompts")
      .select("*, creator:profiles!ai_prompts_created_by_fkey(full_name), versions:ai_prompt_versions!ai_prompt_versions_prompt_id_fkey(*, author:profiles!ai_prompt_versions_created_by_fkey(full_name))")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false }),
    supabase.rpc("ai_prompt_comment_counts", { p_project: projectId }),
  ]);
  if (prompts.error) console.error("listProjectPrompts", prompts.error.message);
  const c = new Map((counts.data ?? []).map((r) => [r.prompt_id, r.comments]));
  return (prompts.data ?? []).map((p) => ({
    ...p,
    versions: [...(p.versions ?? [])].sort((a, b) => b.number - a.number),
    comments: c.get(p.id) ?? 0,
  }));
}
export type ProjectPrompt = Awaited<ReturnType<typeof listProjectPrompts>>[number];
export type PromptVersion = ProjectPrompt["versions"][number];
