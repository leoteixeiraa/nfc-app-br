import { Client } from '../../core/clients/local-clients.service';
import { NfcTag } from '../../core/tags/nfc-tag';
import { dashboardData } from './dashboard-data';

describe('dashboardData', () => {
  const now = new Date(2026, 10, 15, 12);
  const makeTag = (id: string, date: Date, salePrice?: number, active?: boolean): NfcTag => ({
    id, name: id, type: 'url', destinationUrl: 'https://example.com',
    createdAt: date.toISOString(), updatedAt: date.toISOString(), salePrice, active,
  });
  const makeClient = (id: string, date: Date): Client => ({
    placeId: id, name: id, address: '', reviewUrl: '', rating: null, userRatingCount: null,
    googleMapsUrl: null, createdAt: date.toISOString(), tags: [],
    statistics: { total: 0, last7Days: 0, last30Days: 0, lastAccess: null },
  });
  const tags = [
    makeTag('novembro', new Date(2026, 10, 3), 0.1, true),
    makeTag('outubro', new Date(2026, 9, 20), 0.2, false),
    makeTag('maio', new Date(2026, 4, 1), 42),
    makeTag('antiga', new Date(2025, 1, 1), 10),
  ];
  const clients = [makeClient('um', new Date(2026, 10, 3)), makeClient('dois', new Date(2026, 4, 1))];

  it('soma valores em centavos e calcula os indicadores sem inventar vendas', () => {
    const data = dashboardData(tags, clients, 'all', 12, now);
    expect(data.revenue).toBe(52.3);
    expect(data.tagCount).toBe(4);
    expect(data.clientCount).toBe(2);
    expect(data.activeCount).toBe(3);
    expect(dashboardData([], [], 'all', 12, now).revenue).toBe(0);
  });

  it('aplica mês e 30 dias aos indicadores e séries', () => {
    const month = dashboardData(tags, clients, 'month', 6, now);
    expect(month.tagCount).toBe(1);
    expect(month.clientCount).toBe(1);
    expect(month.revenueByMonth).toEqual([0, 0, 0, 0, 0, 0.1]);
    const days = dashboardData(tags, clients, '30days', 6, now);
    expect(days.tagCount).toBe(2);
    expect(days.revenue).toBe(0.3);
    expect(days.tagsByMonth).toEqual([0, 0, 0, 0, 1, 1]);
  });

  it('considera meses de calendário e limita o gráfico sem alterar os totais', () => {
    const six = dashboardData(tags, clients, '6months', 6, now);
    expect(six.tagCount).toBe(2);
    const twelve = dashboardData(tags, clients, '12months', 12, now);
    expect(twelve.tagCount).toBe(3);
    expect(twelve.tagsByMonth.reduce((sum, value) => sum + value, 0)).toBe(3);
    const all = dashboardData(tags, clients, 'all', 6, now);
    expect(all.tagCount).toBe(4);
    expect(all.tagsByMonth.reduce((sum, value) => sum + value, 0)).toBe(2);
  });

  it('ordena pelas datas de criação, limita a cinco e ignora datas futuras', () => {
    const many = Array.from({ length: 7 }, (_, index) => makeTag(String(index), new Date(2026, 10, index + 1)));
    const data = dashboardData([...many, makeTag('futura', new Date(2026, 11, 1))], [], 'all', 12, now);
    expect(data.tagCount).toBe(7);
    expect(data.recentTags.map((tag) => tag.id)).toEqual(['6', '5', '4', '3', '2']);
  });
});
