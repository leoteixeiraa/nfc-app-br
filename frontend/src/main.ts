import { bootstrapApplication } from '@angular/platform-browser';
import type { FirebaseOptions } from 'firebase/app';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { FIREBASE_CONFIG } from './app/core/firebase-config.token';

async function bootstrap(): Promise<void> {
  let firebaseConfig: FirebaseOptions | null = null;

  try {
    const response = await fetch('/firebase-config.json', { cache: 'no-store' });
    if (response.ok) {
      const config = await response.json() as FirebaseOptions;
      if (config.apiKey && config.authDomain && config.projectId && config.appId) {
        firebaseConfig = config;
      }
    }
  } catch (error) {
    console.warn('Configuração Firebase indisponível; autenticação desativada.', error);
  }

  await bootstrapApplication(App, {
    ...appConfig,
    providers: [
      ...appConfig.providers,
      { provide: FIREBASE_CONFIG, useValue: firebaseConfig }
    ]
  });
}

void bootstrap().catch((error) => console.error(error));
