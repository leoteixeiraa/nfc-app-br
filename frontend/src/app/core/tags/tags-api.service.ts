import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable, switchMap, tap } from 'rxjs';
import { AuthSessionStore } from '../auth/auth-session.store';
import { LocalTagsService } from './local-tags.service';
import { NfcTag, NfcTagInput, NfcTagType } from './nfc-tag';

interface TagResponse {
  id: string;
  name: string;
  type: NfcTagType;
  destinationUrl: string;
  publicUrl: string;
  createdAt: string;
  updatedAt: string;
  active: boolean;
  qrCodeDataUri: string;
  destinationLabel: string | null;
  pixKey: string | null;
  pixReceiverName: string | null;
  pixCity: string | null;
  salePrice: number | null;
}

export interface AccountTag extends Partial<TagResponse> {
  id: string;
  updatedAt?: string;
}

export interface TagClaim {
  code: string;
  managementToken: string;
}

export interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  rating?: number | null;
  userRatingCount?: number | null;
  photoUrl?: string | null;
  photoAttributions?: Array<{ displayName: string; uri: string | null }>;
  googleMapsUrl?: string | null;
  category?: string | null;
  phone?: string | null;
  website?: string | null;
}

export interface PlaceDetails extends PlaceResult {
  rating: number | null;
  userRatingCount: number | null;
  photoUrl: string | null;
  photoAttributions: Array<{ displayName: string; uri: string | null }>;
  googleMapsUrl: string | null;
  reviewUrl: string;
  reviews?: PlaceReview[] | null;
}

export interface PlaceReview {
  author: string;
  authorUrl: string | null;
  rating: number | null;
  text: string;
  publishedAt: string;
  relativeTime: string;
  googleMapsUrl: string | null;
}

export interface PixPreview {
  payload: string;
  qrCodeDataUri: string;
}

export interface WriteConfiguration {
  name: string;
  publicUrl: string;
  continuationQrCodeDataUri: string;
}

export interface PublicQrConfiguration {
  name: string;
  publicUrl: string;
  qrCodeDataUri: string;
}

@Injectable({ providedIn: 'root' })
export class TagsApiService {
  constructor(
    private readonly http: HttpClient,
    private readonly sessionStore: AuthSessionStore,
    private readonly localTags: LocalTagsService,
  ) {}

  create(input: NfcTagInput, token: string, idempotencyKey: string): Observable<NfcTag> {
    return this.fetchCsrf().pipe(
      switchMap(() =>
        this.http.post<TagResponse>('/api/tags', this.requestBody(input, token), {
          headers: { 'Idempotency-Key': idempotencyKey },
        }),
      ),
      map((response) => this.toLocalTag(response, token)),
      tap((tag) => this.localTags.saveRemote({ ...tag, qrCodeDataUri: undefined })),
    );
  }

  update(id: string, input: NfcTagInput, token: string | null): Observable<NfcTag> {
    const request = token
      ? this.fetchCsrf().pipe(
          switchMap(() =>
            this.http.put<TagResponse>(`/api/tags/${encodeURIComponent(id)}`, this.requestBody(input), {
              headers: { 'X-Tag-Management-Token': token },
            }),
          ),
        )
      : this.fetchCsrf().pipe(
          switchMap(() =>
            this.http.put<TagResponse>(`/api/account/tags/${encodeURIComponent(id)}`, this.requestBody(input)),
          ),
        );
    return request.pipe(
      map((response) => this.toLocalTag(response, token ?? undefined)),
      tap((tag) => this.localTags.saveRemote({ ...tag, qrCodeDataUri: undefined })),
    );
  }

  deactivate(tag: NfcTag): Observable<void> {
    if (!tag.managementToken && !tag.accountOwned) {
      throw new Error('Esta placa não possui credencial de gerenciamento neste navegador.');
    }
    const url = tag.managementToken
      ? `/api/tags/${encodeURIComponent(tag.id)}`
      : `/api/account/tags/${encodeURIComponent(tag.id)}`;
    return this.fetchCsrf().pipe(
      switchMap(() =>
        this.http.delete<void>(url, {
          headers: tag.managementToken ? { 'X-Tag-Management-Token': tag.managementToken } : undefined,
        }),
      ),
      tap(() => this.localTags.remove(tag.id)),
    );
  }

  listAccountTags(): Observable<AccountTag[]> {
    return this.http.get<AccountTag[]>('/api/account/tags');
  }

  /** Traz para o navegador as placas da conta que ainda não existem (ou mudaram) localmente. */
  importAccountTags(accountTags: AccountTag[]): void {
    const local = new Map(this.localTags.list().map((tag) => [tag.id, tag]));
    for (const remote of accountTags) {
      if (!remote.type || remote.active === false) {
        continue;
      }
      const existing = local.get(remote.id);
      if (existing && existing.updatedAt === remote.updatedAt) {
        continue;
      }
      this.localTags.saveRemote({
        ...this.toLocalTag(remote as TagResponse, existing?.managementToken),
        qrCodeDataUri: undefined,
      });
    }
  }

  claimAccountTags(tags: TagClaim[]): Observable<AccountTag[]> {
    return this.fetchCsrf().pipe(
      switchMap(() => this.http.post<AccountTag[]>('/api/account/tags/claim', { tags })),
    );
  }

  searchPlaces(query: string): Observable<PlaceResult[]> {
    const params = new HttpParams().set('q', query);
    return this.http.get<PlaceResult[]>('/api/places/search', { params });
  }

  placeDetails(placeId: string, includeReviews = false): Observable<PlaceDetails> {
    return this.http
      .get<PlaceDetails>(`/api/places/${encodeURIComponent(placeId)}/details`, {
        params: includeReviews ? new HttpParams().set('includeReviews', 'true') : undefined,
      });
  }

  previewPix(key: string, receiverName: string, city: string): Observable<PixPreview> {
    return this.fetchCsrf().pipe(
      switchMap(() => this.http.post<PixPreview>('/api/pix/payload', { key, receiverName, city })),
    );
  }

  writeConfiguration(id: string): Observable<WriteConfiguration> {
    return this.http.get<WriteConfiguration>(`/api/tags/public/${encodeURIComponent(id)}/write`);
  }

  publicQrConfiguration(id: string): Observable<PublicQrConfiguration> {
    return this.http.get<PublicQrConfiguration>(`/api/tags/public/${encodeURIComponent(id)}/qr`);
  }

  private fetchCsrf(): Observable<string> {
    return this.http.get<{ token: string }>('/api/auth/csrf').pipe(
      tap(({ token }) => {
        this.sessionStore.csrfToken = token;
      }),
      map(({ token }) => token),
    );
  }

  private requestBody(input: NfcTagInput, managementToken?: string) {
    return {
      name: input.name,
      type: input.type,
      destinationUrl: input.destinationUrl || null,
      destinationLabel: input.destinationLabel || null,
      pixKey: input.pixKey || null,
      pixReceiverName: input.pixReceiverName || null,
      pixCity: input.pixCity || null,
      salePrice: input.salePrice ?? null,
      managementToken: managementToken ?? null,
    };
  }

  private toLocalTag(response: TagResponse, managementToken?: string): NfcTag {
    return {
      id: response.id,
      name: response.name,
      type: response.type,
      destinationUrl: response.destinationUrl,
      destinationLabel: response.destinationLabel ?? undefined,
      pixKey: response.pixKey ?? undefined,
      pixReceiverName: response.pixReceiverName ?? undefined,
      pixCity: response.pixCity ?? undefined,
      salePrice: response.salePrice ?? undefined,
      publicUrl: response.publicUrl,
      managementToken,
      accountOwned: managementToken ? undefined : true,
      qrCodeDataUri: response.qrCodeDataUri,
      active: response.active,
      createdAt: response.createdAt,
      updatedAt: response.updatedAt,
    };
  }
}
