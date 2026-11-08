import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { tagTypeLabel } from '../tags/nfc-tag';
import { PlaceDetails, PlaceReview, TagsApiService } from '../tags/tags-api.service';
import { Client } from './local-clients.service';

@Injectable({ providedIn: 'root' })
export class ClientReportService {
  private readonly api = inject(TagsApiService);

  async download(client: Client): Promise<void> {
    let details: PlaceDetails | null = null;
    if (!client.local) {
      try {
        details = await firstValueFrom(this.api.placeDetails(client.placeId, true));
      } catch {
        throw new Error('Não foi possível consultar as avaliações do Google. Verifique a conexão e tente novamente.');
      }
      if (!Array.isArray(details.reviews)) {
        throw new Error('Não foi possível obter as avaliações do Google para o relatório. Tente novamente mais tarde.');
      }
    }

    const [pdfModule, logoData, regularFont, boldFont] = await Promise.all([
      import('pdfmake/build/pdfmake'),
      this.loadAsset('/images/brand/nfc-logo-light.png'),
      this.loadAsset('/fonts/outfit/Outfit-Regular.ttf'),
      this.loadAsset('/fonts/outfit/Outfit-Bold.ttf'),
    ]);
    const pdf = pdfModule.default;
    const document = this.document(client, details, `data:image/png;base64,${logoData}`);
    const slug = client.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/g, '');
    pdf.createPdf(document, undefined, {
      Outfit: { normal: 'Outfit-Regular.ttf', bold: 'Outfit-Bold.ttf', italics: 'Outfit-Regular.ttf', bolditalics: 'Outfit-Bold.ttf' },
    }, { 'Outfit-Regular.ttf': regularFont, 'Outfit-Bold.ttf': boldFont }).download(
      `relatorio-nfc-${slug || 'cliente'}.pdf`,
    );
  }

  document(client: Client, details: PlaceDetails | null, logo: string): TDocumentDefinitions {
    const date = (input: string): string | null => {
      const parsed = new Date(input);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleDateString('pt-BR');
    };
    const safeText = (text: string): string => text.replace(/(\S{40})(?=\S)/gu, '$1\u200b');
    const heading = (title: string, subtitle: string): Content => ({
      stack: [
        { text: title, style: 'section' },
        { text: subtitle, style: 'muted', margin: [0, 3, 0, 0] },
      ],
      margin: [0, 19, 0, 10],
      headlineLevel: 1,
    });
    const stars = (rating: number | null | undefined, size: number): Content => {
      const valid = typeof rating === 'number' && Number.isFinite(rating) && rating >= 0 && rating <= 5;
      if (!valid) return { text: 'Não disponível', style: 'muted' };
      return {
        columns: Array.from({ length: 5 }, (_, i) => ({
          width: size + 2,
          svg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><path fill="${i < Math.round(rating) ? '#F5A524' : '#E4E7EC'}" d="M10 1.1l2.7 5.5 6.1.9-4.4 4.3 1 6.1L10 15l-5.4 2.9 1-6.1L1.2 7.5l6.1-.9z"/></svg>`,
          fit: [size, size],
        })),
      };
    };
    const count = (value: number | null | undefined): string =>
      typeof value === 'number' && Number.isFinite(value) && value >= 0
        ? value.toLocaleString('pt-BR') : '—';
    const rating = details?.rating ?? client.rating;
    const ratingsCount = details?.userRatingCount ?? client.userRatingCount;
    const activeCount = client.tags.filter((tag) => tag.active !== false).length;
    const reviews = [...(details?.reviews ?? [])].sort((a, b) => {
      const first = Date.parse(a.publishedAt);
      const second = Date.parse(b.publishedAt);
      return (Number.isNaN(second) ? 0 : second) - (Number.isNaN(first) ? 0 : first);
    });
    const reviewContent: Content[] = reviews.map((review: PlaceReview) => ({
      stack: [
        {
          columns: [
            { text: safeText(review.author || 'Autor não informado'), bold: true, color: '#101828', width: '*' },
            { text: date(review.publishedAt) || review.relativeTime || 'Data não disponível', style: 'muted', alignment: 'right', width: 'auto', margin: [8, 0, 0, 0] },
          ],
        },
        { columns: [
          { stack: [stars(review.rating, 10)], width: 75 },
          { text: typeof review.rating === 'number' && Number.isFinite(review.rating) ? `${review.rating.toLocaleString('pt-BR')} / 5` : '', style: 'muted' },
        ], margin: [0, 5, 0, 0] },
        { text: safeText(review.text || 'Avaliação sem comentário.'), lineHeight: 1.25, margin: [0, 6, 0, 0] },
      ],
      margin: [0, 0, 0, 13],
    }));

    return {
      pageSize: 'A4',
      pageMargins: [42, 38, 42, 42],
      defaultStyle: { font: 'Outfit', fontSize: 9, color: '#475467' },
      footer: (currentPage, pageCount) => ({
        columns: [
          { text: 'nfc.app.br', color: '#98A2B3' },
          { text: `${currentPage} / ${pageCount}`, alignment: 'right', color: '#98A2B3' },
        ],
        fontSize: 8, margin: [42, 12, 42, 0],
      }),
      content: [
        { image: logo, width: 114 },
        { text: 'RELATÓRIO DE DESEMPENHO NFC', fontSize: 8, bold: true, color: '#465FFF', characterSpacing: 0.8, margin: [0, 20, 0, 5] },
        { text: safeText(client.name), fontSize: 23, bold: true, color: '#101828' },
        { text: `Gerado em ${date(new Date().toISOString())}`, style: 'muted', margin: [0, 5, 0, 0] },
        {
          table: {
            widths: ['*', '*', '*', '*'],
            body: [[
              { stack: [{ text: 'NOTA GOOGLE', style: 'metricLabel' }, { text: typeof rating === 'number' && Number.isFinite(rating) && rating >= 0 && rating <= 5 ? rating.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—', style: 'metricValue' }, stars(rating, 9)] },
              { stack: [{ text: 'AVALIAÇÕES', style: 'metricLabel' }, { text: count(ratingsCount), style: 'metricValue' }, { text: 'no Google', style: 'metricHint' }] },
              { stack: [{ text: 'PLACAS ATIVAS', style: 'metricLabel' }, { text: count(activeCount), style: 'metricValue' }, { text: `${count(client.tags.length)} vinculadas`, style: 'metricHint' }] },
              { stack: [{ text: 'INTERAÇÕES NFC', style: 'metricLabel' }, { text: '—', style: 'metricValue' }, { text: 'indisponível', style: 'metricHint' }] },
            ]],
          },
          layout: {
            fillColor: () => '#F5F7FF',
            hLineWidth: () => 0,
            vLineWidth: () => 0,
            paddingLeft: () => 10,
            paddingRight: () => 6,
            paddingTop: () => 12,
            paddingBottom: () => 12,
          },
          margin: [0, 20, 0, 0],
        },
        heading('Desempenho das placas', 'Acompanhe as placas vinculadas ao seu estabelecimento.'),
        ...(client.tags.length ? [{
          table: {
            headerRows: 1,
            widths: ['*', 120, 55],
            body: [
              [{ text: 'PLACA', style: 'tableHeader' }, { text: 'TIPO', style: 'tableHeader' }, { text: 'STATUS', style: 'tableHeader' }],
              ...client.tags.map((tag) => [
                { text: safeText(tag.name), color: '#101828', bold: true },
                { text: tagTypeLabel(tag.type) },
                { text: tag.active === false ? 'Inativa' : 'Ativa', color: tag.active === false ? '#667085' : '#039855', bold: true },
              ]),
            ],
          },
          layout: {
            hLineColor: () => '#EAECF0',
            hLineWidth: (index: number) => index === 0 ? 0 : 0.5,
            vLineWidth: () => 0,
            paddingLeft: () => 4,
            paddingRight: () => 4,
            paddingTop: () => 7,
            paddingBottom: () => 7,
          },
        } satisfies Content] : [{ text: 'Nenhuma placa vinculada.', style: 'muted' }]),
        { text: 'Dados de interação ainda não disponíveis', style: 'muted', margin: [0, 10, 0, 0] },
        heading('Avaliações do Google', 'Avaliações selecionadas pelo Google, apresentadas com a identificação dos autores.'),
        { text: 'Fonte: Google Maps. Até 5 avaliações são selecionadas por relevância.', style: 'muted', margin: [0, 0, 0, 10] },
        ...(client.local
          ? [{ text: 'Avaliações do Google não disponíveis para este estabelecimento.', style: 'muted' }]
          : reviewContent.length ? reviewContent : [{ text: 'Não há avaliações disponíveis nesta consulta.', style: 'muted' }]),
      ],
      styles: {
        section: { fontSize: 14, bold: true, color: '#101828' },
        muted: { fontSize: 8, color: '#667085' },
        metricLabel: { fontSize: 7, bold: true, color: '#667085' },
        metricValue: { fontSize: 17, bold: true, color: '#101828', margin: [0, 6, 0, 4] },
        metricHint: { fontSize: 8, color: '#667085' },
        tableHeader: { fontSize: 7, bold: true, color: '#667085' },
      },
    };
  }

  private async loadAsset(path: string): Promise<string> {
    let response: Response;
    try {
      response = await fetch(path);
    } catch {
      throw new Error('Não foi possível carregar a identidade visual do relatório.');
    }
    if (!response.ok) throw new Error('Não foi possível carregar a identidade visual do relatório.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    }
    return btoa(binary);
  }
}
