import { Injectable } from '@angular/core';
import { isNfcTagType, NfcTag, NfcTagInput, validateTagInput } from './nfc-tag';

export const LOCAL_TAGS_STORAGE_KEY = 'nfcapp.tags.v1';

export type LocalTagsErrorCode = 'unavailable' | 'corrupted' | 'write' | 'invalid' | 'not-found';

export class LocalTagsError extends Error {
  constructor(
    readonly code: LocalTagsErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'LocalTagsError';
  }
}

@Injectable({ providedIn: 'root' })
export class LocalTagsService {
  list(): NfcTag[] {
    return this.readAll();
  }

  getById(id: string): NfcTag | undefined {
    return this.readAll().find((tag) => tag.id === id);
  }

  create(input: NfcTagInput): NfcTag {
    const normalized = this.normalizeInput(input);
    const tags = this.readAll();
    const now = new Date().toISOString();
    const tag: NfcTag = { id: crypto.randomUUID(), ...normalized, createdAt: now, updatedAt: now };
    this.writeAll([...tags, tag]);
    return tag;
  }

  update(id: string, input: NfcTagInput): NfcTag {
    const normalized = this.normalizeInput(input);
    const tags = this.readAll();
    const current = tags.find((tag) => tag.id === id);
    if (!current) {
      throw new LocalTagsError('not-found', 'Placa não encontrada.');
    }

    const updated: NfcTag = { ...current, ...normalized, updatedAt: new Date().toISOString() };
    this.writeAll(tags.map((tag) => (tag.id === id ? updated : tag)));
    return updated;
  }

  duplicate(id: string): NfcTag {
    const tags = this.readAll();
    const source = tags.find((tag) => tag.id === id);
    if (!source) {
      throw new LocalTagsError('not-found', 'Placa não encontrada.');
    }

    const now = new Date().toISOString();
    const copy: NfcTag = {
      ...source,
      id: crypto.randomUUID(),
      name: source.name,
      publicUrl: undefined,
      managementToken: undefined,
      qrCodeDataUri: undefined,
      active: undefined,
      createdAt: now,
      updatedAt: now,
    };
    this.writeAll([...tags, copy]);
    return copy;
  }

  saveRemote(tag: NfcTag): void {
    if (!this.isValidTag(tag)) {
      throw new LocalTagsError('invalid', 'Os dados recebidos para a placa são inválidos.');
    }
    const tags = this.readAll();
    this.writeAll([tag, ...tags.filter((current) => current.id !== tag.id)]);
  }

  remove(id: string): void {
    const tags = this.readAll();
    if (!tags.some((tag) => tag.id === id)) {
      throw new LocalTagsError('not-found', 'Placa não encontrada.');
    }
    this.writeAll(tags.filter((tag) => tag.id !== id));
  }

  private normalizeInput(input: NfcTagInput): NfcTagInput {
    const normalized: NfcTagInput = {
      name: input.name.trim(),
      type: input.type,
      destinationUrl: input.destinationUrl.trim(),
      destinationLabel: input.destinationLabel?.trim() || undefined,
      pixKey: input.pixKey?.trim() || undefined,
      pixReceiverName: input.pixReceiverName?.trim() || undefined,
      pixCity: input.pixCity?.trim() || undefined,
    };
    const error = validateTagInput(normalized);
    if (error) {
      throw new LocalTagsError('invalid', error);
    }
    return normalized;
  }

  // Qualquer dado inválido interrompe a leitura: nunca regravamos por cima de dados que não entendemos.
  private readAll(): NfcTag[] {
    let raw: string | null;
    try {
      raw = localStorage.getItem(LOCAL_TAGS_STORAGE_KEY);
    } catch {
      throw new LocalTagsError('unavailable', 'O armazenamento local do navegador não está disponível.');
    }

    if (raw === null) {
      return [];
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw this.corruptedError();
    }

    if (!Array.isArray(parsed) || !parsed.every((item) => this.isValidTag(item))) {
      throw this.corruptedError();
    }

    return [...(parsed as NfcTag[])].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }

  private writeAll(tags: NfcTag[]): void {
    try {
      localStorage.setItem(LOCAL_TAGS_STORAGE_KEY, JSON.stringify(tags));
    } catch {
      throw new LocalTagsError(
        'write',
        'Não foi possível salvar neste navegador. Verifique o espaço disponível e as permissões.',
      );
    }
  }

  private isValidTag(value: unknown): value is NfcTag {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const tag = value as Record<string, unknown>;
    return (
      typeof tag['id'] === 'string' &&
      tag['id'].length > 0 &&
      typeof tag['name'] === 'string' &&
      typeof tag['destinationUrl'] === 'string' &&
      typeof tag['createdAt'] === 'string' &&
      typeof tag['updatedAt'] === 'string' &&
      !Number.isNaN(Date.parse(tag['createdAt'])) &&
      !Number.isNaN(Date.parse(tag['updatedAt'])) &&
      isNfcTagType(tag['type']) &&
      (tag['publicUrl'] === undefined || typeof tag['publicUrl'] === 'string') &&
      (tag['managementToken'] === undefined || typeof tag['managementToken'] === 'string') &&
      (tag['qrCodeDataUri'] === undefined || typeof tag['qrCodeDataUri'] === 'string') &&
      (tag['active'] === undefined || typeof tag['active'] === 'boolean') &&
      (tag['destinationLabel'] === undefined || typeof tag['destinationLabel'] === 'string') &&
      (tag['pixKey'] === undefined || typeof tag['pixKey'] === 'string') &&
      (tag['pixReceiverName'] === undefined || typeof tag['pixReceiverName'] === 'string') &&
      (tag['pixCity'] === undefined || typeof tag['pixCity'] === 'string') &&
      validateTagInput({
        name: tag['name'],
        type: tag['type'],
        destinationUrl: tag['destinationUrl'],
      }) === null
    );
  }

  private corruptedError(): LocalTagsError {
    return new LocalTagsError(
      'corrupted',
      `Os dados salvos em "${LOCAL_TAGS_STORAGE_KEY}" estão inválidos. Eles foram mantidos sem alteração para não perder informações.`,
    );
  }
}
