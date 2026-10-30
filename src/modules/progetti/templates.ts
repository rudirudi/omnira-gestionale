import type { ProjectType } from "@/lib/database.types";

/** Task tipici per tipo di progetto, divisi per fase. Creati alla nascita del progetto. */
type Template = Partial<Record<"Analisi" | "Progettazione" | "Sviluppo" | "Test" | "Rilascio", string[]>>;

const WEB: Template = {
  Analisi: ["Call di kick-off con il cliente", "Raccolta contenuti e materiali", "Analisi concorrenti e parole chiave"],
  Progettazione: ["Sitemap e architettura informativa", "Wireframe pagine principali", "Mockup grafico e approvazione"],
  Sviluppo: ["Setup ambiente e repository", "Sviluppo pagine", "Integrazione form e analytics", "Ottimizzazione SEO on-page"],
  Test: ["Test responsive e browser", "Test performance (Core Web Vitals)", "Revisione contenuti con il cliente"],
  Rilascio: ["Configurazione dominio e SSL", "Pubblicazione", "Consegna accessi e formazione"],
};

export const PROJECT_TEMPLATES: Record<ProjectType, Template> = {
  sito: WEB,
  ecommerce: {
    ...WEB,
    Sviluppo: ["Setup Shopify / piattaforma", "Catalogo prodotti e categorie", "Pagamenti e spedizioni", "Email transazionali"],
    Test: ["Test ordine completo", "Test pagamenti in modalità test", "Test responsive"],
  },
  software: {
    Analisi: ["Workshop processi con il cliente", "Documento requisiti", "Stima e piano sprint"],
    Progettazione: ["Modello dati", "Prototipo cliccabile", "Architettura e scelte tecniche"],
    Sviluppo: ["Setup progetto, CI e ambienti", "Autenticazione e ruoli", "Moduli funzionali (sprint)"],
    Test: ["Test automatici dei flussi critici", "UAT con il cliente"],
    Rilascio: ["Migrazione dati", "Rilascio in produzione", "Formazione utenti e guide"],
  },
  gestionale: {
    Analisi: ["Mappatura processi attuali (Excel, email, WhatsApp)", "Documento requisiti", "Piano di migrazione dati"],
    Progettazione: ["Modello dati", "Prototipo delle schermate chiave"],
    Sviluppo: ["Setup progetto e ambienti", "Moduli MVP", "Import dati esistenti"],
    Test: ["UAT con gli utenti chiave"],
    Rilascio: ["Go-live", "Formazione", "Supporto post-rilascio (2 settimane)"],
  },
  app: {
    Analisi: ["Requisiti e user stories"],
    Progettazione: ["Flussi e mockup app", "Design system mobile"],
    Sviluppo: ["Setup React Native", "Schermate principali", "Notifiche push"],
    Test: ["Test su dispositivi iOS e Android"],
    Rilascio: ["Pubblicazione App Store", "Pubblicazione Google Play"],
  },
  automazione_ai: {
    Analisi: ["Mappatura del processo da automatizzare", "Raccolta esempi e documenti"],
    Progettazione: ["Disegno del flusso e dei casi limite"],
    Sviluppo: ["Prototipo automazione", "Integrazione con i sistemi del cliente", "Prompt e valutazione qualità"],
    Test: ["Test su casi reali", "Misura ore risparmiate"],
    Rilascio: ["Messa in produzione", "Monitoraggio primo mese"],
  },
  seo: {
    Analisi: ["Audit SEO tecnico", "Ricerca parole chiave"],
    Sviluppo: ["Ottimizzazioni on-page", "Piano contenuti mensile"],
    Rilascio: ["Report mensile"],
  },
  altro: {},
};
