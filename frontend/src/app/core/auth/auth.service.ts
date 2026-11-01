import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { FirebaseOptions, initializeApp } from 'firebase/app';
import { Auth, getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import {
  catchError,
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
import { AuthUser } from './auth-user';

interface CsrfResponse {
  token: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private initialization?: Observable<AuthUser | null>;
  private firebaseAuth?: Promise<Auth>;

  constructor(
    private readonly http: HttpClient,
    private readonly sessionStore: AuthSessionStore,
  ) {}

  getCurrentUser(): Observable<AuthUser | null> {
    if (this.sessionStore.initialized) {
      return of(this.sessionStore.currentUser());
    }

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
            this.sessionStore.setUser(null);
            this.sessionStore.initialized = true;
            return of(null);
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
    void this.getFirebaseAuth().catch(() => undefined);
  }

  signInWithGoogle(): Observable<AuthUser> {
    return from(this.getFirebaseAuth()).pipe(
      switchMap((auth) => from(signInWithPopup(auth, new GoogleAuthProvider()))),
      switchMap((credential) => from(credential.user.getIdToken())),
      switchMap((idToken) =>
        this.fetchCsrfToken().pipe(
          switchMap(() => this.http.post<AuthUser>('/api/auth/session', { idToken })),
        ),
      ),
      tap((user) => {
        this.sessionStore.setUser(user);
        this.sessionStore.initialized = true;
      }),
      finalize(() => {
        void this.firebaseAuth?.then((auth) => signOut(auth)).catch(() => undefined);
      }),
    );
  }

  logout(): Observable<void> {
    return this.fetchCsrfToken().pipe(
      switchMap(() => this.http.post<void>('/api/auth/logout', {})),
      tap(() => this.sessionStore.clear()),
    );
  }

  private getFirebaseAuth(): Promise<Auth> {
    if (!this.firebaseAuth) {
      this.firebaseAuth = fetch('/firebase-config.json', { cache: 'no-store' })
        .then((response) => {
          if (!response.ok) {
            throw new Error('Configuração do Firebase indisponível');
          }
          return response.json() as Promise<FirebaseOptions>;
        })
        .then((config) => {
          if (!config.apiKey || !config.projectId) {
            throw new Error('Configuração do Firebase incompleta');
          }
          return getAuth(initializeApp(config));
        })
        .catch((error: unknown) => {
          this.firebaseAuth = undefined;
          throw error;
        });
    }
    return this.firebaseAuth;
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
