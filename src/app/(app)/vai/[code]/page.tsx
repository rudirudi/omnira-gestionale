import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Collegamento rapido da un codice: P-2026-026 → progetto, P-2026-026-4 → task */
export default async function GoToCodePage({ params }: PageProps<"/vai/[code]">) {
  await getCurrentUser();
  const { code } = await params;
  const m = /^([A-Z]{1,5}-\d{4}-\d{3})(?:-(\d{1,5}))?$/.exec(decodeURIComponent(code).toUpperCase());
  if (!m) notFound();
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("id").eq("code", m[1]).is("deleted_at", null).maybeSingle();
  if (!project) notFound();
  if (!m[2]) redirect(`/progetti/${project.id}`);
  const { data: task } = await supabase.from("tasks").select("id").eq("project_id", project.id).eq("number", Number(m[2])).is("deleted_at", null).maybeSingle();
  redirect(task ? `/task?aperto=${task.id}` : `/progetti/${project.id}`);
}
