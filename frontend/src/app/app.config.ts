import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { Directionality } from '@angular/cdk/bidi';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { LiveDirectionality } from './shared/services/live-directionality.service';
import { authSessionInterceptor } from './core/auth/auth-session.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authSessionInterceptor])),
    { provide: Directionality, useClass: LiveDirectionality },
  ],
};
