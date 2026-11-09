import { Injectable, inject } from '@angular/core';
import { LocalTagsService } from '../tags/local-tags.service';
import { NfcTag } from '../tags/nfc-tag';
import { PlaceDetails } from '../tags/tags-api.service';

export const LOCAL_CLIENTS_STORAGE_KEY = 'nfcapp.clients.v1';

export interface ClientPlace {
  placeId: string;
  name: string;
  address: string;
  reviewUrl: string;
  rating: number | null;
  userRatingCount: number | null;
  googleMapsUrl: string | null;
  category?: string | null;
  phone?: string | null;
  website?: string | null;
}

interface ClientRecord extends ClientPlace {
  createdAt: string;
  local?: boolean;
}

interface TagLink {
  tagId: string;
  destinationUrl: string;
  placeId: string;
  pending?: ClientPlace;
}

interface ClientStore {
  clients: ClientRecord[];
  links: TagLink[];
}

export interface ScanStatistics {
  total: number;
  last7Days: number;
  last30Days: number;
  lastAccess: string | null;
}

export interface Client extends ClientRecord {
  tags: NfcTag[];
  statistics: ScanStatistics;
}

export type LocalClientsErrorCode = 'not-found' | 'linked-tags';

export class LocalClientsError extends Error {
  constructor(
    readonly code: LocalClientsErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'LocalClientsError';
  }
}

@Injectable({ providedIn: 'root' })
export class LocalClientsService {
  private readonly tags = inject(LocalTagsService);

  list(): Client[] {
    const store = this.read();
    const tags = this.tags.list();
    let changed = false;
    for (const tag of tags) {
      if (!tag.publicUrl) continue;
      const link = store.links.find((item) => item.tagId === tag.id);
      if (!link || link.pending || !this.matches(link, tag)) {
        this.associate(store, tag, link?.pending && this.matches(link, tag) ? link.pending : null);
        changed = true;
      }
    }
    if (changed) this.write(store);
    return store.clients.map((client) => ({
      ...client,
      tags: tags.filter((tag) => store.links.some((link) =>
        !link.pending && link.placeId === client.placeId && this.matches(link, tag))),
      statistics: this.statistics(client.placeId),
    })).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  get(placeId: string): Client | undefined {
    return this.list().find((client) => client.placeId === placeId);
  }

  placeForTag(tag: NfcTag): ClientPlace | undefined {
    const store = this.read();
    const link = store.links.find((item) => this.matches(item, tag));
    const client = store.clients.find((item) => item.placeId === link?.placeId);
    return link?.pending ?? (client && !client.local && tag.type === 'google-review' ? client : undefined);
  }

  setPlace(tag: NfcTag, place: PlaceDetails | ClientPlace | null): void {
    const store = this.read();
    this.associate(store, tag, place);
    this.write(store);
  }

  remove(placeId: string): void {
    const client = this.get(placeId);
    if (!client) {
      throw new LocalClientsError('not-found', 'Cliente não encontrado neste navegador.');
    }
    if (client.tags.length > 0) {
      const count = client.tags.length;
      throw new LocalClientsError(
        'linked-tags',
        `Não é possível excluir este cliente enquanto houver ${count} ${count === 1 ? 'placa vinculada' : 'placas vinculadas'}.`,
      );
    }

    const store = this.read();
    store.clients = store.clients.filter((item) => item.placeId !== placeId);
    store.links = store.links.filter((link) => link.placeId !== placeId);
    this.write(store);
  }

  private associate(store: ClientStore, tag: NfcTag, place: PlaceDetails | ClientPlace | null): void {
    const old = store.links.find((link) => link.tagId === tag.id);
    store.links = store.links.filter((link) => link.tagId !== tag.id);
    if (place && place.placeId && tag.type === 'google-review' && tag.destinationUrl === place.reviewUrl) {
      const { placeId, name, address, reviewUrl, rating, userRatingCount, googleMapsUrl, category, phone, website } = place;
      let client = store.clients.find((item) => !item.local && item.placeId === placeId);
      const local = store.clients.find((item) => item.local && this.sameName(item.name, name));
      if (local) {
        for (const link of store.links) {
          if (link.placeId === local.placeId) link.placeId = placeId;
        }
        store.clients = store.clients.filter((item) => item !== local);
      }
      if (!client) {
        client = { placeId, name, address, reviewUrl, rating, userRatingCount, googleMapsUrl, category, phone, website, createdAt: local?.createdAt ?? tag.createdAt };
        store.clients.push(client);
      }
      store.links.push({ tagId: tag.id, destinationUrl: tag.destinationUrl, placeId: client.placeId });
      return;
    }
    const name = tag.pixReceiverName || tag.destinationLabel || tag.name;
    const oldClient = store.clients.find((item) => item.placeId === old?.placeId);
    let client = oldClient && this.sameName(oldClient.name, name)
      ? oldClient
      : store.clients.find((item) => this.sameName(item.name, name));
    if (!client) {
      client = {
        placeId: `local:${crypto.randomUUID()}`, local: true, name, address: '', reviewUrl: '',
        rating: null, userRatingCount: null, googleMapsUrl: null, createdAt: tag.createdAt,
      };
      store.clients.push(client);
    }
    store.links.push({ tagId: tag.id, destinationUrl: tag.destinationUrl, placeId: client.placeId });
  }

  clearAll(): void {
    try {
      localStorage.removeItem(LOCAL_CLIENTS_STORAGE_KEY);
    } catch {
      throw new Error('Não foi possível limpar os clientes deste navegador.');
    }
  }

  forgetTag(tagId: string): void {
    const store = this.read();
    const links = store.links.filter((link) => link.tagId !== tagId);
    if (links.length !== store.links.length) {
      store.links = links;
      this.write(store);
    }
  }

  private matches(link: TagLink, tag: NfcTag): boolean {
    return link.tagId === tag.id && link.destinationUrl === tag.destinationUrl;
  }

  private sameName(first: string, second: string): boolean {
    const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
    return normalize(first) === normalize(second);
  }

  private statistics(_placeId: string): ScanStatistics {
    return { total: 0, last7Days: 0, last30Days: 0, lastAccess: null };
  }

  private read(): ClientStore {
    let raw: string | null;
    try {
      raw = localStorage.getItem(LOCAL_CLIENTS_STORAGE_KEY);
    } catch {
      throw new Error('Não foi possível acessar seus clientes neste navegador. Verifique as permissões e tente novamente.');
    }
    if (raw === null) return { clients: [], links: [] };
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      throw new Error('Os dados locais de clientes estão inválidos e foram preservados.');
    }
    if (!this.isStore(value)) {
      throw new Error('Os dados locais de clientes estão inválidos e foram preservados.');
    }
    return value;
  }

  private write(store: ClientStore): void {
    try {
      localStorage.setItem(LOCAL_CLIENTS_STORAGE_KEY, JSON.stringify(store));
    } catch {
      throw new Error('Não foi possível salvar os clientes neste navegador. Verifique o espaço e as permissões.');
    }
  }

  private isPlace(value: unknown): value is ClientPlace {
    if (typeof value !== 'object' || value === null) return false;
    const p = value as Record<string, unknown>;
    return typeof p['placeId'] === 'string' && !!p['placeId'] &&
      typeof p['name'] === 'string' && typeof p['address'] === 'string' &&
      typeof p['reviewUrl'] === 'string' &&
      (p['rating'] === null || typeof p['rating'] === 'number') &&
      (p['userRatingCount'] === null || typeof p['userRatingCount'] === 'number') &&
      (p['googleMapsUrl'] === null || typeof p['googleMapsUrl'] === 'string') &&
      ['category', 'phone', 'website'].every((key) => p[key] == null || typeof p[key] === 'string');
  }

  private isStore(value: unknown): value is ClientStore {
    if (typeof value !== 'object' || value === null) return false;
    const store = value as Record<string, unknown>;
    return Array.isArray(store['clients']) && Array.isArray(store['links']) &&
      store['clients'].every((client: unknown) => this.isPlace(client) &&
        typeof (client as ClientRecord).createdAt === 'string' && !Number.isNaN(Date.parse((client as ClientRecord).createdAt)) &&
        ((client as ClientRecord).local === undefined || typeof (client as ClientRecord).local === 'boolean')) &&
      store['links'].every((item: unknown) => {
        if (typeof item !== 'object' || item === null) return false;
        const link = item as Record<string, unknown>;
        return typeof link['tagId'] === 'string' && typeof link['placeId'] === 'string' &&
          typeof link['destinationUrl'] === 'string' &&
          (link['pending'] === undefined || (this.isPlace(link['pending']) && link['pending'].placeId === link['placeId']));
      });
  }
}
