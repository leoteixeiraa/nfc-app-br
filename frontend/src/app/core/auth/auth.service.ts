import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  catchError,
  defer,
  finalize,
  from,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { AuthSessionStore } from './auth-session.store';
import { LocalClientsService } from '../clients/local-clients.service';
import { LocalTagsService } from '../tags/local-tags.service';
import { TagAccountSyncService } from '../tags/tag-account-sync.service';
import { AuthUser } from './auth-user';
import { FirebaseIdentityService } from './firebase-identity.service';

interface CsrfResponse {
  token: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private initialization?: Observable<AuthUser | null>;
  private restoration?: Observable<AuthUser | null>;
  private loggingOut = false;
  private readonly tagSync = inject(TagAccountSyncService);
  private readonly localTags = inject(LocalTagsService);
  private readonly localClients = inject(LocalClientsService);

  constructor(
    private readonly http: HttpClient,
    private readonly sessionStore: AuthSessionStore,
    private readonly firebase: FirebaseIdentityService,
  ) {}

  getCurrentUser(): Observable<AuthUser | null> {
    if (this.initialization) {
      return this.initialization;
    }

    this.initialization = this.fetchCsrfToken()
      .pipe(
        switchMap(() => this.http.get<AuthUser>('/api/auth/me')),
        tap((user) => {
          this.sessionStore.setUser(user);
          this.sessionStore.initialized = true;
        }),
        catchError((error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 401) {
            return this.restoreSession();
          }
          return throwError(() => error);
        }),
        finalize(() => {
          this.initialization = undefined;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    return this.initialization;
  }

  // Carrega a configuração antes do clique para o popup não perder o gesto do usuário.
  preloadGoogleSignIn(): void {
    void this.firebase.preload().catch((error: unknown) => console.error('Não foi possível carregar o login Google.', error));
  }

  signInWithGoogle(): Observable<AuthUser> {
    return from(this.firebase.signIn()).pipe(
      switchMap((idToken) =>
        this.fetchCsrfToken().pipe(
          switchMap(() => this.http.post<AuthUser>('/api/auth/session', { idToken })),
          catchError((error: unknown) =>
            from(this.firebase.signOut()).pipe(
              catchError((signOutError: unknown) =>
                throwError(() => new Error('Não foi possível cancelar o login Google após a falha.', { cause: signOutError })),
              ),
              switchMap(() => throwError(() => error)),
            ),
          ),
        ),
      ),
      tap((user) => {
        this.sessionStore.setUser(user);
        this.sessionStore.initialized = true;
      }),
    );
  }

  restoreSession(): Observable<AuthUser | null> {
    if (this.loggingOut) {
      return of(null);
    }
    if (this.restoration) {
      return this.restoration;
    }
    this.restoration = defer(() => from(this.firebase.currentToken())).pipe(
      switchMap((idToken) => {
        if (!idToken) {
          this.sessionStore.setUser(null);
          this.sessionStore.initialized = true;
          return of(null);
        }
        return this.fetchCsrfToken().pipe(
          switchMap(() => this.http.post<AuthUser>('/api/auth/session', { idToken })),
          tap((user) => {
            this.sessionStore.setUser(user);
            this.sessionStore.initialized = true;
          }),
          catchError((error: unknown) => {
            if (error instanceof HttpErrorResponse && error.status === 401) {
              this.sessionStore.clear();
              return of(null);
            }
            return throwError(() => error);
          }),
        );
      }),
      finalize(() => {
        this.restoration = undefined;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.restoration;
  }

  logout(): Observable<void> {
    return this.tagSync.ensureSynced().pipe(
      switchMap(() => this.performLogout()),
      tap(() => {
        this.localTags.clearAll();
        this.localClients.clearAll();
      }),
    );
  }

  private performLogout(): Observable<void> {
    return defer(() => {
      this.loggingOut = true;
      return (this.restoration ?? of(null)).pipe(
        switchMap(() => this.fetchCsrfToken()),
        switchMap(() => this.http.post<void>('/api/auth/logout', {})),
        catchError((error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 401) {
            return of(undefined);
          }
          return throwError(() => error);
        }),
        switchMap(() => from(this.firebase.signOut())),
        tap(() => this.sessionStore.clear()),
        finalize(() => {
          this.loggingOut = false;
        }),
      );
    });
  }

  private fetchCsrfToken(): Observable<string> {
    return this.http.get<CsrfResponse>('/api/auth/csrf').pipe(
      tap((response) => {
        this.sessionStore.csrfToken = response.token;
      }),
      map((response) => response.token),
    );
  }
}
