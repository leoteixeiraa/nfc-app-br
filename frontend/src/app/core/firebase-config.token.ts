import { InjectionToken } from '@angular/core';
import type { FirebaseOptions } from 'firebase/app';

export const FIREBASE_CONFIG = new InjectionToken<FirebaseOptions | null>('Firebase config');