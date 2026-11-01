"use client";

/**
 * Aggiorna l'URL senza chiedere una nuova pagina al server.
 * Per parametri solo di interfaccia (pannello aperto, vista, dialog "nuovo"):
 * useSearchParams si aggiorna subito e il pannello si apre all'istante.
 */
export function replaceUrl(path: string) {
  window.history.replaceState(null, "", path);
}
