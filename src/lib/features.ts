/**
 * Interruttori delle funzioni opzionali.
 * Assistente virtuale: spento finché non si decide di caricare credito sull'API Anthropic.
 * Per riaccenderlo: true qui (oppure ASSISTANT_ENABLED=true su Vercel) + chiave ANTHROPIC_API_KEY.
 */
export const FEATURES = {
  assistant: process.env.ASSISTANT_ENABLED === "true" || false,
};
