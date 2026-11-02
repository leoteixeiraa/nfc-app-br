import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LocalTagsError, LocalTagsService } from '../../../core/tags/local-tags.service';
import { NfcTag, tagTypeLabel } from '../../../core/tags/nfc-tag';
import { ButtonComponent } from '../../../shared/components/ui/button/button.component';

@Component({
  selector: 'app-tags-dashboard',
  imports: [DatePipe, RouterLink, ButtonComponent],
  host: { class: 'block' },
  templateUrl: './tags-dashboard.component.html',
})
export class TagsDashboardComponent {
  private readonly localTags = inject(LocalTagsService);

  readonly tags = signal<NfcTag[]>([]);
  readonly loadError = signal('');
  readonly actionError = signal('');
  readonly notice = signal('');
  readonly tagPendingRemoval = signal<NfcTag | null>(null);
  readonly typeLabel = tagTypeLabel;

  constructor() {
    const state = inject(Router).getCurrentNavigation()?.extras.state;
    if (typeof state?.['notice'] === 'string') {
      this.notice.set(state['notice']);
    }
    this.reload();
  }

  duplicate(tag: NfcTag): void {
    this.runAction(() => {
      this.localTags.duplicate(tag.id);
      return 'Placa duplicada com sucesso.';
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
    this.runAction(() => {
      this.localTags.remove(tag.id);
      return 'Placa excluída com sucesso.';
    });
  }

  dismissNotice(): void {
    this.notice.set('');
  }

  private runAction(action: () => string): void {
    this.actionError.set('');
    this.notice.set('');
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
    return error instanceof LocalTagsError ? error.message : 'Ocorreu um erro inesperado. Tente novamente.';
  }
}
