import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AnalyticsConsentService } from './analytics-consent.service';
import { AnalyticsService } from './analytics.service';

@Component({
  selector: 'app-analytics-consent-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (consent.status() === 'unset' && enabled) {
      <div
        role="dialog"
        aria-live="polite"
        aria-label="Preferências de privacidade"
        class="fixed inset-x-3 bottom-3 z-99999 mx-auto max-w-xl rounded-xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-800 dark:bg-gray-900"
      >
        <p class="text-sm text-gray-700 dark:text-gray-300">
          Usamos o Google Analytics para medir o uso do NFC.APP e melhorar a experiência. Nenhum dado pessoal é enviado.
          Você aceita o uso de cookies de análise?
        </p>
        <div class="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300" (click)="consent.deny()">Recusar</button>
          <button type="button" class="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600" (click)="consent.grant()">Aceitar</button>
        </div>
      </div>
    }
  `,
})
export class AnalyticsConsentBannerComponent {
  protected readonly consent = inject(AnalyticsConsentService);
  protected readonly enabled = inject(AnalyticsService).enabled;
}
