import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthSessionStore } from '../../../core/auth/auth-session.store';
import { LocalTagsError, LocalTagsService } from '../../../core/tags/local-tags.service';
import { TagAccountSyncService } from '../../../core/tags/tag-account-sync.service';
import { ClientPlace, LocalClientsService } from '../../../core/clients/local-clients.service';
import { formatBrl, NfcTag, NfcTagInput, tagTypeLabel } from '../../../core/tags/nfc-tag';
import { TagsApiService } from '../../../core/tags/tags-api.service';
import { ButtonComponent } from '../../../shared/components/ui/button/button.component';

@Component({
  selector: 'app-tags-dashboard',
  imports: [DatePipe, RouterLink, ButtonComponent],
  host: { class: 'block' },
  templateUrl: './tags-dashboard.component.html',
})
export class TagsDashboardComponent {
  readonly session = inject(AuthSessionStore);
  readonly tagSync = inject(TagAccountSyncService);
  private readonly localTags = inject(LocalTagsService);
  private readonly localClients = inject(LocalClientsService);
  private readonly tagsApi = inject(TagsApiService);

  readonly tags = signal<NfcTag[]>([]);
  readonly loadError = signal('');
  readonly actionError = signal('');
  readonly notice = signal('');
  readonly tagPendingRemoval = signal<NfcTag | null>(null);
  readonly typeLabel = tagTypeLabel;
  readonly formatPrice = formatBrl;

  constructor() {
    const state = inject(Router).getCurrentNavigation()?.extras.state;
    if (typeof state?.['notice'] === 'string') {
      this.notice.set(state['notice']);
    }
    this.reload();
  }

  duplicate(tag: NfcTag): void {
    this.actionError.set('');
    this.notice.set('');
    let place: ClientPlace | undefined;
    try {
      place = this.localClients.placeForTag(tag);
    } catch (error) {
      this.actionError.set(this.messageFrom(error));
      return;
    }
    const type = tag.type === 'pix' && !tag.pixKey ? 'url' : tag.type;
    const input: NfcTagInput = {
      name: tag.name,
      type,
      destinationUrl: type === 'pix' ? '' : tag.destinationUrl,
      destinationLabel: tag.destinationLabel,
      pixKey: tag.pixKey,
      pixReceiverName: tag.pixReceiverName,
      pixCity: tag.pixCity,
    };
    const token = this.randomToken();
    this.tagsApi.create(input, token, crypto.randomUUID()).subscribe({
      next: (copy) => {
        this.notice.set('Placa duplicada com um novo link público.');
        try {
          this.localClients.setPlace(copy, place ?? null);
        } catch (error) {
          this.actionError.set(`Placa duplicada, mas o vínculo do estabelecimento não foi salvo: ${this.messageFrom(error)}`);
        }
        this.reload();
      },
      error: (error: unknown) => this.actionError.set(this.messageFrom(error)),
    });
  }

  askRemoval(tag: NfcTag): void {
    this.tagPendingRemoval.set(tag);
  }

  cancelRemoval(): void {
    this.tagPendingRemoval.set(null);
  }

  confirmRemoval(): void {
    const tag = this.tagPendingRemoval();
    if (!tag) {
      return;
    }
    this.tagPendingRemoval.set(null);
    this.actionError.set('');
    this.notice.set('');
    if (tag.managementToken || tag.accountOwned) {
      this.tagsApi.deactivate(tag).subscribe({
        next: () => {
          this.notice.set('Placa desativada e removida da listagem.');
          try {
            this.localClients.forgetTag(tag.id);
          } catch (error) {
            this.actionError.set(this.messageFrom(error));
          }
          this.reload();
        },
        error: (error: unknown) => this.actionError.set(this.messageFrom(error)),
      });
      return;
    }
    this.runLocalAction(() => {
      this.localTags.remove(tag.id);
      this.localClients.forgetTag(tag.id);
      return 'Placa local removida deste navegador.';
    });
  }

  async copyLink(tag: NfcTag): Promise<void> {
    if (!tag.publicUrl) {
      this.actionError.set('Esta placa antiga ainda não possui um link público. Edite-a para publicar.');
      return;
    }
    try {
      await navigator.clipboard.writeText(tag.publicUrl);
      this.actionError.set('');
      this.notice.set('Link público copiado.');
    } catch {
      this.actionError.set('Não foi possível copiar o link. Verifique a permissão do navegador.');
    }
  }

  dismissNotice(): void {
    this.notice.set('');
  }

  private runLocalAction(action: () => string): void {
    try {
      this.notice.set(action());
    } catch (error) {
      this.actionError.set(this.messageFrom(error));
    }
    this.reload();
  }

  private reload(): void {
    try {
      this.tags.set(this.localTags.list());
      this.loadError.set('');
    } catch (error) {
      this.tags.set([]);
      this.loadError.set(this.messageFrom(error));
    }
  }

  private messageFrom(error: unknown): string {
    if (error instanceof LocalTagsError) {
      return error.message;
    }
    if (typeof error === 'object' && error !== null && 'error' in error) {
      const body = (error as { error?: { detail?: unknown; message?: unknown } }).error;
      if (typeof body?.detail === 'string') {
        return body.detail;
      }
      if (typeof body?.message === 'string') {
        return body.message;
      }
    }
    return error instanceof Error ? error.message : 'Ocorreu um erro inesperado. Tente novamente.';
  }

  private randomToken(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
}
