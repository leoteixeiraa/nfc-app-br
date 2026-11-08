import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { authSessionInterceptor } from './auth-session.interceptor';
import { AuthSessionStore } from './auth-session.store';
import { AuthService } from './auth.service';
import { FirebaseIdentityService } from './firebase-identity.service';
import { LOCAL_TAGS_STORAGE_KEY, LocalTagsService } from '../tags/local-tags.service';
import { NfcTag } from '../tags/nfc-tag';

describe('persistência da sessão', () => {
  const user = { id: '1', email: 'teste@example.com', name: 'Teste', pictureUrl: null };
  let service: AuthService;
  let store: AuthSessionStore;
  let http: HttpTestingController;
  let firebase: jasmine.SpyObj<FirebaseIdentityService>;

  beforeEach(() => {
    firebase = jasmine.createSpyObj<FirebaseIdentityService>('FirebaseIdentityService', [
      'preload', 'signIn', 'currentToken', 'signOut',
    ]);
    firebase.currentToken.and.resolveTo('firebase-token');
    firebase.signOut.and.resolveTo();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authSessionInterceptor])),
        provideHttpClientTesting(),
        { provide: FirebaseIdentityService, useValue: firebase },
      ],
    });
    service = TestBed.inject(AuthService);
    store = TestBed.inject(AuthSessionStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function csrf(token: string): void {
    http.expectOne('/api/auth/csrf').flush({ token });
  }

  async function restore(): Promise<void> {
    await Promise.resolve();
    csrf('novo-csrf');
    const request = http.expectOne('/api/auth/session');
    expect(request.request.body).toEqual({ idToken: 'firebase-token' });
    expect(request.request.headers.get('X-CSRF-TOKEN')).toBe('novo-csrf');
    request.flush(user);
  }

  it('mantém o Firebase autenticado após login bem-sucedido', async () => {
    firebase.signIn.and.resolveTo('firebase-token');
    const result = firstValueFrom(service.signInWithGoogle());
    await Promise.resolve();
    csrf('token');
    http.expectOne('/api/auth/session').flush(user);
    expect(await result).toEqual(user);
    expect(firebase.signOut).not.toHaveBeenCalled();
    expect(store.currentUser()).toEqual(user);
  });

  it('não altera as placas existentes ao entrar ou restaurar a sessão', async () => {
    const tag: NfcTag = {
      id: 'placa-existente', name: 'Loja', type: 'url', destinationUrl: 'https://example.com',
      publicUrl: 'https://nfc.app.br/t/placa-existente', managementToken: 'credencial-local',
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    };
    const originalGetItem = Storage.prototype.getItem;
    spyOn(Storage.prototype, 'getItem').and.callFake(function (this: Storage, key: string) {
      return key === LOCAL_TAGS_STORAGE_KEY ? JSON.stringify([tag]) : originalGetItem.call(this, key);
    });
    const write = spyOn(Storage.prototype, 'setItem').and.callThrough();
    const remove = spyOn(Storage.prototype, 'removeItem').and.callThrough();
    const clear = spyOn(Storage.prototype, 'clear').and.callThrough();
    firebase.signIn.and.resolveTo('firebase-token');
    const login = firstValueFrom(service.signInWithGoogle());
    await Promise.resolve();
    csrf('token');
    http.expectOne('/api/auth/session').flush(user);
    await login;
    const restored = firstValueFrom(service.restoreSession());
    await restore();
    await restored;
    expect(TestBed.inject(LocalTagsService).list()).toEqual([tag]);
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
  });

  it('cancela o login Firebase se o servidor rejeitar a sessão', async () => {
    firebase.signIn.and.resolveTo('firebase-token');
    const result = firstValueFrom(service.signInWithGoogle());
    await Promise.resolve();
    csrf('token');
    http.expectOne('/api/auth/session').flush(null, { status: 409, statusText: 'Conflict' });
    await expectAsync(result).toBeRejected();
    expect(firebase.signOut).toHaveBeenCalled();
    expect(store.currentUser()).toBeNull();
  });

  it('restaura após expiração ou reinício do servidor', async () => {
    const result = firstValueFrom(service.getCurrentUser());
    csrf('antigo');
    http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });
    await restore();
    expect(await result).toEqual(user);
    expect(store.currentUser()).toEqual(user);
  });

  it('continua anônimo sem identidade persistida', async () => {
    firebase.currentToken.and.resolveTo(null);
    const result = firstValueFrom(service.getCurrentUser());
    csrf('token');
    http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(await result).toBeNull();
    expect(store.currentUser()).toBeNull();
  });

  it('compartilha a renovação entre requisições simultâneas', async () => {
    const first = firstValueFrom(service.restoreSession());
    const second = firstValueFrom(service.restoreSession());
    await restore();
    expect(await first).toEqual(user);
    expect(await second).toEqual(user);
    expect(firebase.currentToken).toHaveBeenCalledTimes(1);
  });

  it('renova e repete uma requisição autenticada recusada', async () => {
    store.setUser(user);
    store.csrfToken = 'antigo';
    const client = TestBed.inject(HttpClient);
    const result = firstValueFrom(client.post('/api/exemplo', { value: 1 }));
    http.expectOne('/api/exemplo').flush(null, { status: 403, statusText: 'Forbidden' });
    await restore();
    const retry = http.expectOne('/api/exemplo');
    expect(retry.request.headers.get('X-CSRF-TOKEN')).toBe('novo-csrf');
    retry.flush({ ok: true });
    expect(await result).toEqual({ ok: true });
  });

  it('renova e repete requisição protegida com resposta 401', async () => {
    store.setUser(user);
    const result = firstValueFrom(TestBed.inject(HttpClient).get('/api/protegida'));
    http.expectOne('/api/protegida').flush(null, { status: 401, statusText: 'Unauthorized' });
    await restore();
    http.expectOne('/api/protegida').flush({ ok: true });
    expect(await result).toEqual({ ok: true });
  });

  it('não repete automaticamente uma leitura proibida', async () => {
    store.setUser(user);
    const result = firstValueFrom(TestBed.inject(HttpClient).get('/api/protegida'));
    http.expectOne('/api/protegida').flush(null, { status: 403, statusText: 'Forbidden' });
    await expectAsync(result).toBeRejected();
    expect(firebase.currentToken).not.toHaveBeenCalled();
  });

  it('não encerra a sessão em erros de endpoints públicos', async () => {
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    const result = firstValueFrom(TestBed.inject(HttpClient).get('/api/places/search'));
    http.expectOne('/api/places/search').flush(null, { status: 401, statusText: 'Unauthorized' });
    await expectAsync(result).toBeRejected();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(firebase.currentToken).not.toHaveBeenCalled();
  });

  it('propaga falhas de rede sem encerrar a sessão', async () => {
    store.setUser(user);
    const result = firstValueFrom(service.getCurrentUser());
    csrf('token');
    http.expectOne('/api/auth/me').flush(null, { status: 503, statusText: 'Unavailable' });
    await expectAsync(result).toBeRejected();
    expect(store.currentUser()).toEqual(user);
  });

  it('encerra as sessões do servidor e do Firebase', async () => {
    store.setUser(user);
    const result = firstValueFrom(service.logout());
    http.expectOne('/api/account/tags').flush([]);
    csrf('token');
    http.expectOne('/api/auth/logout').flush(null, { status: 204, statusText: 'No Content' });
    await result;
    expect(firebase.signOut).toHaveBeenCalled();
    expect(store.currentUser()).toBeNull();
    expect(store.csrfToken).toBeNull();
  });

  it('apaga placas e clientes locais após sair, já sincronizados com a conta', async () => {
    const tag: NfcTag = {
      id: 'placa-sincronizada', name: 'Loja', type: 'url', destinationUrl: 'https://example.com',
      publicUrl: 'https://nfc.app.br/t/placa-sincronizada', managementToken: 'credencial-local',
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    };
    localStorage.setItem(LOCAL_TAGS_STORAGE_KEY, JSON.stringify([tag]));
    localStorage.setItem('nfcapp.clients.v1', JSON.stringify({ clients: [], links: [] }));
    store.setUser(user);
    const result = firstValueFrom(service.logout());
    http.expectOne('/api/account/tags').flush([{ id: tag.id }]);
    csrf('token');
    http.expectOne('/api/auth/logout').flush(null, { status: 204, statusText: 'No Content' });
    await result;
    expect(localStorage.getItem(LOCAL_TAGS_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('nfcapp.clients.v1')).toBeNull();
  });

  it('não sai nem apaga dados quando há placa local fora da conta', async () => {
    const draft: NfcTag = {
      id: 'rascunho', name: 'Rascunho', type: 'url', destinationUrl: 'https://example.com',
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    };
    localStorage.setItem(LOCAL_TAGS_STORAGE_KEY, JSON.stringify([draft]));
    store.setUser(user);
    const result = firstValueFrom(service.logout());
    http.expectOne('/api/account/tags').flush([]);
    await expectAsync(result).toBeRejected();
    expect(firebase.signOut).not.toHaveBeenCalled();
    expect(localStorage.getItem(LOCAL_TAGS_STORAGE_KEY)).not.toBeNull();
    expect(store.currentUser()).toEqual(user);
    localStorage.removeItem(LOCAL_TAGS_STORAGE_KEY);
  });

  it('permite sair quando a sessão do servidor já expirou', async () => {
    store.setUser(user);
    const result = firstValueFrom(service.logout());
    http.expectOne('/api/account/tags').flush([]);
    csrf('token');
    http.expectOne('/api/auth/logout').flush(null, { status: 401, statusText: 'Unauthorized' });
    await result;
    expect(firebase.signOut).toHaveBeenCalled();
    expect(store.currentUser()).toBeNull();
  });

  it('aguarda uma renovação em andamento antes de sair', async () => {
    let provideToken!: (token: string) => void;
    firebase.currentToken.and.returnValue(new Promise((resolve) => { provideToken = resolve; }));
    const pending = firstValueFrom(service.restoreSession());
    const logout = firstValueFrom(service.logout());
    expect(await firstValueFrom(service.restoreSession())).toBeNull();
    provideToken('firebase-token');
    await restore();
    expect(await pending).toEqual(user);
    csrf('logout-token');
    http.expectOne('/api/auth/logout').flush(null, { status: 204, statusText: 'No Content' });
    await logout;
    expect(firebase.signOut).toHaveBeenCalled();
    expect(store.currentUser()).toBeNull();
  });
});
