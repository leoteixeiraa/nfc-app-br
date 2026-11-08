import { Injectable, effect, inject, signal } from '@angular/core';
import { catchError, concatMap, defer, from, map, Observable, of, Subscription, switchMap, throwError, toArray } from 'rxjs';
import { AuthSessionStore } from '../auth/auth-session.store';
import { LocalTagsService } from './local-tags.service';
import { NfcTag } from './nfc-tag';
import { AccountTag, TagClaim, TagsApiService } from './tags-api.service';

export type TagAccountSyncStatus = 'idle' | 'syncing' | 'synced' | 'pending' | 'error';

export class LogoutBlockedError extends Error {}

const CLAIM_BATCH_SIZE = 100;

@Injectable({ providedIn: 'root' })
export class TagAccountSyncService {
  private readonly session = inject(AuthSessionStore);
  private readonly localTags = inject(LocalTagsService);
  private readonly tagsApi = inject(TagsApiService);
  private activeUserId: string | null = null;
  private subscription?: Subscription;
  private refreshRequested = false;

  readonly status = signal<TagAccountSyncStatus>('idle');
  readonly pendingImportCount = signal(0);
  readonly error = signal('');

  constructor() {
    effect(() => {
      const user = this.session.currentUser();
      if (!user) {
        this.subscription?.unsubscribe();
        this.subscription = undefined;
        this.activeUserId = null;
        this.refreshRequested = false;
        this.status.set('idle');
        this.pendingImportCount.set(0);
        this.error.set('');
        return;
      }
      if (this.activeUserId !== user.id) {
        this.activeUserId = user.id;
        this.refreshRequested = false;
        this.synchronize(user.id);
      }
    });
  }

  retry(): void {
    const user = this.session.currentUser();
    if (!user || this.status() === 'syncing') {
      return;
    }
    this.synchronize(user.id);
  }

  refresh(): void {
    const user = this.session.currentUser();
    if (!user) {
      return;
    }
    if (this.status() === 'syncing') {
      this.refreshRequested = true;
      return;
    }
    this.synchronize(user.id);
  }

  /** Garante que tudo o que existe neste navegador já está salvo na conta; falha se algo ficaria para trás. */
  ensureSynced(): Observable<void> {
    if (!this.session.currentUser()) {
      return of(undefined);
    }
    return defer(() => this.loadAndClaim(this.localTags.list())).pipe(
      map((accountTags) => {
        this.tagsApi.importAccountTags(accountTags);
        const accountIds = new Set(accountTags.map((tag) => tag.id));
        const unsynced = this.localTags.list().filter((tag) => !accountIds.has(tag.id));
        if (unsynced.length > 0) {
          const total = unsynced.length;
          throw new LogoutBlockedError(
            `${total} ${total === 1 ? 'placa ainda não está salva' : 'placas ainda não estão salvas'} na sua conta ` +
              '(rascunhos locais). Publique ou remova antes de sair, para não perder dados.',
          );
        }
      }),
      catchError((error: unknown) =>
        throwError(() =>
          error instanceof LogoutBlockedError
            ? error
            : new LogoutBlockedError('Não foi possível confirmar a sincronização das suas placas. Tente novamente.'),
        ),
      ),
    );
  }

  private loadAndClaim(localTags: NfcTag[]): Observable<AccountTag[]> {
    return this.tagsApi.listAccountTags().pipe(
      switchMap((accountTags) => {
        const accountIds = new Set(accountTags.map((tag) => tag.id));
        this.pendingImportCount.set(localTags.filter((tag) => !accountIds.has(tag.id)).length);
        const claims = this.claimsFor(localTags, accountIds);
        if (claims.length === 0) {
          return of(accountTags);
        }
        return from(this.chunk(claims, CLAIM_BATCH_SIZE)).pipe(
          concatMap((batch) => this.tagsApi.claimAccountTags(batch)),
          toArray(),
          switchMap(() => this.tagsApi.listAccountTags()),
        );
      }),
    );
  }

  private synchronize(userId: string): void {
    this.subscription?.unsubscribe();
    this.status.set('syncing');
    this.pendingImportCount.set(0);
    this.error.set('');

    this.subscription = defer(() => this.loadAndClaim(this.localTags.list())).subscribe({
      next: (accountTags) => {
        if (this.session.currentUser()?.id !== userId) {
          return;
        }
        try {
          this.tagsApi.importAccountTags(accountTags);
          const localTags = this.localTags.list();
          const accountIds = new Set(accountTags.map((tag) => tag.id));
          const pendingCount = localTags.filter((tag) => !accountIds.has(tag.id)).length;
          this.pendingImportCount.set(pendingCount);
          this.status.set(pendingCount > 0 ? 'pending' : 'synced');
        } catch (error) {
          this.setError(error);
        }
        this.runRequestedRefresh(userId);
      },
      error: (error: unknown) => {
        if (this.session.currentUser()?.id === userId) {
          this.setError(error);
          this.runRequestedRefresh(userId);
        }
      },
    });
  }

  private claimsFor(localTags: NfcTag[], accountIds: Set<string>): TagClaim[] {
    return localTags
      .filter((tag) => tag.publicUrl && tag.managementToken && !accountIds.has(tag.id))
      .map((tag) => ({ code: tag.id, managementToken: tag.managementToken! }));
  }

  private chunk<T>(values: T[], size: number): T[][] {
    const batches: T[][] = [];
    for (let index = 0; index < values.length; index += size) {
      batches.push(values.slice(index, index + size));
    }
    return batches;
  }

  private setError(error: unknown): void {
    this.status.set('error');
    this.error.set(error instanceof Error ? error.message : 'Não foi possível sincronizar suas placas. Tente novamente.');
  }

  private runRequestedRefresh(userId: string): void {
    if (this.refreshRequested && this.session.currentUser()?.id === userId) {
      this.refreshRequested = false;
      this.synchronize(userId);
    }
  }
}
