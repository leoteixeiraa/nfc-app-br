import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { FirebaseAuthService } from './firebase-auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(FirebaseAuthService);
  const router = inject(Router);
  const user = await auth.waitForUser().catch(() => null);

  return user ? true : router.createUrlTree(['/login']);
};