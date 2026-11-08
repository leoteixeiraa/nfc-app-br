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
}

export interface PlaceDetails extends PlaceResult {
  rating: number | null;
  userRatingCount: number | null;
  photoUrl: string | null;
  photoAttributions: Array<{ displayName: string; uri: string | null }>;
  googleMapsUrl: string | null;
  reviewUrl: string;
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

  update(id: string, input: NfcTagInput, token: string): Observable<NfcTag> {
    return this.fetchCsrf().pipe(
      switchMap(() =>
        this.http.put<TagResponse>(`/api/tags/${encodeURIComponent(id)}`, this.requestBody(input), {
          headers: { 'X-Tag-Management-Token': token },
        }),
      ),
      map((response) => this.toLocalTag(response, token)),
      tap((tag) => this.localTags.saveRemote({ ...tag, qrCodeDataUri: undefined })),
    );
  }

  deactivate(tag: NfcTag): Observable<void> {
    if (!tag.managementToken) {
      throw new Error('Esta placa não possui credencial de gerenciamento neste navegador.');
    }
    return this.fetchCsrf().pipe(
      switchMap(() =>
        this.http.delete<void>(`/api/tags/${encodeURIComponent(tag.id)}`, {
          headers: { 'X-Tag-Management-Token': tag.managementToken! },
        }),
      ),
      tap(() => this.localTags.remove(tag.id)),
    );
  }

  searchPlaces(query: string): Observable<PlaceResult[]> {
    const params = new HttpParams().set('q', query);
    return this.http.get<PlaceResult[]>('/api/places/search', { params });
  }

  placeDetails(placeId: string): Observable<PlaceDetails> {
    return this.http
      .get<PlaceDetails>(`/api/places/${encodeURIComponent(placeId)}/details`);
  }

  previewPix(key: string, receiverName: string, city: string): Observable<PixPreview> {
    return this.fetchCsrf().pipe(
      switchMap(() => this.http.post<PixPreview>('/api/pix/payload', { key, receiverName, city })),
    );
  }

  writeConfiguration(id: string): Observable<WriteConfiguration> {
    return this.http.get<WriteConfiguration>(`/api/tags/public/${encodeURIComponent(id)}/write`);
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
      managementToken: managementToken ?? null,
    };
  }

  private toLocalTag(response: TagResponse, managementToken: string): NfcTag {
    return {
      id: response.id,
      name: response.name,
      type: response.type,
      destinationUrl: response.destinationUrl,
      destinationLabel: response.destinationLabel ?? undefined,
      pixKey: response.pixKey ?? undefined,
      pixReceiverName: response.pixReceiverName ?? undefined,
      pixCity: response.pixCity ?? undefined,
      publicUrl: response.publicUrl,
      managementToken,
      qrCodeDataUri: response.qrCodeDataUri,
      active: response.active,
      createdAt: response.createdAt,
      updatedAt: response.updatedAt,
    };
  }
}
