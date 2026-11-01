import { Injectable, signal } from '@angular/core';
import { AuthUser } from './auth-user';

@Injectable({ providedIn: 'root' })
export class AuthSessionStore {
  private readonly userState = signal<AuthUser | null>(null);
  readonly currentUser = this.userState.asReadonly();

  csrfToken: string | null = null;
  initialized = false;

  setUser(user: AuthUser | null): void {
    this.userState.set(user);
  }

  clear(): void {
    this.userState.set(null);
    this.csrfToken = null;
    this.initialized = false;
  }
}
