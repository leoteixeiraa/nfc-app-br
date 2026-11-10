import { HttpClient } from '@angular/common/http';
import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { catchError, EMPTY, filter, fromEvent, merge, of, Subject, switchMap } from 'rxjs';
import { AuthSessionStore } from '../auth/auth-session.store';
import { AnalyticsService } from '../analytics/analytics.service';

interface CurrentPlan {
  code: string;
  name: string;
  status: string;
  premium: boolean;
  expiresAt?: string | null;
}

function isCurrentPlan(value: unknown): value is CurrentPlan {
  if (typeof value !== 'object' || value === null) return false;
  const plan = value as Record<string, unknown>;
  return typeof plan['code'] === 'string' && plan['code'].length > 0
    && typeof plan['name'] === 'string' && plan['name'].trim().length > 0
    && typeof plan['status'] === 'string'
    && typeof plan['premium'] === 'boolean'
    && (plan['expiresAt'] == null || typeof plan['expiresAt'] === 'string');
}

@Injectable({ providedIn: 'root' })
export class CurrentPlanService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(AuthSessionStore);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly analytics = inject(AnalyticsService);
  private readonly refreshRequests = new Subject<void>();
  private readonly plan = signal<{ userId: string; value: CurrentPlan } | null>(null);
  private readonly now = signal(Date.now());
  private readonly loading = signal(false);

  private readonly activePlan = computed(() => {
    const plan = this.plan();
    if (!plan || plan.userId !== this.session.currentUser()?.id) {
      return null;
    }
    const expiresAt = plan.value.expiresAt == null ? null : Date.parse(plan.value.expiresAt);
    if (plan.value.status !== 'ACTIVE'
        || (expiresAt !== null && (!Number.isFinite(expiresAt) || expiresAt <= this.now()))) {
      return null;
    }
    return plan.value;
  });
  readonly label = computed(() => this.activePlan()?.name ?? null);
  readonly isPremium = computed(() => this.activePlan()?.premium === true);
  readonly isLoading = this.loading.asReadonly();

  refresh(): void {
    this.refreshRequests.next();
  }

  // O evento só dispara quando o servidor passa a confirmar um plano premium ativo
  // que antes não estava ativo; o último estado confirmado fica salvo por usuário.
  private trackSubscriptionStart(userId: string, plan: CurrentPlan): void {
    const expiresAt = plan.expiresAt == null ? null : Date.parse(plan.expiresAt);
    const active = plan.status === 'ACTIVE' && plan.premium && (expiresAt === null || expiresAt > Date.now());
    const storageKey = `nfc.plan.premium.${userId}`;
    try {
      const previous = localStorage.getItem(storageKey);
      localStorage.setItem(storageKey, active ? 'true' : 'false');
      if (active && previous === 'false') {
        this.analytics.track('subscription_started', { plan_code: plan.code }, { dedupeKey: `${userId}:${plan.code}` });
      }
    } catch {
      // Sem armazenamento, não há como distinguir nova assinatura de plano já existente.
    }
  }

  constructor() {
    effect((onCleanup) => {
      const userId = this.session.currentUser()?.id;
      this.plan.set(null);
      this.loading.set(false);
      if (!userId) {
        return;
      }

      let expirationTimer: ReturnType<typeof setTimeout> | undefined;
      const focus = this.document.defaultView
        ? fromEvent(this.document.defaultView, 'focus')
        : EMPTY;
      const subscription = merge(
        of(null),
        this.router.events.pipe(filter((event) => event instanceof NavigationEnd)),
        focus,
        this.refreshRequests,
      ).pipe(
        switchMap(() => {
          if (expirationTimer !== undefined) {
            clearTimeout(expirationTimer);
            expirationTimer = undefined;
          }
          this.loading.set(true);
          this.plan.set(null);
          return this.http.get<unknown>('/api/organizations/current/plan').pipe(
            catchError((error: unknown) => {
              this.plan.set(null);
              this.loading.set(false);
              console.error('Não foi possível carregar o plano da conta.', error);
              return EMPTY;
            }),
          );
        }),
      ).subscribe({
        next: (value) => {
          this.now.set(Date.now());
          this.loading.set(false);
          if (!isCurrentPlan(value)
              || !['ACTIVE', 'CANCELLED', 'EXPIRED'].includes(value.status)
              || (value.expiresAt != null && !Number.isFinite(Date.parse(value.expiresAt)))) {
            console.error('A API retornou um plano ou assinatura inválido.', value);
            this.plan.set(null);
            return;
          }
          this.plan.set({ userId, value });
          this.trackSubscriptionStart(userId, value);
          if (value.expiresAt != null) {
            const expiration = Date.parse(value.expiresAt);
            const scheduleExpiration = () => {
              const remaining = expiration - Date.now();
              if (!Number.isFinite(remaining) || remaining <= 0) {
                this.now.set(Date.now());
                return;
              }
              expirationTimer = setTimeout(scheduleExpiration, Math.min(remaining, 2_147_483_647));
            };
            scheduleExpiration();
          }
        },
      });

      onCleanup(() => {
        subscription.unsubscribe();
        if (expirationTimer !== undefined) {
          clearTimeout(expirationTimer);
        }
      });
    });
  }
}
