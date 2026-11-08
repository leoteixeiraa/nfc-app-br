import { Component, EventEmitter, Input, Output } from '@angular/core';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthSessionStore } from '../../core/auth/auth-session.store';
import { Client, LocalClientsService } from '../../core/clients/local-clients.service';
import { ClientReportService } from '../../core/clients/client-report.service';
import { TagAccountSyncService } from '../../core/tags/tag-account-sync.service';
import { TableThreeComponent } from '../tables/components/basic-tables/table-three/table-three.component';
import { ClientsComponent } from './clients.component';

@Component({ selector: 'app-table-three', template: '' })
class TableThreeStub {
  @Input() clients: Client[] = [];
  @Input() reportLoading = false;
  @Output() report = new EventEmitter<Client>();
}

describe('Clientes e armazenamento local', () => {
  let fixture: ComponentFixture<ClientsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientsComponent],
      providers: [
        provideRouter([]),
        { provide: LocalClientsService, useValue: { list: () => [{
          placeId: 'cliente-1', name: 'Café', address: '', reviewUrl: '', rating: null,
          userRatingCount: null, googleMapsUrl: null, createdAt: '2026-01-01T00:00:00Z',
          tags: [], statistics: { total: 0, last7Days: 0, last30Days: 0, lastAccess: null },
        }] } },
        { provide: ClientReportService, useValue: { download: jasmine.createSpy() } },
        { provide: TagAccountSyncService, useValue: {
          status: signal('synced'), pendingImportCount: signal(0), error: signal(''), retry: jasmine.createSpy(),
        } },
      ],
    }).overrideComponent(ClientsComponent, {
      remove: { imports: [TableThreeComponent] },
      add: { imports: [TableThreeStub] },
    }).compileComponents();
    fixture = TestBed.createComponent(ClientsComponent);
    fixture.detectChanges();
  });

  it('mantém explícito que clientes ainda não são sincronizados, mesmo após login', () => {
    TestBed.inject(AuthSessionStore).setUser({ id: '1', name: 'Pessoa', email: 'pessoa@example.com', pictureUrl: null });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Os dados de clientes ficam somente neste navegador e ainda não são sincronizados com a conta.');
    expect(fixture.componentInstance.clients()[0].name).toBe('Café');
  });
});
