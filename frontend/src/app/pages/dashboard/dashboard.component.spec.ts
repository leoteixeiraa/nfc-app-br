import { Component, Input } from '@angular/core';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthSessionStore } from '../../core/auth/auth-session.store';
import { LocalClientsService } from '../../core/clients/local-clients.service';
import { LOCAL_TAGS_STORAGE_KEY, LocalTagsService } from '../../core/tags/local-tags.service';
import { TagAccountSyncService } from '../../core/tags/tag-account-sync.service';
import { NfcTag } from '../../core/tags/nfc-tag';
import { BarChartOneComponent } from '../charts/components/bar/bar-chart-one/bar-chart-one.component';
import { LineChartOneComponent } from '../charts/components/line/line-chart-one/line-chart-one.component';
import { DashboardComponent } from './dashboard.component';

@Component({ selector: 'app-line-chart-one', template: '' })
class LineChartStub {
  @Input() dashboardData?: { categories: string[]; values: number[] };
}

@Component({ selector: 'app-bar-chart-one', template: '' })
class BarChartStub {
  @Input() dashboardData?: { categories: string[]; values: number[] };
}

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let tags: jasmine.SpyObj<LocalTagsService>;
  let clients: jasmine.SpyObj<LocalClientsService>;
  const date = new Date();
  const tag: NfcTag = {
    id: 'placa', name: 'Loja', type: 'url', destinationUrl: 'https://example.com',
    createdAt: date.toISOString(), updatedAt: date.toISOString(), salePrice: 49.9, active: true,
  };

  beforeEach(async () => {
    tags = jasmine.createSpyObj('LocalTagsService', ['list']);
    clients = jasmine.createSpyObj('LocalClientsService', ['list']);
    tags.list.and.returnValue([tag]);
    clients.list.and.returnValue([]);
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        { provide: LocalTagsService, useValue: tags },
        { provide: LocalClientsService, useValue: clients },
        { provide: TagAccountSyncService, useValue: {
          status: signal('synced'), pendingImportCount: signal(0), error: signal(''), retry: jasmine.createSpy(),
        } },
      ],
    }).overrideComponent(DashboardComponent, {
      remove: { imports: [LineChartOneComponent, BarChartOneComponent] },
      add: { imports: [LineChartStub, BarChartStub] },
    }).compileComponents();
    fixture = TestBed.createComponent(DashboardComponent);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('exibe os dados locais e o acesso à listagem', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('R$ 49,90');
    expect(text).toContain('Loja');
    expect(text).toContain('Suas placas estão salvas neste dispositivo. Crie uma conta para gerenciá-las com mais segurança.');
    expect(text).not.toContain('Dados de exemplo');
    expect(fixture.nativeElement.querySelector('a[href="/tags"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/tags/placa/edit"]')).not.toBeNull();
  });

  it('apresenta boas-vindas e dados de exemplo quando não há dados reais', () => {
    tags.list.and.returnValue([]);
    fixture.componentInstance.onStorage(new StorageEvent('storage', { key: LOCAL_TAGS_STORAGE_KEY }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nenhuma placa cadastrada neste período.');
    expect(fixture.nativeElement.textContent).toContain('Bem-vindo ao NFC.APP');
    expect(fixture.nativeElement.textContent).toContain('Dados de exemplo');
    expect(fixture.nativeElement.textContent).toContain('R$ 2.600,00');
    expect(fixture.nativeElement.textContent).toContain('Criar minha primeira placa');
    expect(fixture.nativeElement.querySelector('a[href="/signin"]').textContent).toContain('Já tenho uma conta');
    expect(fixture.componentInstance.revenueChart().values.reduce((sum, value) => sum + value, 0)).toBe(2600);
    expect(fixture.componentInstance.tagsChart().values.reduce((sum, value) => sum + value, 0)).toBe(26);
    expect(fixture.nativeElement.querySelector('app-line-chart-one')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-bar-chart-one')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('tbody')).toBeNull();
    fixture.componentInstance.setChartMonths('6');
    expect(fixture.componentInstance.tagsChart().values.length).toBe(6);
  });

  it('não substitui dados reais por exemplos quando o período está vazio', () => {
    const old = { ...tag, createdAt: '2020-01-01T00:00:00Z' };
    tags.list.and.returnValue([old]);
    fixture.componentInstance.reload();
    fixture.componentInstance.setPeriod('month');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('R$ 0,00');
    expect(fixture.nativeElement.textContent).not.toContain('Dados de exemplo');
    expect(fixture.nativeElement.querySelector('app-line-chart-one')).toBeNull();
  });

  it('diferencia usuários autenticados sem esconder placas existentes', () => {
    TestBed.inject(AuthSessionStore).setUser({ id: '1', name: 'Pessoa', email: 'pessoa@example.com', pictureUrl: null });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loja');
    expect(fixture.nativeElement.textContent).not.toContain('salvas neste dispositivo');
    expect(fixture.nativeElement.textContent).not.toContain('Criar conta');
    tags.list.and.returnValue([]);
    fixture.componentInstance.reload();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Comece com sua primeira placa');
    expect(fixture.nativeElement.textContent).not.toContain('Bem-vindo ao NFC.APP');
  });

  it('apresenta erros de leitura sem exibir indicadores falsos', () => {
    clients.list.and.throwError('Dados inválidos');
    fixture.componentInstance.reload();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Dados inválidos');
    expect(fixture.nativeElement.textContent).not.toContain('Faturamento total');
  });
});
