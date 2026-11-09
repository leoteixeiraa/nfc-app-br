import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthSessionStore } from './auth-session.store';
import { AuthService } from './auth.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']);

export const authSessionInterceptor: HttpInterceptorFn = (request, next) => {
  const sessionStore = inject(AuthSessionStore);
  const router = inject(Router);
  const injector = inject(Injector);
  const isApiRequest = request.url.startsWith('/api/');
  const csrfToken = sessionStore.csrfToken;
  const headers =
    isApiRequest && csrfToken && !SAFE_METHODS.has(request.method)
      ? request.headers.set('X-CSRF-TOKEN', csrfToken)
      : request.headers;

  return next(request.clone({ withCredentials: isApiRequest, headers })).pipe(
    catchError((error: unknown) => {
      if (
        isApiRequest &&
        error instanceof HttpErrorResponse &&
        (error.status === 401 || (error.status === 403 && !SAFE_METHODS.has(request.method))) &&
        !request.url.startsWith('/api/auth/') &&
        sessionStore.currentUser()
      ) {
        return injector.get(AuthService).restoreSession().pipe(
          switchMap((user) => {
            if (!user) {
              sessionStore.clear();
              void router.navigate(['/signin'], { queryParams: { expired: '1' } });
              return throwError(() => error);
            }
            const refreshedHeaders = sessionStore.csrfToken && !SAFE_METHODS.has(request.method)
              ? request.headers.set('X-CSRF-TOKEN', sessionStore.csrfToken)
              : request.headers;
            return next(request.clone({ withCredentials: true, headers: refreshedHeaders }));
          }),
        );
      }
      return throwError(() => error);
    }),
  );
};
