import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { withBalance } from "@/modules/incassi/balance";
import { displayState, quoteTotals } from "@/modules/preventivi/totals";

/**
 * Strumenti dell'assistente: SOLO LETTURA, eseguiti con la sessione dell'utente.
 * Le policy RLS del database decidono cosa vede: l'assistente non può mostrare
 * nulla che l'utente non vedrebbe già nel gestionale.
 */

type Db = Awaited<ReturnType<typeof createClient>>;
const eur = (c: number | null | undefined) => (c == null ? null : Math.round(c) / 100);
const today = () => new Date().toISOString().slice(0, 10);
const like = (q: string) => `%${q.replace(/[%_,()]/g, " ").trim()}%`;

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "riepilogo",
    description: "Numeri chiave di oggi: task aperti e in ritardo, progetti attivi, clienti attivi, lead aperti, da incassare e scaduto, spese del mese, rinnovi entro 30 giorni. Usalo per domande generali tipo 'come stiamo?'.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "cerca",
    description: "Cerca per testo in clienti, lead, progetti, task e preventivi. Usalo quando l'utente nomina qualcosa (un cliente, un progetto) e ti serve l'id.",
    input_schema: { type: "object", properties: { testo: { type: "string" } }, required: ["testo"] },
  },
  {
    name: "elenco_clienti",
    description: "Elenco clienti con stato, città, responsabile.",
    input_schema: { type: "object", properties: { stato: { type: "string", enum: ["prospect", "attivo", "inattivo"] }, testo: { type: "string" } } },
  },
  {
    name: "dettaglio_cliente",
    description: "Tutto su un cliente: dati, contatti, progetti, importi da incassare, scadenze, preventivi, ultime attività.",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "elenco_progetti",
    description: "Elenco progetti con cliente, stato, date, budget e avanzamento task.",
    input_schema: {
      type: "object",
      properties: { stato: { type: "string", enum: ["pianificato", "attivo", "in_pausa", "completato", "annullato"] }, cliente_id: { type: "string" } },
    },
  },
  {
    name: "dettaglio_progetto",
    description: "Tutto su un progetto: fasi, task, membri, incassi, costi e margine.",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "elenco_task",
    description: "Task con filtri. 'assegnati_a' può essere 'io' o il nome di una persona. 'solo_in_ritardo' per i task con scadenza passata non completati.",
    input_schema: {
      type: "object",
      properties: {
        assegnati_a: { type: "string" },
        stato: { type: "string", enum: ["da_fare", "in_corso", "in_review", "test", "fatto", "aperti"] },
        progetto_id: { type: "string" },
        solo_in_ritardo: { type: "boolean" },
        scadenza_entro: { type: "string", description: "Data AAAA-MM-GG" },
      },
    },
  },
  {
    name: "elenco_lead",
    description: "Lead della pipeline commerciale con fase, valore stimato, responsabile.",
    input_schema: { type: "object", properties: { fase: { type: "string", enum: ["nuovo", "call", "analisi", "preventivo", "vinto", "perso", "aperti"] } } },
  },
  {
    name: "situazione_incassi",
    description: "Importi da incassare dai clienti con pagato, residuo e stato (da_pagare, parziale, pagato, scaduto).",
    input_schema: { type: "object", properties: { cliente_id: { type: "string" }, solo_aperti: { type: "boolean" } } },
  },
  {
    name: "elenco_spese",
    description: "Spese in un periodo con totali per categoria e per persona. Date AAAA-MM-GG. Include gli addebiti degli abbonamenti.",
    input_schema: {
      type: "object",
      properties: { dal: { type: "string" }, al: { type: "string" }, persona: { type: "string" }, categoria: { type: "string" }, solo_da_rimborsare: { type: "boolean" } },
    },
  },
  {
    name: "elenco_abbonamenti",
    description: "Abbonamenti (Claude, Lovable…) con importo, frequenza, costo mensile equivalente, prossimo addebito e speso finora.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "elenco_scadenze",
    description: "Scadenze e rinnovi (domini, hosting, server, licenze) entro N giorni, incluse quelle già scadute.",
    input_schema: { type: "object", properties: { entro_giorni: { type: "number" } } },
  },
  {
    name: "elenco_preventivi",
    description: "Preventivi con stato (bozza, inviato, scaduto, accettato, rifiutato), destinatario e totali.",
    input_schema: { type: "object", properties: { stato: { type: "string" } } },
  },
  {
    name: "listino",
    description: "Listino servizi con prezzi standard IVA esclusa (null = prezzo da definire), unità e canoni.",
    input_schema: { type: "object", properties: { testo: { type: "string" } } },
  },
  {
    name: "persone",
    description: "Persone del team con ruolo.",
    input_schema: { type: "object", properties: {} },
  },
];

async function personId(db: Db, who: string | undefined, meId: string) {
  if (!who) return null;
  if (/^(io|me|mie|miei|mio)$/i.test(who.trim())) return meId;
  const { data } = await db.from("profiles").select("id").ilike("full_name", like(who)).limit(1).maybeSingle();
  return data?.id ?? "00000000-0000-0000-0000-000000000000";
}

export async function runTool(name: string, input: Record<string, unknown>, meId: string): Promise<unknown> {
  const db = await createClient();
  const s = (k: string) => (typeof input[k] === "string" && input[k] ? (input[k] as string) : undefined);

  switch (name) {
    case "riepilogo": {
      const monthStart = today().slice(0, 7) + "-01";
      const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const [tasks, projects, clients, leads, recs, exps, rens] = await Promise.all([
        db.from("tasks").select("status, due_date, me:task_assignees!inner(user_id)").eq("me.user_id", meId).is("deleted_at", null).neq("status", "fatto"),
        db.from("projects").select("id", { count: "exact", head: true }).eq("status", "attivo").is("deleted_at", null),
        db.from("clients").select("id", { count: "exact", head: true }).eq("status", "attivo").is("deleted_at", null),
        db.from("leads").select("estimated_value_cents").is("deleted_at", null).not("stage", "in", "(vinto,perso)"),
        db.from("receivables").select("amount_cents, due_date, payments(amount_cents, paid_on)").is("deleted_at", null),
        db.from("expenses").select("amount_cents").is("deleted_at", null).gte("spent_on", monthStart),
        db.from("renewals").select("id", { count: "exact", head: true }).eq("active", true).is("deleted_at", null).lte("next_due_date", in30),
      ]);
      const balances = (recs.data ?? []).map((r) => withBalance(r));
      return {
        oggi: today(),
        miei_task_aperti: tasks.data?.length ?? 0,
        miei_task_in_ritardo: (tasks.data ?? []).filter((t) => t.due_date && t.due_date < today()).length,
        progetti_attivi: projects.count ?? 0,
        clienti_attivi: clients.count ?? 0,
        lead_aperti: leads.data?.length ?? 0,
        valore_pipeline_eur: eur((leads.data ?? []).reduce((a, l) => a + (l.estimated_value_cents ?? 0), 0)),
        da_incassare_eur: eur(balances.reduce((a, r) => a + r.remaining, 0)),
        scaduto_da_incassare_eur: eur(balances.filter((r) => r.state === "scaduto").reduce((a, r) => a + r.remaining, 0)),
        spese_mese_corrente_eur: eur((exps.data ?? []).reduce((a, e) => a + e.amount_cents, 0)),
        rinnovi_entro_30_giorni: rens.count ?? 0,
      };
    }

    case "cerca": {
      const q = like(s("testo") ?? "");
      const [c, l, p, t, qu] = await Promise.all([
        db.from("clients").select("id, name, status").ilike("name", q).is("deleted_at", null).limit(8),
        db.from("leads").select("id, title, company_name, stage").or(`title.ilike.${q},company_name.ilike.${q}`).is("deleted_at", null).limit(8),
        db.from("projects").select("id, code, name, status").or(`name.ilike.${q},code.ilike.${q}`).is("deleted_at", null).limit(8),
        db.from("tasks").select("id, title, status, project:projects(code)").ilike("title", q).is("deleted_at", null).limit(8),
        db.from("quotes").select("id, number, title, status").or(`title.ilike.${q},number.ilike.${q}`).is("deleted_at", null).limit(8),
      ]);
      return {
        clienti: (c.data ?? []).map((x) => ({ ...x, link: `/clienti/${x.id}` })),
        lead: (l.data ?? []).map((x) => ({ ...x, link: `/lead?aperto=${x.id}` })),
        progetti: (p.data ?? []).map((x) => ({ ...x, link: `/progetti/${x.id}` })),
        task: (t.data ?? []).map((x) => ({ ...x, link: `/task?aperto=${x.id}` })),
        preventivi: (qu.data ?? []).map((x) => ({ ...x, link: `/preventivi/${x.id}` })),
      };
    }

    case "elenco_clienti": {
      let q = db.from("clients").select("id, name, status, city, sector, owner:profiles!clients_owner_id_fkey(full_name)").is("deleted_at", null).order("name").limit(100);
      if (s("stato")) q = q.eq("status", s("stato") as "attivo");
      if (s("testo")) q = q.ilike("name", like(s("testo")!));
      const { data, error } = await q;
      if (error) return { errore: error.message };
      return data.map((x) => ({ ...x, link: `/clienti/${x.id}` }));
    }

    case "dettaglio_cliente": {
      const id = s("id")!;
      const [c, contacts, projects, recs, rens, quotes, acts] = await Promise.all([
        db.from("clients").select("*").eq("id", id).maybeSingle(),
        db.from("contacts").select("first_name, last_name, role, email, phone, is_primary").eq("client_id", id),
        db.from("projects").select("id, code, name, status, start_date, due_date, budget_cents").eq("client_id", id).is("deleted_at", null),
        db.from("receivables").select("description, amount_cents, due_date, payments(amount_cents, paid_on)").eq("client_id", id).is("deleted_at", null),
        db.from("renewals").select("name, type, next_due_date, price_cents, frequency").eq("client_id", id).is("deleted_at", null).eq("active", true),
        db.from("quotes").select("id, number, title, status, valid_until").eq("client_id", id).is("deleted_at", null),
        db.from("activities").select("type, subject, due_at, done_at, created_at").eq("client_id", id).order("created_at", { ascending: false }).limit(8),
      ]);
      if (!c.data) return { errore: "Cliente non trovato o non visibile" };
      return {
        cliente: { ...c.data, link: `/clienti/${id}` },
        contatti: contacts.data,
        progetti: (projects.data ?? []).map((p) => ({ ...p, budget_eur: eur(p.budget_cents), link: `/progetti/${p.id}` })),
        incassi: (recs.data ?? []).map((r) => {
          const b = withBalance(r);
          return { descrizione: r.description, importo_eur: eur(r.amount_cents), pagato_eur: eur(b.paid), residuo_eur: eur(b.remaining), stato: b.state, entro: r.due_date };
        }),
        scadenze: (rens.data ?? []).map((r) => ({ ...r, prezzo_eur: eur(r.price_cents) })),
        preventivi: (quotes.data ?? []).map((q) => ({ ...q, link: `/preventivi/${q.id}` })),
        ultime_attivita: acts.data,
      };
    }

    case "elenco_progetti": {
      let q = db
        .from("projects")
        .select("id, code, name, status, type, start_date, due_date, budget_cents, client:clients(name), manager:profiles!projects_manager_id_fkey(full_name)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(100);
      if (s("stato")) q = q.eq("status", s("stato") as "attivo");
      if (s("cliente_id")) q = q.eq("client_id", s("cliente_id")!);
      const { data, error } = await q;
      if (error) return { errore: error.message };
      const { data: prog } = data.length
        ? await db.from("project_progress").select("project_id, total_tasks, done_tasks, overdue_tasks").in("project_id", data.map((p) => p.id))
        : { data: [] };
      const byId = new Map((prog ?? []).map((r) => [r.project_id, r]));
      return data.map((p) => {
        const pr = byId.get(p.id);
        return { ...p, budget_eur: eur(p.budget_cents), budget_cents: undefined, task_totali: pr?.total_tasks ?? 0, task_fatti: pr?.done_tasks ?? 0, task_in_ritardo: pr?.overdue_tasks ?? 0, link: `/progetti/${p.id}` };
      });
    }

    case "dettaglio_progetto": {
      const id = s("id")!;
      const [p, phases, tasks, members, recs, costs] = await Promise.all([
        db.from("projects").select("*, client:clients(id, name), manager:profiles!projects_manager_id_fkey(full_name)").eq("id", id).maybeSingle(),
        db.from("project_phases").select("name, status, start_date, due_date").eq("project_id", id).order("position"),
        db.from("tasks").select("id, number, title, status, priority, due_date, assignees:task_assignees(profile:profiles!task_assignees_user_id_fkey(full_name))").eq("project_id", id).is("deleted_at", null).order("number"),
        db.from("project_members").select("profile:profiles(full_name)").eq("project_id", id),
        db.from("receivables").select("description, amount_cents, due_date, payments(amount_cents, paid_on)").eq("project_id", id).is("deleted_at", null),
        db.from("expenses").select("description, amount_cents, spent_on, category").eq("project_id", id).is("deleted_at", null),
      ]);
      const proj = p.data;
      if (!proj) return { errore: "Progetto non trovato o non visibile" };
      const balances = (recs.data ?? []).map((r) => withBalance(r));
      const paid = balances.reduce((a, r) => a + r.paid, 0);
      const spent = (costs.data ?? []).reduce((a, e) => a + e.amount_cents, 0);
      return {
        progetto: { ...proj, link: `/progetti/${id}` },
        fasi: phases.data,
        task: (tasks.data ?? []).map((t) => ({
          codice: `${proj.code}-${t.number}`,
          titolo: t.title,
          stato: t.status,
          priorita: t.priority,
          scadenza: t.due_date,
          in_ritardo: !!t.due_date && t.due_date < today() && t.status !== "fatto",
          assegnatari: t.assignees.map((a) => a.profile?.full_name),
          link: `/task?aperto=${t.id}`,
        })),
        membri: (members.data ?? []).map((m) => m.profile?.full_name),
        incassi: balances.map((b) => ({ descrizione: b.description, importo_eur: eur(b.amount_cents), pagato_eur: eur(b.paid), residuo_eur: eur(b.remaining), stato: b.state })),
        costi: (costs.data ?? []).map((e) => ({ ...e, amount_eur: eur(e.amount_cents), amount_cents: undefined })),
        incassato_eur: eur(paid),
        costi_eur: eur(spent),
        margine_su_incassato_eur: eur(paid - spent),
      };
    }

    case "elenco_task": {
      const who = await personId(db, s("assegnati_a"), meId);
      let q = db
        .from("tasks")
        .select(
          who
            ? "id, number, title, status, priority, due_date, project:projects(code, name), me:task_assignees!inner(user_id)"
            : "id, number, title, status, priority, due_date, project:projects(code, name)",
        )
        .is("deleted_at", null)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(100);
      if (who) q = q.eq("me.user_id", who);
      const st = s("stato");
      if (st === "aperti" || input.solo_in_ritardo) q = q.neq("status", "fatto");
      else if (st) q = q.eq("status", st as "da_fare");
      if (s("progetto_id")) q = q.eq("project_id", s("progetto_id")!);
      if (input.solo_in_ritardo) q = q.lt("due_date", today());
      if (s("scadenza_entro")) q = q.lte("due_date", s("scadenza_entro")!);
      const { data, error } = await q;
      if (error) return { errore: error.message };
      return (data as unknown as { id: string; number: number; title: string; status: string; priority: string; due_date: string | null; project: { code: string | null; name: string } | null }[]).map((t) => ({
        codice: `${t.project?.code ?? ""}-${t.number}`,
        titolo: t.title,
        progetto: t.project?.name,
        stato: t.status,
        priorita: t.priority,
        scadenza: t.due_date,
        in_ritardo: !!t.due_date && t.due_date < today() && t.status !== "fatto",
        link: `/task?aperto=${t.id}`,
      }));
    }

    case "elenco_lead": {
      let q = db.from("leads").select("id, title, company_name, contact_name, stage, source, estimated_value_cents, expected_close_date, lost_reason, owner:profiles!leads_owner_id_fkey(full_name)").is("deleted_at", null).order("created_at", { ascending: false }).limit(100);
      const f = s("fase");
      if (f === "aperti") q = q.not("stage", "in", "(vinto,perso)");
      else if (f) q = q.eq("stage", f as "nuovo");
      const { data, error } = await q;
      if (error) return { errore: error.message };
      return data.map((l) => ({ ...l, valore_eur: eur(l.estimated_value_cents), estimated_value_cents: undefined, link: `/lead?aperto=${l.id}` }));
    }

    case "situazione_incassi": {
      let q = db.from("receivables").select("id, description, amount_cents, due_date, client:clients(id, name), project:projects(code, name), payments(amount_cents, paid_on)").is("deleted_at", null).order("due_date").limit(300);
      if (s("cliente_id")) q = q.eq("client_id", s("cliente_id")!);
      const { data, error } = await q;
      if (error) return { errore: error.message };
      const rows = data.map((r) => withBalance(r)).filter((r) => !input.solo_aperti || r.state !== "pagato");
      return {
        totale_residuo_eur: eur(rows.reduce((a, r) => a + r.remaining, 0)),
        importi: rows.map((r) => ({
          cliente: r.client?.name,
          progetto: r.project ? `${r.project.code} ${r.project.name}` : null,
          descrizione: r.description,
          importo_eur: eur(r.amount_cents),
          pagato_eur: eur(r.paid),
          residuo_eur: eur(r.remaining),
          stato: r.state,
          entro: r.due_date,
          ultimo_pagamento: r.lastPaidOn,
        })),
        link: "/incassi",
      };
    }

    case "elenco_spese": {
      const who = await personId(db, s("persona"), meId);
      let q = db.from("expenses").select("spent_on, description, amount_cents, category, supplier, paid_with, reimbursed_on, person:profiles!expenses_paid_by_fkey(full_name), project:projects(code, name), subscription_id").is("deleted_at", null).order("spent_on", { ascending: false }).limit(500);
      if (s("dal")) q = q.gte("spent_on", s("dal")!);
      if (s("al")) q = q.lte("spent_on", s("al")!);
      if (who) q = q.eq("paid_by", who);
      if (s("categoria")) q = q.eq("category", s("categoria") as "software");
      if (input.solo_da_rimborsare) q = q.eq("paid_with", "personale").is("reimbursed_on", null);
      const { data, error } = await q;
      if (error || !data) return { errore: error?.message ?? "Nessun dato" };
      type Row = (typeof data)[number];
      const sum = (f: (e: Row) => string) =>
        Object.fromEntries(Object.entries(data.reduce<Record<string, number>>((m, e) => ((m[f(e)] = (m[f(e)] ?? 0) + e.amount_cents), m), {})).map(([k, v]) => [k, eur(v)]));
      return {
        totale_eur: eur(data.reduce((a, e) => a + e.amount_cents, 0)),
        per_categoria_eur: sum((e) => e.category),
        per_persona_eur: sum((e) => e.person?.full_name ?? "—"),
        spese: data.slice(0, 80).map((e) => ({
          data: e.spent_on,
          descrizione: e.description,
          importo_eur: eur(e.amount_cents),
          categoria: e.category,
          fornitore: e.supplier,
          pagata_da: e.person?.full_name,
          di_tasca_propria: e.paid_with === "personale",
          rimborsata: !!e.reimbursed_on,
          abbonamento: !!e.subscription_id,
          progetto: e.project ? `${e.project.code} ${e.project.name}` : null,
        })),
        link: "/spese",
      };
    }

    case "elenco_abbonamenti": {
      const { data, error } = await db.from("expense_subscriptions").select("name, supplier, amount_cents, frequency, next_charge_date, end_date, active, charges_count, person:profiles!expense_subscriptions_paid_by_fkey(full_name), expenses(amount_cents)").is("deleted_at", null);
      if (error) return { errore: error.message };
      const perYear: Record<string, number> = { mensile: 12, trimestrale: 4, semestrale: 2, annuale: 1, biennale: 0.5 };
      return data.map((x) => ({
        nome: x.name,
        fornitore: x.supplier,
        importo_eur: eur(x.amount_cents),
        frequenza: x.frequency,
        al_mese_eur: eur((x.amount_cents * perYear[x.frequency]!) / 12),
        attivo: x.active,
        prossimo_addebito: x.active ? x.next_charge_date : null,
        terminato_il: x.end_date,
        pagato_da: x.person?.full_name,
        speso_finora_eur: eur(x.expenses.reduce((a, e) => a + e.amount_cents, 0)),
      }));
    }

    case "elenco_scadenze": {
      const days = typeof input.entro_giorni === "number" ? input.entro_giorni : 60;
      const until = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
      const { data, error } = await db.from("renewals").select("id, name, type, provider, frequency, next_due_date, cost_cents, price_cents, auto_renew, client:clients(name)").eq("active", true).is("deleted_at", null).lte("next_due_date", until).order("next_due_date");
      if (error) return { errore: error.message };
      return data.map((r) => ({
        nome: r.name,
        tipo: r.type,
        fornitore: r.provider,
        cliente: r.client?.name ?? "interno",
        scadenza: r.next_due_date,
        scaduta: r.next_due_date < today(),
        costo_eur: eur(r.cost_cents),
        prezzo_cliente_eur: eur(r.price_cents),
        rinnovo_automatico: r.auto_renew,
        link: `/scadenze?aperto=${r.id}`,
      }));
    }

    case "elenco_preventivi": {
      const { data, error } = await db.from("quotes").select("id, number, title, status, issue_date, valid_until, vat_rate, discount_cents, refused_reason, client:clients(name), lead:leads(title, company_name), quote_items(quantity, unit_price_cents, frequency)").is("deleted_at", null).order("issue_date", { ascending: false }).limit(200);
      if (error) return { errore: error.message };
      return data
        .map((q) => {
          const t = quoteTotals(q.quote_items, q.discount_cents, q.vat_rate);
          return {
            numero: q.number,
            titolo: q.title,
            stato: displayState(q),
            per: q.client?.name ?? q.lead?.company_name ?? q.lead?.title,
            data: q.issue_date,
            valido_fino: q.valid_until,
            totale_ivato_eur: eur(t.total),
            canoni_annui_eur: eur(t.recurringYearly),
            motivo_rifiuto: q.refused_reason,
            link: `/preventivi/${q.id}`,
          };
        })
        .filter((q) => !s("stato") || q.stato === s("stato"));
    }

    case "listino": {
      let q = db.from("services").select("name, description, category, unit, price_cents, frequency").eq("active", true).is("deleted_at", null).order("category").order("position");
      if (s("testo")) q = q.or(`name.ilike.${like(s("testo")!)},description.ilike.${like(s("testo")!)}`);
      const { data, error } = await q;
      if (error) return { errore: error.message };
      return { servizi: data.map((x) => ({ ...x, prezzo_eur: eur(x.price_cents), price_cents: undefined })), link: "/listino" };
    }

    case "persone": {
      const { data } = await db.from("profiles").select("full_name, role, job_title, email").eq("active", true).order("full_name");
      return data;
    }

    default:
      return { errore: `Strumento sconosciuto: ${name}` };
  }
}

/** Etichetta mostrata all'utente mentre lo strumento lavora */
export const TOOL_LABEL: Record<string, string> = {
  riepilogo: "Guardo i numeri di oggi",
  cerca: "Cerco nel gestionale",
  elenco_clienti: "Leggo i clienti",
  dettaglio_cliente: "Apro la scheda cliente",
  elenco_progetti: "Leggo i progetti",
  dettaglio_progetto: "Apro il progetto",
  elenco_task: "Leggo i task",
  elenco_lead: "Leggo la pipeline",
  situazione_incassi: "Controllo gli incassi",
  elenco_spese: "Controllo le spese",
  elenco_abbonamenti: "Leggo gli abbonamenti",
  elenco_scadenze: "Controllo le scadenze",
  elenco_preventivi: "Leggo i preventivi",
  listino: "Leggo il listino",
  persone: "Guardo il team",
};
