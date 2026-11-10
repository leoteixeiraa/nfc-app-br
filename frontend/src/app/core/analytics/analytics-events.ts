/**
 * Catálogo único de eventos do GA4. Para criar um novo evento, adicione-o aqui
 * (parâmetros somente não identificáveis) e chame `AnalyticsService.track(...)`
 * após a confirmação de sucesso da operação.
 */
export type AuthMethod = 'google';
export type NfcTagKind = 'url' | 'whatsapp' | 'pix' | 'google-review' | string;

export interface AnalyticsEventMap {
  sign_up: { method: AuthMethod };
  login: { method: AuthMethod };
  nfc_tag_created: { tag_type: NfcTagKind };
  nfc_tag_updated: { tag_type: NfcTagKind };
  subscription_started: { plan_code: string };
}

export type AnalyticsEventName = keyof AnalyticsEventMap;

export interface TrackOptions {
  /** Chave de deduplicação: o mesmo valor nunca dispara o evento duas vezes na sessão. */
  dedupeKey?: string;
}
