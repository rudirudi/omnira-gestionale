import "server-only";
import { createClient } from "@/lib/supabase/server";

export const FILE_BUCKET = "project-files";

export async function listProjectFiles(projectId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_files")
    .select("*, uploader:profiles!project_files_uploaded_by_fkey(id, full_name)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  const files = data ?? [];
  // Anteprime delle immagini: link temporanei (1 ora)
  const images = files.filter((f) => f.mime?.startsWith("image/") && f.size_bytes <= 15_000_000);
  const thumbs = new Map<string, string>();
  if (images.length) {
    const { data: signed } = await supabase.storage.from(FILE_BUCKET).createSignedUrls(images.map((f) => f.path), 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) thumbs.set(s.path, s.signedUrl);
  }
  return files.map((f) => ({ ...f, thumb: thumbs.get(f.path) ?? null }));
}
export type ProjectFile = Awaited<ReturnType<typeof listProjectFiles>>[number];
