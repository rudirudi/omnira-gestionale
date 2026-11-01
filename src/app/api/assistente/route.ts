import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/permissions";
import { runTool, TOOL_LABEL, TOOLS } from "@/modules/assistente/tools";

export const maxDuration = 60;

const MODEL = process.env.ASSISTANT_MODEL || "claude-sonnet-5-5";
const MAX_STEPS = 8;

const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) }))
    .min(1)
    .max(40),
});

function systemPrompt(user: { full_name: string; role: keyof typeof ROLE_LABEL }) {
  const now = new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "full", timeStyle: "short" });
  return `Sei l'assistente interno di Omnira Soft, una software house italiana (siti, e-commerce, gestionali, app, automazioni AI) con sedi a Terni e Longobucco.
Parli con ${user.full_name} (${ROLE_LABEL[user.role]}). Oggi è ${now}.

Rispondi sempre in italiano, in modo diretto e conciso: prima la risposta, poi i dettagli utili.
Per qualsiasi domanda sui dati interni (clienti, lead, progetti, task, incassi, spese, abbonamenti, scadenze, preventivi, team) usa gli strumenti: non inventare mai numeri, nomi o date. Se un dato non c'è, dillo.
Se l'utente nomina un cliente o un progetto, usa prima "cerca" per trovarne l'id.
Gli importi degli strumenti sono in euro: scrivili all'italiana (1.234,50 €). Le date scrivile come 12 nov 2026.
Quando citi un record che ha un campo "link", rendilo un link markdown col suo nome, es. [Bottega Rossi](/clienti/...).
Per elenchi usa liste puntate brevi; per confronti piccole tabelle. Niente titoli inutili.
Puoi solo leggere: se ti chiedono di modificare qualcosa, spiega dove farlo nel gestionale.
Vedi solo i dati che l'utente può vedere con il suo ruolo.`;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Richiesta non valida" }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      if (!process.env.ANTHROPIC_API_KEY) {
        send({ type: "error", text: "L'assistente non è ancora attivo: manca la chiave ANTHROPIC_API_KEY nelle variabili d'ambiente di Vercel." });
        controller.close();
        return;
      }
      const client = new Anthropic();
      const messages: Anthropic.MessageParam[] = parsed.data.messages.map((m) => ({ role: m.role, content: m.content }));
      const tools = TOOLS.map((t, i) => (i === TOOLS.length - 1 ? { ...t, cache_control: { type: "ephemeral" as const } } : t));

      try {
        for (let step = 0; step < MAX_STEPS; step++) {
          const s = client.messages.stream({
            model: MODEL,
            max_tokens: 2048,
            system: [{ type: "text", text: systemPrompt(user), cache_control: { type: "ephemeral" } }],
            tools,
            messages,
          });
          s.on("text", (delta) => send({ type: "text", text: delta }));
          const final = await s.finalMessage();
          if (final.stop_reason !== "tool_use") break;

          messages.push({ role: "assistant", content: final.content });
          const uses = final.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
          const results: Anthropic.ToolResultBlockParam[] = [];
          for (const u of uses) {
            send({ type: "tool", label: TOOL_LABEL[u.name] ?? "Consulto i dati" });
            try {
              const out = await runTool(u.name, (u.input ?? {}) as Record<string, unknown>, user.id);
              results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(out).slice(0, 60000) });
            } catch (e) {
              results.push({ type: "tool_result", tool_use_id: u.id, content: `Errore: ${(e as Error).message}`, is_error: true });
            }
          }
          messages.push({ role: "user", content: results });
          send({ type: "break" });
        }
      } catch (e) {
        const status = e instanceof Anthropic.APIError ? e.status : undefined;
        const raw = e instanceof Anthropic.APIError ? e.message : (e as Error).message;
        console.error("[assistente]", status, raw);
        send({ type: "error", text: explainError(status, raw) });
      }
      send({ type: "done" });
      controller.close();
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}

/** Traduce gli errori dell'API Anthropic in istruzioni comprensibili (senza mai mostrare la chiave) */
function explainError(status: number | undefined, raw: string) {
  const m = raw.toLowerCase();
  if (status === 401 || m.includes("authentication") || m.includes("x-api-key"))
    return "Anthropic rifiuta la chiave (401): la chiave ANTHROPIC_API_KEY su Vercel non è valida. Ricreala su platform.claude.com, aggiornala su Vercel e rifai il deploy.";
  if (m.includes("credit balance") || m.includes("billing") || status === 402)
    return "Credito Anthropic esaurito o assente: aggiungi credito in Billing su platform.claude.com, poi riprova (non serve rifare il deploy).";
  if (status === 403 || m.includes("permission"))
    return "La chiave non ha i permessi per questo modello (403). Controlla su platform.claude.com che la chiave sia attiva e nell'organizzazione giusta.";
  if (status === 404 || m.includes("model"))
    return `Modello non disponibile per questa chiave (${MODEL}). Imposta ASSISTANT_MODEL su Vercel (es. claude-haiku-5-5) o verifica l'accesso al modello.`;
  if (status === 429) return "Troppe richieste ad Anthropic in poco tempo (429): aspetta un minuto e riprova.";
  if (status === 529 || (status ?? 0) >= 500) return "Anthropic è momentaneamente sovraccarico: riprova tra poco.";
  return `Non riesco a rispondere (${status ?? "errore di rete"}): ${raw.slice(0, 160)}`;
}
