import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, of, switchMap, catchError } from 'rxjs';
import { FirebaseAuthService } from './firebase-auth.service';

export const firebaseAuthInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/')) {
    return next(request);
  }

  const auth = inject(FirebaseAuthService);

  return from(auth.getIdToken()).pipe(
    catchError(() => of(null)),
    switchMap((token) => next(token
      ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : request))
  );
};