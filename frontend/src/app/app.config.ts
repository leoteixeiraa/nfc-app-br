import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import { providePrimeNG } from 'primeng/config';

import { routes } from './app.routes';
import { firebaseAuthInterceptor } from './core/firebase-auth.interceptor';
import { FIREBASE_CONFIG } from './core/firebase-config.token';

const NfcPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{emerald.50}',
      100: '{emerald.100}',
      200: '{emerald.200}',
      300: '{emerald.300}',
      400: '{emerald.400}',
      500: '{emerald.500}',
      600: '{emerald.600}',
      700: '{emerald.700}',
      800: '{emerald.800}',
      900: '{emerald.900}',
      950: '{emerald.950}'
    }
  }
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch(), withInterceptors([firebaseAuthInterceptor])),
    provideRouter(routes),
    provideAnimationsAsync(),
    { provide: FIREBASE_CONFIG, useValue: null },
    providePrimeNG({
      ripple: true,
      theme: {
        preset: NfcPreset,
        options: {
          darkModeSelector: false
        }
      }
    })
  ]
};
