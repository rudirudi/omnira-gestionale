import "server-only";
import { createClient } from "@/lib/supabase/server";

// Suggerimenti di partenza (poi si aggiungono quelli già usati negli altri progetti)
const BASE_STACK = ["Next.js", "React", "TypeScript", "Tailwind CSS", "Supabase", "PostgreSQL", "Node.js", "Python", "FastAPI", "WordPress", "WooCommerce", "Shopify", "Vue", "Laravel", "PHP", "n8n", "Make", "OpenAI API", "Claude API", "Stripe", "Docker", "Vercel", "Cloudflare"];
const BASE_PATTERNS = ["Server Actions", "Row Level Security", "REST API", "Webhook", "Cron job", "Code di lavoro (queue)", "Multi-tenant", "SSR", "Static site (SSG)", "Edge functions", "Event-driven", "RAG", "Agent con tool", "Soft delete", "Audit log", "CI/CD su git push"];
const BASE_PROVIDERS = ["Vercel", "Supabase", "GitHub", "Cloudflare", "Aruba", "Seeweb", "Hetzner", "SiteGround", "Resend", "Stripe", "OpenAI", "Anthropic", "Google Workspace", "Netlify", "AWS"];

function merge(base: string[], used: string[]) {
  const seen = new Set<string>();
  return [...used, ...base].filter((v) => {
    const k = v.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export async function getProjectTech(projectId: string) {
  const supabase = await createClient();
  const [tech, services, sugg] = await Promise.all([
    supabase.from("project_tech").select("*, editor:profiles!project_tech_updated_by_fkey(full_name)").eq("project_id", projectId).maybeSingle(),
    supabase.from("project_services").select("*").eq("project_id", projectId).order("position").order("created_at"),
    supabase.rpc("tech_suggestions"),
  ]);
  const used = (k: string) => (sugg.data ?? []).filter((s) => s.kind === k).sort((a, b) => b.uses - a.uses).map((s) => s.value);
  return {
    tech: tech.data,
    services: services.data ?? [],
    suggestions: { stack: merge(BASE_STACK, used("stack")), patterns: merge(BASE_PATTERNS, used("pattern")), providers: merge(BASE_PROVIDERS, used("provider")) },
  };
}
export type ProjectTechData = Awaited<ReturnType<typeof getProjectTech>>;
