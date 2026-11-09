import { DatePipe } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthSessionStore } from '../../core/auth/auth-session.store';
import { LOCAL_CLIENTS_STORAGE_KEY, LocalClientsService, Client } from '../../core/clients/local-clients.service';
import { LOCAL_TAGS_STORAGE_KEY, LocalTagsService } from '../../core/tags/local-tags.service';
import { TagAccountSyncService } from '../../core/tags/tag-account-sync.service';
import { formatBrl, NfcTag, tagTypeLabel } from '../../core/tags/nfc-tag';
import { ButtonComponent } from '../../shared/components/ui/button/button.component';
import { TABLE_IMPORTS } from '../../shared/components/ui/table';
import { BarChartOneComponent } from '../charts/components/bar/bar-chart-one/bar-chart-one.component';
import { LineChartOneComponent } from '../charts/components/line/line-chart-one/line-chart-one.component';
import { dashboardData, DashboardPeriod } from './dashboard-data';

@Component({
  selector: 'app-dashboard',
  imports: [DatePipe, RouterLink, ButtonComponent, ...TABLE_IMPORTS, LineChartOneComponent, BarChartOneComponent],
  host: { class: 'block' },
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  private readonly tagsService = inject(LocalTagsService);
  private readonly clientsService = inject(LocalClientsService);
  readonly session = inject(AuthSessionStore);
  readonly tagSync = inject(TagAccountSyncService);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly tags = signal<NfcTag[]>([]);
  readonly clients = signal<Client[]>([]);
  readonly period = signal<DashboardPeriod>('all');
  readonly chartMonths = signal<6 | 12>(12);
  readonly now = signal(new Date());
  readonly data = computed(() => dashboardData(this.tags(), this.clients(), this.period(), this.chartMonths(), this.now()));
  readonly isExample = computed(() => this.tags().length === 0 && this.clients().length === 0);
  readonly exampleCounts = [1, 2, 1, 2, 1, 3, 2, 3, 2, 3, 2, 4];
  readonly revenueChart = computed(() => ({
    categories: this.data().categories,
    values: this.isExample() ? this.exampleCounts.slice(-this.chartMonths()).map(count => count * 100) : this.data().revenueByMonth,
  }));
  readonly tagsChart = computed(() => ({
    categories: this.data().categories,
    values: this.isExample() ? this.exampleCounts.slice(-this.chartMonths()) : this.data().tagsByMonth,
  }));
  readonly formatPrice = formatBrl;
  readonly typeLabel = tagTypeLabel;
  readonly hasValue = (value: number): boolean => value > 0;

  constructor() {
    queueMicrotask(() => this.reload());
  }

  @HostListener('window:storage', ['$event'])
  onStorage(event: StorageEvent): void {
    if (event.key === null || event.key === LOCAL_TAGS_STORAGE_KEY || event.key === LOCAL_CLIENTS_STORAGE_KEY) {
      this.reload();
    }
  }

  setPeriod(value: string): void {
    if (value === 'month' || value === '30days' || value === '6months' || value === '12months' || value === 'all') {
      this.period.set(value);
      this.now.set(new Date());
    }
  }

  setChartMonths(value: string): void {
    if (value === '6') this.chartMonths.set(6);
    if (value === '12') this.chartMonths.set(12);
  }

  reload(): void {
    this.loading.set(true);
    try {
      const clients = this.clientsService.list();
      this.tags.set(this.tagsService.list());
      this.clients.set(clients);
      this.now.set(new Date());
      this.error.set('');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Não foi possível carregar os dados deste navegador.');
    } finally {
      this.loading.set(false);
    }
  }
}
