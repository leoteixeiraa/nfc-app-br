import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AuthSessionStore } from '../auth/auth-session.store';
import { CurrentPlanService } from './current-plan.service';

describe('CurrentPlanService', () => {
  let session: AuthSessionStore;
  let plans: CurrentPlanService;
  let http: HttpTestingController;
  let navigation: Subject<NavigationEnd>;
  const user = { id: '1', name: 'Pessoa', email: 'pessoa@example.com', pictureUrl: null };
  const url = '/api/organizations/current/plan';

  beforeEach(() => {
    navigation = new Subject<NavigationEnd>();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: { events: navigation.asObservable() } },
      ],
    });
    session = TestBed.inject(AuthSessionStore);
    plans = TestBed.inject(CurrentPlanService);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick();
  });

  afterEach(() => http.verify());

  it('mostra o plano real apenas para uma assinatura ativa e válida', () => {
    session.setUser(user);
    TestBed.tick();
    expect(plans.isPremium()).toBeFalse();
    http.expectOne(url).flush({ code: 'PRO', name: 'Pro', status: 'ACTIVE', premium: true, expiresAt: null });
    expect(plans.isPremium()).toBeTrue();
    expect(plans.label()).toBe('Pro');

    session.setUser(null);
    expect(plans.isPremium()).toBeFalse();
    expect(plans.label()).toBeNull();
    TestBed.tick();
  });

  it('reconhece Pro ativo quando o backend omite o vencimento nulo', () => {
    session.setUser(user);
    TestBed.tick();
    http.expectOne(url).flush({ code: 'PRO', name: 'Pro', status: 'ACTIVE', premium: true });
    expect(plans.isPremium()).toBeTrue();
  });

  for (const plan of [
    { code: 'FREE', name: 'Start', status: 'ACTIVE', premium: false, expiresAt: null },
    { code: 'PRO', name: 'Pro', status: 'CANCELLED', premium: true, expiresAt: null },
    { code: 'PRO', name: 'Pro', status: 'ACTIVE', premium: true, expiresAt: '2020-01-01T00:00:00Z' },
    { code: 'PRO', name: 'Pro', status: 'ACTIVE', premium: true, expiresAt: 'inválido' },
  ]) {
    it(`não aplica Pro para ${JSON.stringify(plan)}`, () => {
      session.setUser(user);
      TestBed.tick();
      http.expectOne(url).flush(plan);
      expect(plans.isPremium()).toBeFalse();
    });
  }

  it('usa o nome e a classificação premium do backend para planos futuros', () => {
    session.setUser(user);
    TestBed.tick();
    http.expectOne(url).flush({
      code: 'BUSINESS', name: 'Business', status: 'ACTIVE', premium: true,
    });
    expect(plans.label()).toBe('Business');
    expect(plans.isPremium()).toBeTrue();
  });

  it('remove o estilo ao vencer a assinatura', fakeAsync(() => {
    session.setUser(user);
    TestBed.tick();
    http.expectOne(url).flush({
      code: 'PRO', name: 'Pro', status: 'ACTIVE', premium: true,
      expiresAt: new Date(Date.now() + 1000).toISOString(),
    });
    expect(plans.isPremium()).toBeTrue();
    tick(1000);
    expect(plans.isPremium()).toBeFalse();
  }));

  it('não compartilha o plano entre contas e cancela a consulta anterior', () => {
    session.setUser(user);
    TestBed.tick();
    const first = http.expectOne(url);
    session.setUser({ ...user, id: '2' });
    expect(plans.isPremium()).toBeFalse();
    TestBed.tick();
    expect(first.cancelled).toBeTrue();
    http.expectOne(url).flush({ code: 'FREE', name: 'Start', status: 'ACTIVE', premium: false, expiresAt: null });
    expect(plans.isPremium()).toBeFalse();
    expect(plans.label()).toBe('Start');
  });

  it('registra falhas sem presumir uma assinatura Pro', () => {
    spyOn(console, 'error');
    session.setUser(user);
    TestBed.tick();
    http.expectOne(url).flush('Erro', { status: 500, statusText: 'Erro' });
    expect(console.error).toHaveBeenCalled();
    expect(plans.isPremium()).toBeFalse();
  });

  it('não presume um plano quando a resposta da API é inválida', () => {
    spyOn(console, 'error');
    session.setUser(user);
    TestBed.tick();
    http.expectOne(url).flush(null);
    expect(console.error).toHaveBeenCalled();
    expect(plans.label()).toBeNull();
    expect(plans.isLoading()).toBeFalse();
  });

  it('atualiza o avatar após uma mudança de plano ao navegar', () => {
    session.setUser(user);
    TestBed.tick();
    http.expectOne(url).flush({ code: 'FREE', name: 'Start', status: 'ACTIVE', premium: false, expiresAt: null });
    expect(plans.isPremium()).toBeFalse();

    navigation.next(new NavigationEnd(1, '/profile', '/profile'));
    http.expectOne(url).flush({ code: 'PRO', name: 'Pro', status: 'ACTIVE', premium: true, expiresAt: null });
    expect(plans.isPremium()).toBeTrue();

    navigation.next(new NavigationEnd(2, '/', '/'));
    http.expectOne(url).flush({ code: 'FREE', name: 'Start', status: 'ACTIVE', premium: false, expiresAt: null });
    expect(plans.isPremium()).toBeFalse();
  });

  it('atualiza o plano ao voltar à janela e cancela consultas anteriores', () => {
    session.setUser(user);
    TestBed.tick();
    const previous = http.expectOne(url);
    window.dispatchEvent(new Event('focus'));
    expect(previous.cancelled).toBeTrue();
    http.expectOne(url).flush({ code: 'PRO', name: 'Pro', status: 'ACTIVE', premium: true, expiresAt: null });
    expect(plans.isPremium()).toBeTrue();
  });

  it('remove o estado Pro se a atualização falhar', () => {
    spyOn(console, 'error');
    session.setUser(user);
    TestBed.tick();
    http.expectOne(url).flush({ code: 'PRO', name: 'Pro', status: 'ACTIVE', premium: true, expiresAt: null });
    navigation.next(new NavigationEnd(1, '/profile', '/profile'));
    http.expectOne(url).flush('Erro', { status: 500, statusText: 'Erro' });
    expect(console.error).toHaveBeenCalled();
    expect(plans.isPremium()).toBeFalse();
    expect(plans.label()).toBeNull();
  });

  it('reconsulta quando o estado da assinatura é atualizado', () => {
    session.setUser(user);
    TestBed.tick();
    http.expectOne(url).flush({ code: 'FREE', name: 'Start', status: 'ACTIVE', premium: false });
    expect(plans.label()).toBe('Start');

    plans.refresh();
    expect(plans.isLoading()).toBeTrue();
    expect(plans.label()).toBeNull();
    http.expectOne(url).flush({ code: 'PRO', name: 'Pro', status: 'ACTIVE', premium: true });
    expect(plans.label()).toBe('Pro');
    expect(plans.isLoading()).toBeFalse();
  });
});
