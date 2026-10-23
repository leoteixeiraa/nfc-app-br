import { Injectable, inject, signal } from '@angular/core';
import type { Auth, User } from 'firebase/auth';
import { FIREBASE_CONFIG } from './firebase-config.token';

@Injectable({ providedIn: 'root' })
export class FirebaseAuthService {
  private readonly config = inject(FIREBASE_CONFIG);
  readonly user = signal<User | null>(null);
  readonly isConfigured = this.hasValidConfig();
  private authPromise?: Promise<Auth | null>;
  private authStateReady?: Promise<User | null>;
  private stateInitialized = false;

  waitForUser(): Promise<User | null> {
    if (this.stateInitialized) {
      return Promise.resolve(this.user());
    }

    this.authStateReady ??= this.getAuth().then(async (auth) => {
      if (!auth) {
        this.stateInitialized = true;
        return null;
      }

      const { onAuthStateChanged } = await import('firebase/auth');
      return new Promise<User | null>((resolve) => {
        let isFirstUpdate = true;
        onAuthStateChanged(auth, (user) => {
          this.user.set(user);
          if (isFirstUpdate) {
            isFirstUpdate = false;
            this.stateInitialized = true;
            resolve(user);
          }
        }, () => {
          this.user.set(null);
          if (isFirstUpdate) {
            isFirstUpdate = false;
            this.stateInitialized = true;
            resolve(null);
          }
        });
      });
    });
    return this.authStateReady;
  }

  async signIn(email: string, password: string): Promise<void> {
    const auth = await this.getAuth();
    if (!auth) {
      throw new Error('Firebase Authentication não está configurado.');
    }

    const { signInWithEmailAndPassword } = await import('firebase/auth');
    const credential = await signInWithEmailAndPassword(auth, email, password);
    this.user.set(credential.user);
  }

  async signInWithGoogle(): Promise<void> {
    const auth = await this.getAuth();
    if (!auth) {
      throw new Error('Firebase Authentication não está configurado.');
    }

    const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const credential = await signInWithPopup(auth, provider);
    this.user.set(credential.user);
  }

  async signOut(): Promise<void> {
    const auth = await this.getAuth();
    if (auth) {
      const { signOut } = await import('firebase/auth');
      await signOut(auth);
      this.user.set(null);
    }
  }

  async getIdToken(): Promise<string | null> {
    const user = await this.waitForUser();
    return user ? user.getIdToken() : null;
  }

  private getAuth(): Promise<Auth | null> {
    if (!this.isConfigured) {
      return Promise.resolve(null);
    }

    this.authPromise ??= Promise.all([
      import('firebase/app'),
      import('firebase/auth')
    ]).then(([firebaseApp, firebaseAuth]) => {
      const app = firebaseApp.getApps().length
        ? firebaseApp.getApp()
        : firebaseApp.initializeApp(this.config!);
      return firebaseAuth.getAuth(app);
    });

    return this.authPromise;
  }

  private hasValidConfig(): boolean {
    return Boolean(
      this.config?.apiKey &&
      this.config.authDomain &&
      this.config.projectId &&
      this.config.appId
    );
  }
}