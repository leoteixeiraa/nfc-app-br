import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { catchError, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { CurrentPlan, Plan } from './plan.models';
import { PlanCardComponent } from './plan-card.component';
import { PlansApiService } from './plans-api.service';

@Component({
  selector: 'app-plans-page',
  imports: [PlanCardComponent],
  templateUrl: './plans-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class PlansPageComponent {
  private readonly plansApi = inject(PlansApiService);
  private readonly auth = inject(AuthService);

  readonly plans = signal<Plan[]>([]);
  readonly currentPlan = signal<CurrentPlan | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly authenticated = signal(false);
  readonly subscriptionError = signal('');
  readonly startPlan = computed(() => this.plans().find((plan) => plan.code === 'FREE') ?? null);
  readonly displayedPlans = computed(() =>
    ['FREE', 'PRO'].flatMap((code) => this.plans().filter((plan) => plan.code === code)),
  );

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.subscriptionError.set('');
    this.currentPlan.set(null);

    forkJoin({
      plans: this.plansApi.list(),
      user: this.auth.getCurrentUser(),
    }).pipe(
      switchMap(({ plans, user }) => {
        this.plans.set(plans);
        this.authenticated.set(user !== null);
        if (!user) {
          return of({ currentPlan: null, subscriptionError: '' });
        }
        return this.plansApi.current().pipe(
          map((currentPlan) => {
            const expiresAt = currentPlan.expiresAt == null ? null : Date.parse(currentPlan.expiresAt);
            if (expiresAt !== null && !Number.isFinite(expiresAt)) {
              console.error('A API retornou uma data de vencimento inválida para a assinatura.');
              return { currentPlan: null, subscriptionError: 'Não foi possível consultar sua assinatura.' };
            }
            if (!['ACTIVE', 'CANCELLED', 'EXPIRED'].includes(currentPlan.status)) {
              console.error('A API retornou um status de assinatura desconhecido:', currentPlan.status);
              return { currentPlan: null, subscriptionError: 'Não foi possível consultar sua assinatura.' };
            }
            return { currentPlan, subscriptionError: '' };
          }),
          catchError((error: unknown) => {
            console.error('Não foi possível consultar a assinatura.', error);
            return of({ currentPlan: null, subscriptionError: 'Não foi possível consultar sua assinatura.' });
          }),
        );
      }),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: ({ currentPlan, subscriptionError }) => {
        this.currentPlan.set(currentPlan);
        this.subscriptionError.set(subscriptionError);
      },
      error: () => {
        this.error.set('Não foi possível carregar os planos agora. Verifique sua conexão e tente novamente.');
      },
    });
  }

  currentStatus(plan: Plan): string | null {
    const current = this.currentPlan();
    if (!current || current.code !== plan.code) return null;
    return this.resolvedStatus(current);
  }

  currentPlanStatus(): string | null {
    const current = this.currentPlan();
    return current ? this.resolvedStatus(current) : null;
  }

  private resolvedStatus(current: CurrentPlan): string {
    if (current.status === 'ACTIVE' && current.expiresAt != null) {
      const expiresAt = Date.parse(current.expiresAt);
      if (expiresAt <= Date.now()) return 'EXPIRED';
    }
    return current.status;
  }
}
