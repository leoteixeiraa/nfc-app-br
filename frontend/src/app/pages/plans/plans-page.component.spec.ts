import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { CurrentPlan, Plan } from './plan.models';
import { PlansPageComponent } from './plans-page.component';
import { PlansApiService } from './plans-api.service';

const availablePlans: Plan[] = [
  {
    code: 'FREE',
    name: 'Start',
    price: 0,
    billingPeriod: 'NONE',
    features: [
      { code: 'PUBLISHED_TAGS', enabled: true, entitled: true, limit: 3, unlimited: false },
      { code: 'CLIENTS', enabled: true, entitled: true, limit: null, unlimited: true },
      { code: 'NFC_QR', enabled: true, entitled: true, limit: null, unlimited: true },
      { code: 'DYNAMIC_LINKS', enabled: true, entitled: true, limit: null, unlimited: true },
      { code: 'BASIC_DASHBOARD', enabled: true, entitled: true, limit: null, unlimited: true },
    ],
  },
  {
    code: 'PRO',
    name: 'Pro',
    price: 29.9,
    billingPeriod: 'MONTHLY',
    features: [
      { code: 'PUBLISHED_TAGS', enabled: true, entitled: true, limit: null, unlimited: true },
      { code: 'CLIENTS', enabled: true, entitled: true, limit: null, unlimited: true },
      { code: 'NFC_QR', enabled: true, entitled: true, limit: null, unlimited: true },
      { code: 'DYNAMIC_LINKS', enabled: true, entitled: true, limit: null, unlimited: true },
      { code: 'BASIC_DASHBOARD', enabled: true, entitled: true, limit: null, unlimited: true },
      { code: 'SALES_DASHBOARD', enabled: false, entitled: true, limit: null, unlimited: false },
      { code: 'PDF_REPORTS', enabled: false, entitled: true, limit: null, unlimited: false },
      { code: 'GOOGLE_MAPS_PROSPECTING', enabled: false, entitled: true, limit: null, unlimited: false },
    ],
  },
];

const activePlan: CurrentPlan = {
  code: 'FREE',
  name: 'Start',
  status: 'ACTIVE',
  startedAt: '2026-01-01T00:00:00Z',
  expiresAt: null,
  premium: false,
  features: [{ code: 'PUBLISHED_TAGS', enabled: true, entitled: true, limit: 3, unlimited: false }],
  publishedTags: 2,
};

describe('PlansPageComponent', () => {
  let fixture: ComponentFixture<PlansPageComponent>;
  let plansApi: jasmine.SpyObj<PlansApiService>;
  let auth: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    plansApi = jasmine.createSpyObj<PlansApiService>('PlansApiService', ['list', 'current']);
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['getCurrentUser']);
    plansApi.list.and.returnValue(of(availablePlans));
    plansApi.current.and.returnValue(of(activePlan));
    auth.getCurrentUser.and.returnValue(of({ id: 'user-1', email: 'user@example.test', name: 'Teste', pictureUrl: null }));

    await TestBed.configureTestingModule({
      imports: [PlansPageComponent],
      providers: [
        provideRouter([]),
        { provide: PlansApiService, useValue: plansApi },
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PlansPageComponent);
    fixture.detectChanges();
  });

  it('exibe apenas os cards com preços, limites e recursos retornados pela API', () => {
    const content = fixture.nativeElement.textContent as string;
    const cards = fixture.nativeElement.querySelectorAll('app-plan-card') as NodeListOf<HTMLElement>;
    expect(cards.length).toBe(2);
    expect(content).toContain('Escolha o plano ideal para você');
    expect(content).toContain('Comece gratuitamente e evolua conforme suas vendas crescem.');
    expect(content).not.toContain('Seu plano atual');
    expect(cards[0].textContent).toContain('Grátis');
    expect(cards[0].textContent).toContain('Até 3 placas publicadas');
    expect(cards[0].textContent).toContain('Gestão de clientes');
    expect(cards[0].textContent).toContain('Gravação NFC e QR Code');
    expect(cards[0].textContent).toContain('Links dinâmicos');
    expect(cards[0].textContent).toContain('Dashboard básico');
    expect(cards[0].textContent).toContain('Para começar a vender.');
    expect(cards[0].textContent).not.toContain('sem cobrança');
    expect(cards[1].textContent).toContain('Venda placas sem limites.');
    expect(cards[1].textContent).toContain('29,90');
    expect(cards[1].textContent).toContain('/mês');
    expect(cards[1].textContent).toContain('Tudo do Start');
    expect(cards[1].textContent).toContain('Cadastro de Placas NFC ilimitadas');
    expect(cards[1].textContent).toContain('Clientes ilimitados');
    expect(cards[1].textContent).toContain('Gestão centralizada de placas e clientes');
    expect(cards[1].textContent).toContain('Links dinâmicos e editáveis');
    expect(cards[1].textContent).toContain('Gravação NFC e QR Code');
    expect(cards[1].textContent).not.toContain('Google Maps');
    expect(cards[1].textContent).not.toContain('inteligência artificial');
    expect(cards[1].textContent).not.toContain('Relatórios profissionais');
    expect(cards[1].textContent).not.toContain('Estatísticas de acessos');
    expect(cards[1].textContent).toContain('Recomendado');
    expect(cards[1].textContent).not.toContain('Em breve');
    expect(content).not.toContain('2 de 3 utilizadas');
    expect(fixture.nativeElement.querySelector('details')).toBeNull();
    expect(cards[0].querySelector('a[routerLink="/"]')?.textContent).toContain('Acessar o app');
    expect(cards[1].querySelector('a[href="https://invoice.infinitepay.io/plans/nfc-app-br/zUHmSoJwQP"]')?.textContent)
      .toContain('Assinar Pro');
    expect(cards[1].querySelector('a')?.getAttribute('target')).toBe('_blank');
    expect(cards[1].querySelector('a')?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('não consulta o plano da organização para visitantes', () => {
    auth.getCurrentUser.and.returnValue(of(null));
    plansApi.current.calls.reset();
    fixture.componentInstance.load();
    fixture.detectChanges();

    expect(plansApi.current).not.toHaveBeenCalled();
    expect(fixture.componentInstance.authenticated()).toBeFalse();
    const cards = fixture.nativeElement.querySelectorAll('app-plan-card') as NodeListOf<HTMLElement>;
    expect(cards[0].querySelector('a[routerLink="/signin"]')?.textContent).toContain('Começar grátis');
    expect(cards[1].querySelector('a[href="https://invoice.infinitepay.io/plans/nfc-app-br/zUHmSoJwQP"]')?.textContent)
      .toContain('Assinar Pro');
  });

  it('não permite voltar ao Start enquanto a assinatura Pro estiver ativa', () => {
    plansApi.current.and.returnValue(of({ ...activePlan, code: 'PRO', name: 'Pro', premium: true }));
    fixture.componentInstance.load();
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('app-plan-card') as NodeListOf<HTMLElement>;
    expect(cards[0].querySelector('button[disabled]')?.textContent).toContain('Cancele o Pro para voltar ao Start');
    expect(cards[0].querySelector('a')).toBeNull();
    expect(cards[1].querySelector('button[disabled]')?.textContent).toContain('Seu plano atual');
    expect(cards[1].querySelector('a[href="https://invoice.infinitepay.io/plans/nfc-app-br/zUHmSoJwQP"]')).toBeNull();
  });

  it('mantém o catálogo visível quando a conta não tem organização consultável', () => {
    spyOn(console, 'error');
    plansApi.current.and.returnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    fixture.componentInstance.load();
    fixture.detectChanges();

    expect(fixture.componentInstance.subscriptionError()).toBe('Não foi possível consultar sua assinatura.');
    expect(fixture.componentInstance.plans()).toEqual(availablePlans);
    expect(fixture.nativeElement.textContent).toContain('Não foi possível consultar sua assinatura.');
    expect(fixture.nativeElement.textContent).not.toContain('Seu plano atual');
    expect(fixture.nativeElement.querySelector('[role="alert"] button').textContent).toContain('Tentar novamente');
    expect(console.error).toHaveBeenCalled();
    plansApi.current.and.returnValue(of(activePlan));
    (fixture.nativeElement.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Acessar o app');
  });

  it('usa preços e limites atualizados, e mostra prospecção somente quando habilitada', () => {
    const pro = {
      ...availablePlans[1],
      price: 39.9,
      features: availablePlans[1].features.map(feature => ({
        ...feature,
        enabled: true,
        limit: feature.code === 'PUBLISHED_TAGS' ? 120 : feature.limit,
        unlimited: feature.code === 'PUBLISHED_TAGS' ? false : feature.unlimited,
      })),
    };
    plansApi.list.and.returnValue(of([pro, availablePlans[0]]));
    fixture.componentInstance.load();
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('app-plan-card') as NodeListOf<HTMLElement>;
    expect(cards[0].textContent).toContain('Start');
    expect(cards[1].textContent).toContain('39,90');
    expect(cards[1].textContent).toContain('Até 120 placas publicadas');
    expect(cards[1].textContent).not.toContain('Prospecção com Google Maps');
  });

  it('não promete todos os recursos Start quando algum não está habilitado no Pro', () => {
    const pro = {
      ...availablePlans[1],
      features: availablePlans[1].features.map(feature =>
        feature.code === 'CLIENTS' ? { ...feature, enabled: false } : feature),
    };
    plansApi.list.and.returnValue(of([availablePlans[0], pro]));
    fixture.componentInstance.load();
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelectorAll('app-plan-card')[1] as HTMLElement;
    expect(card.textContent).not.toContain('Tudo do Start');
    expect(card.textContent).not.toContain('Clientes ilimitados');
    expect(card.textContent).toContain('Gravação NFC e QR Code');
  });

  it('não anuncia recursos futuros ou indisponíveis dos planos', () => {
    const pro: Plan = {
      ...availablePlans[1],
      features: [
        ...availablePlans[1].features.filter(feature => feature.code !== 'SALES_DASHBOARD'),
        { code: 'SALES_DASHBOARD', enabled: false, entitled: true, limit: null, unlimited: false },
        { code: 'ACCESS_STATISTICS', enabled: false, entitled: true, limit: null, unlimited: false },
        { code: 'AI_SUGGESTIONS', enabled: false, entitled: false, limit: null, unlimited: false },
      ],
    };
    plansApi.list.and.returnValue(of([availablePlans[0], pro]));
    fixture.componentInstance.load();
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelectorAll('app-plan-card')[1] as HTMLElement;
    expect(card.textContent).not.toContain('Dashboard de vendas');
    expect(card.textContent).not.toContain('Estatísticas de acessos');
    expect(card.textContent).not.toContain('Relatórios profissionais em PDF');
    expect(card.textContent).not.toContain('Sugestões com inteligência artificial');
  });

  it('mantém os cards responsivos com estilos de tema claro e escuro', () => {
    const section = fixture.nativeElement.querySelector('section[aria-label="Planos disponíveis"]') as HTMLElement;
    const cards = fixture.nativeElement.querySelectorAll('app-plan-card article') as NodeListOf<HTMLElement>;
    expect(section.classList).toContain('md:grid-cols-2');
    expect(cards.length).toBe(2);
    for (const card of cards) {
      expect(card.classList).toContain('bg-white');
      expect(card.classList).toContain('dark:bg-gray-900');
      expect(card.classList).toContain('sm:p-7');
    }
    expect(cards[1].classList).toContain('border-brand-500');
    expect(cards[1].classList).toContain('dark:border-brand-500');
  });

  it('confirma o Pro somente quando a assinatura ativa corresponde ao plano', () => {
    plansApi.current.and.returnValue(of({ ...activePlan, code: 'PRO', name: 'Pro' }));
    fixture.componentInstance.load();
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('app-plan-card') as NodeListOf<HTMLElement>;
    expect(cards[0].querySelector('button[disabled]')?.textContent).toContain('Cancele o Pro para voltar ao Start');
    expect(cards[1].querySelector('button[disabled]')?.textContent).toContain('Seu plano atual');
  });

  it('reconhece assinatura sem vencimento omitido pelo backend', () => {
    const { expiresAt, ...semVencimento } = activePlan;
    plansApi.current.and.returnValue(of({ ...semVencimento, code: 'PRO', name: 'Pro' }));
    fixture.componentInstance.load();
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelectorAll('app-plan-card')[1] as HTMLElement;
    expect(card.querySelector('button[disabled]')?.textContent).toContain('Seu plano atual');
    expect(fixture.componentInstance.subscriptionError()).toBe('');
  });

  it('compara recursos sem limite omitido e não exibe limites indefinidos', () => {
    const withoutLimits = availablePlans.map(plan => ({
      ...plan,
      features: plan.features.map(feature => {
        if (feature.limit !== null) return feature;
        const { limit, ...withoutLimit } = feature;
        return withoutLimit;
      }),
    }));
    plansApi.list.and.returnValue(of(withoutLimits));
    fixture.componentInstance.load();
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('app-plan-card') as NodeListOf<HTMLElement>;
    expect(cards[1].textContent).toContain('Tudo do Start');
    expect(fixture.nativeElement.textContent).not.toContain('undefined');

    const unlimited = withoutLimits.map(plan => ({
      ...plan,
      features: plan.features.map(feature =>
        plan.code === 'PRO' && feature.code === 'PUBLISHED_TAGS'
          ? { code: feature.code, enabled: true, entitled: true, unlimited: true }
          : feature),
    }));
    plansApi.list.and.returnValue(of(unlimited));
    fixture.componentInstance.load();
    fixture.detectChanges();
    expect(cards[1].textContent).toContain('Cadastro de Placas NFC ilimitadas');
    expect(cards[1].textContent).not.toContain('Até undefined');
  });

  it('trata resposta inválida da assinatura como erro, sem assumir um plano', () => {
    spyOn(console, 'error');
    plansApi.current.and.returnValue(of({ ...activePlan, expiresAt: 'inválido' }));
    fixture.componentInstance.load();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Não foi possível consultar sua assinatura.');
    expect(fixture.nativeElement.textContent).not.toContain('Seu plano atual');
    expect(console.error).toHaveBeenCalled();
  });

  it('não apresenta assinaturas canceladas como ativas', () => {
    plansApi.current.and.returnValue(of({ ...activePlan, status: 'CANCELLED' }));
    fixture.componentInstance.load();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Assinatura cancelada');
    expect(fixture.nativeElement.textContent).not.toContain('Seu plano atual');
  });

  it('não apresenta como ativa uma assinatura vencida', () => {
    plansApi.current.and.returnValue(of({ ...activePlan, expiresAt: '2020-01-01T00:00:00Z' }));
    fixture.componentInstance.load();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Assinatura expirada');
    expect(fixture.nativeElement.textContent).not.toContain('Seu plano atual');
  });

  it('apresenta estados de carregamento, erro e catálogo vazio', () => {
    const response = new Subject<Plan[]>();
    plansApi.list.and.returnValue(response);
    fixture.componentInstance.load();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-busy="true"]')).not.toBeNull();
    response.error(new Error('offline'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Não foi possível exibir os planos');
    plansApi.list.and.returnValue(of([]));
    fixture.componentInstance.load();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nenhum plano disponível no momento');
    expect(fixture.nativeElement.querySelector('app-plan-card')).toBeNull();
  });
});
