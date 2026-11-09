import { Client } from '../../core/clients/local-clients.service';
import { NfcTag } from '../../core/tags/nfc-tag';

export type DashboardPeriod = 'month' | '30days' | '6months' | '12months' | 'all';

export interface DashboardData {
  revenue: number;
  tagCount: number;
  clientCount: number;
  activeCount: number;
  recentTags: NfcTag[];
  categories: string[];
  revenueByMonth: number[];
  tagsByMonth: number[];
}

export function dashboardData(
  tags: NfcTag[],
  clients: Client[],
  period: DashboardPeriod,
  chartMonths: 6 | 12,
  now: Date,
): DashboardData {
  let start: Date | null = null;
  if (period === 'month') start = new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === '30days') {
    start = new Date(now);
    start.setDate(start.getDate() - 30);
  }
  if (period === '6months' || period === '12months') {
    start = new Date(now.getFullYear(), now.getMonth() - (period === '6months' ? 5 : 11), 1);
  }
  const inPeriod = (value: string): boolean => {
    const time = Date.parse(value);
    return time <= now.getTime() && (!start || time >= start.getTime());
  };
  const filteredTags = tags.filter((tag) => inPeriod(tag.createdAt));
  const filteredClients = clients.filter((client) => inPeriod(client.createdAt));
  const months = Array.from({ length: chartMonths }, (_, index) =>
    new Date(now.getFullYear(), now.getMonth() - chartMonths + 1 + index, 1));
  const revenueInCents = (items: NfcTag[]): number =>
    items.reduce((total, tag) => total + Math.round((tag.salePrice ?? 0) * 100), 0);
  const byMonth = months.map((month) =>
    filteredTags.filter((tag) => {
      const created = new Date(tag.createdAt);
      return created.getFullYear() === month.getFullYear() && created.getMonth() === month.getMonth();
    }));

  return {
    revenue: revenueInCents(filteredTags) / 100,
    tagCount: filteredTags.length,
    clientCount: filteredClients.length,
    activeCount: filteredTags.filter((tag) => tag.active !== false).length,
    recentTags: [...filteredTags].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 5),
    categories: months.map((month) => new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' }).format(month)),
    revenueByMonth: byMonth.map((items) => revenueInCents(items) / 100),
    tagsByMonth: byMonth.map((items) => items.length),
  };
}
