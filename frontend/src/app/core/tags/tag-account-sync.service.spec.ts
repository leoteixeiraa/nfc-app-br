import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AuthSessionStore } from '../auth/auth-session.store';
import { NfcTag } from './nfc-tag';
import { LocalTagsService } from './local-tags.service';
import { TagsApiService } from './tags-api.service';
import { LogoutBlockedError, TagAccountSyncService } from './tag-account-sync.service';

describe('TagAccountSyncService', () => {
  const user = { id: '1', name: 'Pessoa', email: 'pessoa@example.com', pictureUrl: null };
  const publishedTag: NfcTag = {
    id: 'placa-publicada',
    name: 'Loja',
    type: 'url',
    destinationUrl: 'https://example.com',
    publicUrl: 'https://nfc.app.br/t/placa-publicada',
    managementToken: 'credencial-local',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
  let localTags: jasmine.SpyObj<LocalTagsService>;
  let tagsApi: jasmine.SpyObj<TagsApiService>;
  let session: AuthSessionStore;
  let sync: TagAccountSyncService;

  beforeEach(() => {
    localTags = jasmine.createSpyObj<LocalTagsService>('LocalTagsService', ['list']);
    tagsApi = jasmine.createSpyObj<TagsApiService>('TagsApiService', [
      'listAccountTags', 'claimAccountTags', 'importAccountTags',
    ]);
    localTags.list.and.returnValue([publishedTag]);
    tagsApi.listAccountTags.and.returnValues(of([]), of([{ id: publishedTag.id }]));
    tagsApi.claimAccountTags.and.returnValue(of([{ id: publishedTag.id }]));
    TestBed.configureTestingModule({
      providers: [
        { provide: LocalTagsService, useValue: localTags },
        { provide: TagsApiService, useValue: tagsApi },
      ],
    });
    session = TestBed.inject(AuthSessionStore);
  });

  it('associa placas com credencial e confirma a persistência pela listagem da conta', () => {
    session.setUser(user);
    sync = TestBed.inject(TagAccountSyncService);
    TestBed.flushEffects();

    expect(tagsApi.claimAccountTags).toHaveBeenCalledWith([
      { code: publishedTag.id, managementToken: 'credencial-local' },
    ]);
    expect(tagsApi.listAccountTags).toHaveBeenCalledTimes(2);
    expect(sync.status()).toBe('synced');
    expect(sync.pendingImportCount()).toBe(0);
  });

  it('mantém importação pendente para placas que não podem ser associadas', () => {
    localTags.list.and.returnValue([{ ...publishedTag, managementToken: undefined }]);
    session.setUser(user);
    sync = TestBed.inject(TagAccountSyncService);
    TestBed.flushEffects();

    expect(tagsApi.claimAccountTags).not.toHaveBeenCalled();
    expect(sync.status()).toBe('pending');
    expect(sync.pendingImportCount()).toBe(1);
  });

  it('ensureSynced conclui quando tudo já está na conta', () => {
    session.setUser(user);
    sync = TestBed.inject(TagAccountSyncService);
    tagsApi.listAccountTags.and.returnValue(of([{ id: publishedTag.id }]));
    let done = false;
    sync.ensureSynced().subscribe(() => (done = true));
    expect(done).toBeTrue();
    expect(tagsApi.importAccountTags).toHaveBeenCalled();
  });

  it('ensureSynced bloqueia quando há placa local que não pode ir para a conta', () => {
    session.setUser(user);
    sync = TestBed.inject(TagAccountSyncService);
    localTags.list.and.returnValue([{ ...publishedTag, publicUrl: undefined, managementToken: undefined }]);
    tagsApi.listAccountTags.and.returnValue(of([]));
    let error: unknown;
    sync.ensureSynced().subscribe({ error: (e: unknown) => (error = e) });
    expect(error).toBeInstanceOf(LogoutBlockedError);
  });

  it('expõe falhas e permite tentar novamente', () => {
    tagsApi.listAccountTags.and.returnValues(
      throwError(() => new HttpErrorResponse({ status: 404 })),
      of([{ id: publishedTag.id }]),
    );
    session.setUser(user);
    sync = TestBed.inject(TagAccountSyncService);
    TestBed.flushEffects();

    expect(sync.status()).toBe('error');
    expect(sync.error()).toContain('backend está atualizado');

    sync.retry();
    expect(sync.status()).toBe('synced');
    expect(sync.error()).toBe('');
  });

  it('redefine o estado ao sair e restaura a verificação depois de novo login', () => {
    tagsApi.listAccountTags.and.returnValue(of([{ id: publishedTag.id }]));
    session.setUser(user);
    sync = TestBed.inject(TagAccountSyncService);
    TestBed.flushEffects();
    expect(sync.status()).toBe('synced');

    session.clear();
    TestBed.flushEffects();
    expect(sync.status()).toBe('idle');

    session.setUser(user);
    TestBed.flushEffects();
    expect(tagsApi.listAccountTags).toHaveBeenCalledTimes(2);
    expect(sync.status()).toBe('synced');
  });

  it('ao recarregar com sessão restaurada, consulta novamente a conta', () => {
    tagsApi.listAccountTags.and.returnValue(of([{ id: publishedTag.id }]));
    session.setUser(user);
    sync = TestBed.inject(TagAccountSyncService);
    TestBed.flushEffects();

    expect(tagsApi.listAccountTags).toHaveBeenCalledTimes(1);
    expect(sync.status()).toBe('synced');
  });
});
