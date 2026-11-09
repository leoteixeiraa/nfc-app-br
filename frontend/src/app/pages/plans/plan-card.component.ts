import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Plan, PlanFeature, planFeatureLabel } from './plan.models';

@Component({
  selector: 'app-plan-card',
  imports: [NgClass, RouterLink],
  templateUrl: './plan-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full' },
})
export class PlanCardComponent {
  @Input({ required: true }) plan!: Plan;
  @Input() current = false;
  @Input() signedIn = false;
  @Input() highlighted = false;
  @Input() startPlan: Plan | null = null;
  @Input() currentPlanCode: string | null = null;
  @Input() currentPlanStatus: string | null = null;
  @Input() currentStatus: string | null = null;

  readonly proCheckoutUrl = 'https://invoice.infinitepay.io/plans/nfc-app-br/zUHmSoJwQP';

  get includesStart(): boolean {
    if (this.plan.code !== 'PRO' || !this.startPlan) return false;
    const startFeatures = this.startPlan.features.filter((feature) => feature.enabled);
    return startFeatures.length > 0 && startFeatures.every((feature) => {
      const proFeature = this.plan.features.find((item) => item.code === feature.code && item.enabled);
      return proFeature !== undefined && (proFeature.unlimited
        || (feature.limit != null && proFeature.limit != null && proFeature.limit >= feature.limit));
    });
  }

  get visibleFeatures(): PlanFeature[] {
    const order = this.plan.code === 'PRO'
      ? ['PUBLISHED_TAGS', 'CLIENTS', 'DYNAMIC_LINKS', 'NFC_QR', 'BASIC_DASHBOARD']
      : ['PUBLISHED_TAGS', 'CLIENTS', 'NFC_QR', 'DYNAMIC_LINKS', 'BASIC_DASHBOARD'];
    const proBenefits = ['PUBLISHED_TAGS', 'CLIENTS', 'NFC_QR', 'DYNAMIC_LINKS'];
    return this.plan.features.filter((feature) => feature.enabled
      && (!this.includesStart || this.plan.code !== 'PRO' || proBenefits.includes(feature.code)))
      .sort((a, b) => {
        const aIndex = order.indexOf(a.code);
        const bIndex = order.indexOf(b.code);
        return (aIndex < 0 ? order.length : aIndex) - (bIndex < 0 ? order.length : bIndex);
      });
  }

  featureLabel(feature: PlanFeature): string {
    if (feature.code === 'PUBLISHED_TAGS') {
      if (feature.unlimited) return 'Cadastro de Placas NFC ilimitadas';
      if (feature.limit != null) return `Até ${feature.limit} placas publicadas`;
      return 'Placas NFC publicadas';
    }
    if (feature.code === 'CLIENTS' && this.plan.code === 'PRO' && feature.unlimited) {
      return 'Clientes ilimitados';
    }
    if (feature.code === 'DYNAMIC_LINKS' && this.plan.code === 'PRO') {
      return 'Links dinâmicos e editáveis';
    }
    return planFeatureLabel(feature.code);
  }

  currentLabel(): string {
    switch (this.currentStatus) {
      case 'CANCELLED':
        return 'Assinatura cancelada';
      case 'EXPIRED':
        return 'Assinatura expirada';
      case 'ACTIVE':
        return 'Seu plano atual';
      default:
        return '';
    }
  }

  priceLabel(): string {
    return this.plan.price === 0 ? 'Grátis' : new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(this.plan.price);
  }

  billingLabel(): string {
    if (this.plan.billingPeriod === 'MONTHLY') return '/mês';
    if (this.plan.billingPeriod === 'NONE') return '';
    return 'periodicidade não informada';
  }
}
