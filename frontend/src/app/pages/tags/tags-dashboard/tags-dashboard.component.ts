import { DatePipe } from '@angular/common';
import { Component, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthSessionStore } from '../../../core/auth/auth-session.store';
import { LocalTagsError, LocalTagsService } from '../../../core/tags/local-tags.service';
import { TagAccountSyncService } from '../../../core/tags/tag-account-sync.service';
import { LocalClientsService } from '../../../core/clients/local-clients.service';
import { formatBrl, NfcTag, tagTypeLabel } from '../../../core/tags/nfc-tag';
import { PublicQrConfiguration, TagsApiService } from '../../../core/tags/tags-api.service';
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
  readonly qrTag = signal<NfcTag | null>(null);
  readonly qrConfiguration = signal<PublicQrConfiguration | null>(null);
  readonly qrLoading = signal(false);
  readonly qrError = signal('');
  readonly qrFeedback = signal('');
  readonly typeLabel = tagTypeLabel;
  readonly formatPrice = formatBrl;
  @ViewChild('qrDialog') private qrDialog?: ElementRef<HTMLDialogElement>;

  constructor() {
    const state = inject(Router).getCurrentNavigation()?.extras.state;
    if (typeof state?.['notice'] === 'string') {
      this.notice.set(state['notice']);
    }
    this.reload();
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
    const publicUrl = this.qrTag()?.id === tag.id
      ? this.qrConfiguration()?.publicUrl ?? tag.publicUrl
      : tag.publicUrl;
    if (!publicUrl) {
      this.actionError.set('Esta placa antiga ainda não possui um link público. Edite-a para publicar.');
      return;
    }
    try {
      await navigator.clipboard.writeText(publicUrl);
      this.actionError.set('');
      if (this.qrTag()?.id === tag.id) {
        this.qrFeedback.set('Link copiado com sucesso.');
      } else {
        this.notice.set('Link público copiado.');
      }
    } catch {
      if (this.qrTag()?.id === tag.id) {
        this.qrError.set('Não foi possível copiar o link. Verifique a permissão do navegador.');
      } else {
        this.actionError.set('Não foi possível copiar o link. Verifique a permissão do navegador.');
      }
    }
  }

  openQrCode(tag: NfcTag): void {
    if (!tag.publicUrl) {
      return;
    }
    this.qrTag.set(tag);
    this.qrConfiguration.set(null);
    this.qrLoading.set(true);
    this.qrError.set('');
    this.qrFeedback.set('');
    this.qrDialog?.nativeElement.showModal();
    this.tagsApi.publicQrConfiguration(tag.id).subscribe({
      next: (configuration) => {
        this.qrConfiguration.set(configuration);
        this.qrLoading.set(false);
      },
      error: () => {
        this.qrLoading.set(false);
        this.qrError.set('Não foi possível carregar o QR Code. Tente novamente.');
      },
    });
  }

  closeQrCode(): void {
    this.qrDialog?.nativeElement.close();
  }

  onQrDialogClose(): void {
    this.qrTag.set(null);
    this.qrConfiguration.set(null);
    this.qrLoading.set(false);
    this.qrError.set('');
    this.qrFeedback.set('');
  }

  closeQrOnBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeQrCode();
    }
  }

  async downloadQrCode(): Promise<void> {
    const tag = this.qrTag();
    const configuration = this.qrConfiguration();
    if (!tag || !configuration) {
      return;
    }
    this.qrError.set('');
    this.qrFeedback.set('');
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Não foi possível carregar o QR Code.'));
        image.src = configuration.qrCodeDataUri;
      });

      const size = 1200;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Não foi possível preparar a imagem.');
      }
      context.fillStyle = '#fff';
      context.fillRect(0, 0, size, size);
      context.imageSmoothingEnabled = false;
      context.drawImage(image, 0, 0, size, size);
      const png = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Não foi possível gerar a imagem PNG.'));
          }
        }, 'image/png');
      });

      const downloadUrl = URL.createObjectURL(png);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = `nfcapp-qrcode-${tag.id}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      this.qrFeedback.set('PNG baixado com sucesso.');
    } catch {
      this.qrError.set('Não foi possível preparar o PNG. Tente novamente.');
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
}
