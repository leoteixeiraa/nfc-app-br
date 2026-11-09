import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PlansApiService } from './plans-api.service';

describe('PlansApiService', () => {
  let service: PlansApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PlansApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PlansApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('consulta o catálogo de planos ativos pelo endpoint relativo da API', () => {
    const response = [{ code: 'FREE', name: 'Start', price: 0, billingPeriod: 'NONE', features: [] }];
    service.list().subscribe((plans) => expect(plans).toEqual(response));

    http.expectOne('/api/plans').flush(response);
  });

  it('consulta o plano associado à organização atual', () => {
    const response = {
      code: 'FREE',
      name: 'Start',
      status: 'ACTIVE',
      startedAt: '2026-01-01T00:00:00Z',
      expiresAt: null,
      premium: false,
      features: [],
      publishedTags: 0,
    };
    service.current().subscribe((plan) => expect(plan).toEqual(response));

    http.expectOne('/api/organizations/current/plan').flush(response);
  });
});
