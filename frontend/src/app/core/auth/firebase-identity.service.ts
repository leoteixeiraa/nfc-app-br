import { Injectable } from '@angular/core';
import { FirebaseOptions, initializeApp } from 'firebase/app';
import {
  Auth,
  browserLocalPersistence,
  getAdditionalUserInfo,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  signInWithPopup,
  signOut,
} from 'firebase/auth';

@Injectable({ providedIn: 'root' })
export class FirebaseIdentityService {
  private auth?: Promise<Auth>;

  preload(): Promise<void> {
    return this.getAuth().then(() => undefined);
  }

  async signIn(): Promise<{ idToken: string; isNewUser: boolean }> {
    const auth = await this.getAuth();
    const credential = await signInWithPopup(auth, new GoogleAuthProvider());
    return {
      idToken: await credential.user.getIdToken(),
      isNewUser: getAdditionalUserInfo(credential)?.isNewUser === true,
    };
  }

  async currentToken(): Promise<string | null> {
    const auth = await this.getAuth();
    await auth.authStateReady();
    return auth.currentUser ? auth.currentUser.getIdToken() : null;
  }

  async signOut(): Promise<void> {
    const auth = await this.getAuth();
    await signOut(auth);
  }

  private getAuth(): Promise<Auth> {
    if (!this.auth) {
      this.auth = fetch('/firebase-config.json', { cache: 'no-store' })
        .then((response) => {
          if (!response.ok) {
            throw new Error('Configuração do Firebase indisponível');
          }
          return response.json() as Promise<FirebaseOptions>;
        })
        .then(async (config) => {
          if (!config.apiKey || !config.projectId) {
            throw new Error('Configuração do Firebase incompleta');
          }
          const auth = getAuth(initializeApp(config));
          await setPersistence(auth, browserLocalPersistence);
          return auth;
        })
        .catch((error: unknown) => {
          this.auth = undefined;
          throw error;
        });
    }
    return this.auth;
  }
}
