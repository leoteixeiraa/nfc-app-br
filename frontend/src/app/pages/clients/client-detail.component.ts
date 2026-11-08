import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Client, LocalClientsService } from '../../core/clients/local-clients.service';
import { ClientReportService } from '../../core/clients/client-report.service';
import { tagTypeLabel } from '../../core/tags/nfc-tag';
import { PageBreadcrumbComponent } from '../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { ButtonComponent } from '../../shared/components/ui/button/button.component';

@Component({
  selector: 'app-client-detail',
  imports: [DatePipe, RouterLink, PageBreadcrumbComponent, ButtonComponent],
  host: { class: 'block' },
  templateUrl: './client-detail.component.html',
})
export class ClientDetailComponent {
  private readonly service = inject(LocalClientsService);
  private readonly reports = inject(ClientReportService);
  readonly client = signal<Client | undefined>(undefined);
  readonly error = signal('');
  readonly generating = signal(false);
  readonly typeLabel = tagTypeLabel;

  constructor() {
    const id = inject(ActivatedRoute).snapshot.paramMap.get('placeId');
    try {
      this.client.set(id ? this.service.get(id) : undefined);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Não foi possível carregar o cliente.');
    }
  }

  async download(client: Client): Promise<void> {
    if (this.generating()) return;
    this.error.set('');
    this.generating.set(true);
    try {
      await this.reports.download(client);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Não foi possível gerar o relatório.');
    } finally {
      this.generating.set(false);
    }
  }
}
