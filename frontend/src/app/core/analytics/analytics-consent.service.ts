import { Injectable, signal } from '@angular/core';

export type AnalyticsConsentStatus = 'granted' | 'denied' | 'unset';

const STORAGE_KEY = 'nfc.analytics.consent';

@Injectable({ providedIn: 'root' })
export class AnalyticsConsentService {
  private readonly state = signal<AnalyticsConsentStatus>(this.read());

  readonly status = this.state.asReadonly();

  grant(): void {
    this.update('granted');
  }

  deny(): void {
    this.update('denied');
  }

  private update(status: Exclude<AnalyticsConsentStatus, 'unset'>): void {
    try {
      localStorage.setItem(STORAGE_KEY, status);
    } catch {
      // Sem armazenamento disponível: a escolha vale apenas nesta sessão.
    }
    this.state.set(status);
  }

  private read(): AnalyticsConsentStatus {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value === 'granted' || value === 'denied' ? value : 'unset';
    } catch {
      return 'unset';
    }
  }
}
