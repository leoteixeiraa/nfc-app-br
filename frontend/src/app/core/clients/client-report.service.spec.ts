import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ClientReportService } from './client-report.service';
import { Client } from './local-clients.service';
import { PlaceDetails, TagsApiService } from '../tags/tags-api.service';

describe('Relatório PDF de cliente', () => {
  const logo = document.createElement('canvas').toDataURL('image/png');
  let service: ClientReportService;
  let api: jasmine.SpyObj<TagsApiService>;
  const client: Client = {
    placeId: 'google-123', name: 'Padoca da Praça', address: 'Praça Central', reviewUrl: 'https://google.com/review',
    rating: 4.5, userRatingCount: 20, googleMapsUrl: 'https://google.com/maps',
    createdAt: '2026-01-01T10:00:00Z',
    tags: [{
      id: 'tag-1', name: 'Balcão', type: 'url', destinationUrl: 'https://example.com',
      publicUrl: 'https://nfc.app.br/t/tag-1', managementToken: 'segredo',
      createdAt: '2026-01-01T10:00:00Z', updatedAt: '2026-01-02T10:00:00Z', salePrice: 50,
    }],
    statistics: { total: 0, last7Days: 0, last30Days: 0, lastAccess: null },
  };
  const details: PlaceDetails = {
    placeId: client.placeId, name: client.name, address: client.address, reviewUrl: client.reviewUrl,
    rating: 4.7, userRatingCount: 24, googleMapsUrl: client.googleMapsUrl,
    category: 'Padaria', phone: '(11) 9999-9999', website: 'https://padoca.example',
    photoUrl: null, photoAttributions: [],
    reviews: [
      { author: 'José', authorUrl: 'https://www.google.com/maps/contrib/1', rating: 5, text: 'Muito bom!', publishedAt: '2026-01-05T10:00:00Z', relativeTime: 'há um dia', googleMapsUrl: null },
      { author: 'Ana', authorUrl: null, rating: 4, text: 'Gostei', publishedAt: '', relativeTime: 'há uma semana', googleMapsUrl: null },
    ],
  };

  beforeEach(() => {
    api = jasmine.createSpyObj<TagsApiService>('TagsApiService', ['placeDetails']);
    TestBed.configureTestingModule({ providers: [{ provide: TagsApiService, useValue: api }] });
    service = TestBed.inject(ClientReportService);
  });

  it('apresenta reputação e placas, sem métricas simuladas ou dados técnicos', () => {
    const text = JSON.stringify(service.document({
      ...client,
      statistics: { total: 999, last7Days: 888, last30Days: 777, lastAccess: '2026-01-03T00:00:00Z' },
    }, details, logo));
    for (const expected of ['Padoca da Praça', 'Balcão', 'José', 'Muito bom!', 'Ana', 'Gostei',
      '24', '4,7', 'Dados de interação ainda não disponíveis', 'por relevância', 'Ativa']) {
      expect(text).toContain(expected);
    }
    for (const forbidden of ['google-123', 'tag-1', 'example.com', 'google.com/maps/contrib', 'Padaria',
      '9999-9999', 'segredo', '50,00', '2026-01-02', '999', '888', '777', 'simulados']) {
      expect(text).not.toContain(forbidden);
    }
  });

  it('informa indisponibilidade para cliente sem Place ID e sem avaliações retornadas', () => {
    const local = { ...client, local: true, placeId: 'local:123' };
    const text = JSON.stringify(service.document(local, null, logo));
    expect(text).toContain('Avaliações do Google não disponíveis');
    expect(text).not.toContain('local:123');
    expect(JSON.stringify(service.document(client, { ...details, reviews: [] }, logo))).toContain('Não há avaliações disponíveis');
  });

  it('distingue zero, uma e várias placas e conta apenas ativas', () => {
    const empty = JSON.stringify(service.document({ ...client, tags: [] }, details, logo));
    expect(empty).toContain('Nenhuma placa vinculada');
    const one = JSON.stringify(service.document(client, details, logo));
    expect(one).toContain('1 vinculadas');
    const multiple = JSON.stringify(service.document({
      ...client,
      tags: [client.tags[0], { ...client.tags[0], id: 'outra', name: 'Recepção', active: false }],
    }, details, logo));
    expect(multiple).toContain('2 vinculadas');
    expect(multiple).toContain('Recepção');
    expect(multiple).toContain('Inativa');
    expect(multiple).toContain('"text":"1","style":"metricValue"');
  });

  it('não utiliza zeros simulados quando faltam nota e total de avaliações', () => {
    const local = { ...client, local: true, rating: null, userRatingCount: null };
    const text = JSON.stringify(service.document(local, null, logo));
    expect(text).toContain('Não disponível');
    expect(text).toContain('Dados de interação ainda não disponíveis');
  });

  it('não gera relatório incompleto quando a consulta Google falha', async () => {
    api.placeDetails.and.returnValue(throwError(() => new Error('offline')));
    await expectAsync(service.download(client)).toBeRejectedWithError(/Não foi possível consultar/);
    expect(api.placeDetails).toHaveBeenCalledOnceWith(client.placeId, true);
  });

  it('identifica backend que ainda não fornece avaliações', async () => {
    api.placeDetails.and.returnValue(of({ ...details, reviews: undefined }));
    await expectAsync(service.download(client)).toBeRejectedWithError(/Não foi possível obter as avaliações/);
  });

  it('solicita avaliações atuais e inicia download PDF para cliente Google', async () => {
    api.placeDetails.and.returnValue(of(details));
    spyOn(window, 'fetch').and.callFake(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    const pdfModule = await import('pdfmake/build/pdfmake');
    const pdf = pdfModule.default;
    const original = pdf.createPdf;
    const download = jasmine.createSpy('download');
    const create = spyOn(pdf, 'createPdf').and.callFake((...args) => {
      const result = original(...args);
      spyOn(result, 'download').and.callFake(download);
      return result;
    });
    await service.download(client);
    expect(api.placeDetails).toHaveBeenCalledOnceWith(client.placeId, true);
    expect(create).toHaveBeenCalled();
    expect(download).toHaveBeenCalledOnceWith('relatorio-nfc-padoca-da-praca.pdf');
  });

  it('informa erro ao não conseguir carregar a marca', async () => {
    spyOn(window, 'fetch').and.resolveTo(new Response(null, { status: 404 }));
    await expectAsync(service.download({ ...client, local: true })).toBeRejectedWithError(/identidade visual/);
  });

  it('gera PDF A4 real de uma página para caso típico e pagina conteúdo extenso', async () => {
    const [pdfModule, fontsModule] = await Promise.all([
      import('pdfmake/build/pdfmake'),
      import('pdfmake/build/vfs_fonts'),
    ]);
    const fonts: Record<string, string> = {};
    for (const [name, data] of Object.entries(fontsModule.default)) {
      if (typeof data === 'string') fonts[name] = data;
    }
    const fontMap = { Outfit: { normal: 'Roboto-Regular.ttf', bold: 'Roboto-Medium.ttf', italics: 'Roboto-Italic.ttf', bolditalics: 'Roboto-MediumItalic.ttf' } };
    const generate = (data: Client, place: PlaceDetails): Promise<Blob> => new Promise<Blob>((resolve) =>
      pdfModule.default.createPdf(service.document(data, place, logo), undefined, fontMap, fonts).getBlob(resolve));
    const blob = await generate(client, details);
    expect(blob.type).toBe('application/pdf');
    expect(await blob.slice(0, 5).text()).toBe('%PDF-');
    expect(blob.size).toBeGreaterThan(1000);
    const countPages = async (pdf: Blob) => (await pdf.text()).match(/\/Type\s*\/Page\b/g)?.length ?? 0;
    expect(await countPages(blob)).toBe(1);
    expect(await countPages(await generate({ ...client, tags: [] }, { ...details, reviews: [] }))).toBe(1);
    expect(await countPages(await generate(client, { ...details, reviews: [details.reviews![0]] }))).toBe(1);
    const many = { ...client, tags: Array.from({ length: 40 }, (_, i) =>
      ({ ...client.tags[0], id: String(i), name: `Placa ${i} ${'a'.repeat(100)}` })) };
    const longDetails = { ...details, reviews: Array.from({ length: 5 }, (_, i) => ({
      ...details.reviews![0], author: `Autor ${i}`, text: `Excelente atendimento. ${'Ótimo '.repeat(400)}`,
    })) };
    expect(await countPages(await generate(many, longDetails))).toBeGreaterThan(1);
  });
});
