import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthSessionStore } from './auth-session.store';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']);

export const authSessionInterceptor: HttpInterceptorFn = (request, next) => {
  const sessionStore = inject(AuthSessionStore);
  const router = inject(Router);
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
        error.status === 401 &&
        !(request.method === 'GET' && request.url === '/api/auth/me')
      ) {
        sessionStore.clear();
        void router.navigate(['/signin'], { queryParams: { expired: '1' } });
      }
      return throwError(() => error);
    }),
  );
};
