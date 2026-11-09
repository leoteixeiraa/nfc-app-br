import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthSessionStore } from '../../../core/auth/auth-session.store';
import { LocalClientsService } from '../../../core/clients/local-clients.service';
import { LocalTagsService } from '../../../core/tags/local-tags.service';
import { TagsApiService } from '../../../core/tags/tags-api.service';
import { TagAccountSyncService } from '../../../core/tags/tag-account-sync.service';
import { TagsDashboardComponent } from './tags-dashboard.component';

describe('Aviso de sincronização das placas', () => {
  it('informa o visitante e remove o aviso quando a sincronização da conta é confirmada', () => {
    const tag = {
      id: 'placa', name: 'Loja', type: 'url', destinationUrl: 'https://example.com',
      publicUrl: 'https://nfc.app.br/t/placa', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    };
    TestBed.configureTestingModule({
      imports: [TagsDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: LocalTagsService, useValue: { list: () => [tag] } },
        { provide: LocalClientsService, useValue: {} },
        { provide: TagsApiService, useValue: {} },
        { provide: TagAccountSyncService, useValue: {
          status: signal('synced'), pendingImportCount: signal(0), error: signal(''), retry: jasmine.createSpy(),
        } },
      ],
    });
    const fixture = TestBed.createComponent(TagsDashboardComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const session = TestBed.inject(AuthSessionStore);
    expect(element.textContent).toContain('Loja');
    expect(element.textContent).toContain('Suas placas estão salvas neste dispositivo. Crie uma conta para gerenciá-las com mais segurança.');
    expect(element.querySelector('a[href="/signup"]')).not.toBeNull();
    session.setUser({ id: '1', name: 'Pessoa', email: 'pessoa@example.com', pictureUrl: null });
    fixture.detectChanges();
    expect(element.textContent).toContain('Loja');
    expect(element.textContent).not.toContain('salvas neste dispositivo');
    expect(element.querySelector('a[href="/signup"]')).toBeNull();

    session.clear();
    fixture.detectChanges();
    expect(element.textContent).toContain('Suas placas estão salvas neste dispositivo.');
    expect(element.querySelector('a[href="/signup"]')).not.toBeNull();
  });

  it('exibe importação pendente e erro com ação de nova tentativa', () => {
    const sync = {
      status: signal('pending'),
      pendingImportCount: signal(2),
      error: signal('Falha de rede'),
      retry: jasmine.createSpy(),
    };
    TestBed.configureTestingModule({
      imports: [TagsDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: LocalTagsService, useValue: { list: () => [{
          id: 'placa', name: 'Loja', type: 'url', destinationUrl: 'https://example.com',
          createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
        }] } },
        { provide: LocalClientsService, useValue: {} },
        { provide: TagsApiService, useValue: {} },
        { provide: TagAccountSyncService, useValue: sync },
      ],
    });
    const fixture = TestBed.createComponent(TagsDashboardComponent);
    TestBed.inject(AuthSessionStore).setUser({ id: '1', name: 'Pessoa', email: 'pessoa@example.com', pictureUrl: null });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('2 placas aguardando importação para sua conta');

    sync.status.set('error');
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();
    expect(fixture.nativeElement.textContent).toContain('Tentar novamente');
    expect(sync.retry).toHaveBeenCalled();
  });
});
