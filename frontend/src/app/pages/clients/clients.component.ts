import { Component, inject, signal } from '@angular/core';
import { Client, LocalClientsService } from '../../core/clients/local-clients.service';
import { ClientReportService } from '../../core/clients/client-report.service';
import { AuthSessionStore } from '../../core/auth/auth-session.store';
import { TagAccountSyncService } from '../../core/tags/tag-account-sync.service';
import { PageBreadcrumbComponent } from '../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { TableThreeComponent } from '../tables/components/basic-tables/table-three/table-three.component';

@Component({
  selector: 'app-clients',
  imports: [PageBreadcrumbComponent, TableThreeComponent],
  host: { class: 'block' },
  template: `
    <app-page-breadcrumb pageTitle="Clientes" />
    @if (clients().length > 0) {
      <p class="mb-4 text-sm text-gray-500 dark:text-gray-400">Os dados de clientes ficam somente neste navegador e ainda não são sincronizados com a conta. As estatísticas de acessos são exemplos.</p>
    }
    @if (session.currentUser() && tagSync.status() === 'syncing' && tagSync.pendingImportCount() === 0) {
      <p role="status" class="mb-4 rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
        Verificando a sincronização das placas com sua conta...
      </p>
    }
    @if (session.currentUser() && (tagSync.status() === 'syncing' || tagSync.status() === 'pending' || tagSync.status() === 'error') && tagSync.pendingImportCount() > 0) {
      <p role="status" class="mb-4 rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
        Existem {{ tagSync.pendingImportCount() }} {{ tagSync.pendingImportCount() === 1 ? 'placa aguardando' : 'placas aguardando' }} importação para sua conta.
      </p>
    }
    @if (session.currentUser() && tagSync.status() === 'error') {
      <div role="alert" class="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-warning-500/40 bg-warning-50 p-3 text-sm text-warning-700 dark:bg-warning-500/10 dark:text-warning-400">
        <span>Não foi possível confirmar a sincronização das placas. {{ tagSync.error() }}</span>
        <button type="button" class="font-medium underline" (click)="tagSync.retry()">Tentar novamente</button>
      </div>
    }
    @if (error()) {
      <p role="alert" class="mb-4 text-sm text-error-500">{{ error() }}</p>
    }
    @if (generating()) {
      <p role="status" class="mb-4 text-sm text-gray-500">Gerando relatório PDF...</p>
    }
    @if (loaded()) {
      <app-table-three [clients]="clients()" [reportLoading]="generating()" (report)="download($event)" />
    }
  `,
})
export class ClientsComponent {
  private readonly service = inject(LocalClientsService);
  private readonly reports = inject(ClientReportService);
  readonly session = inject(AuthSessionStore);
  readonly tagSync = inject(TagAccountSyncService);
  readonly clients = signal<Client[]>([]);
  readonly error = signal('');
  readonly loaded = signal(false);
  readonly generating = signal(false);

  constructor() {
    try {
      this.clients.set(this.service.list());
      this.loaded.set(true);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Não foi possível carregar os clientes.');
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
