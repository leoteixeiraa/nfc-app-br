import { DOCUMENT } from '@angular/common';
import { effect, inject, Injectable, Injector, untracked } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AnalyticsConsentService } from './analytics-consent.service';
import { AnalyticsEventMap, AnalyticsEventName, TrackOptions } from './analytics-events';

type GtagWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/**
 * Ponto único de integração com o GA4 (gtag.js).
 * - Só carrega o script e envia dados com consentimento de analytics (LGPD).
 * - Desabilitado em localhost ou sem Measurement ID no ambiente.
 * - Pageviews automáticos por navegação, sem duplicidade; sem query string/fragmento.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly consent = inject(AnalyticsConsentService);
  private readonly measurementId = environment.analytics.measurementId;
  private readonly sentKeys = new Set<string>();
  private started = false;
  private loaded = false;
  private lastPagePath: string | null = null;
  private currentPath: string | null = null;

  /** Falso em localhost ou sem Measurement ID: nada é carregado nem exibido. */
  get enabled(): boolean {
    return this.isEnabled();
  }

  /** Inicia o rastreamento; chamar uma única vez no bootstrap. */
  init(): void {
    if (this.started || !this.isEnabled()) {
      return;
    }
    this.started = true;

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.currentPath = this.pathOf(event.urlAfterRedirects);
        this.trackPageView();
      });

    effect(() => {
      const status = this.consent.status();
      untracked(() => this.onConsentChange(status));
    }, { injector: this.injector });
  }

  /** Registra um evento tipado. Deve ser chamado somente após confirmação de sucesso. */
  track<K extends AnalyticsEventName>(name: K, params: AnalyticsEventMap[K], options: TrackOptions = {}): void {
    if (!this.canSend()) {
      return;
    }
    if (options.dedupeKey) {
      const key = `${name}:${options.dedupeKey}`;
      if (this.sentKeys.has(key)) {
        return;
      }
      this.sentKeys.add(key);
    }
    this.gtag('event', name, params);
  }

  private trackPageView(): void {
    if (!this.canSend() || !this.currentPath || this.currentPath === this.lastPagePath) {
      return;
    }
    this.lastPagePath = this.currentPath;
    const location = this.document.location;
    this.gtag('event', 'page_view', {
      page_path: this.currentPath,
      page_location: `${location.origin}${this.currentPath}`,
      page_title: this.document.title,
    });
  }

  private onConsentChange(status: string): void {
    if (status === 'granted') {
      this.load();
      this.gtag('consent', 'update', { analytics_storage: 'granted' });
      this.trackPageView();
    } else if (this.loaded) {
      this.gtag('consent', 'update', { analytics_storage: 'denied' });
    }
  }

  private load(): void {
    if (this.loaded) {
      return;
    }
    this.loaded = true;
    const win = this.window();
    win.dataLayer = win.dataLayer ?? [];
    win.gtag = function gtag(): void {
      // gtag.js exige o objeto `arguments`, não um array.
      // eslint-disable-next-line prefer-rest-params
      win.dataLayer!.push(arguments);
    };
    this.gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    this.gtag('js', new Date());
    this.gtag('config', this.measurementId, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });

    const script = this.document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(this.measurementId)}`;
    this.document.head.appendChild(script);
  }

  private gtag(...args: unknown[]): void {
    this.window().gtag?.(...args);
  }

  private canSend(): boolean {
    return this.started && this.loaded && this.consent.status() === 'granted';
  }

  private isEnabled(): boolean {
    const host = this.document.location?.hostname ?? '';
    return !!this.measurementId && !!this.document.defaultView && !LOCAL_HOSTS.has(host);
  }

  private pathOf(url: string): string {
    return url.split(/[?#]/)[0] || '/';
  }

  private window(): GtagWindow {
    return this.document.defaultView as GtagWindow;
  }
}
