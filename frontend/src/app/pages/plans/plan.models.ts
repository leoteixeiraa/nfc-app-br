export interface PlanFeature {
  code: string;
  enabled: boolean;
  entitled: boolean;
  limit?: number | null;
  unlimited: boolean;
}

export interface Plan {
  code: string;
  name: string;
  price: number;
  billingPeriod: string;
  features: PlanFeature[];
}

export interface CurrentPlan {
  code: string;
  name: string;
  status: string;
  startedAt: string;
  expiresAt?: string | null;
  premium: boolean;
  features: PlanFeature[];
  publishedTags: number;
}

const FEATURE_LABELS: Record<string, string> = {
  PUBLISHED_TAGS: 'Placas NFC publicadas',
  CLIENTS: 'Gestão de clientes',
  NFC_QR: 'Gravação NFC e QR Code',
  DYNAMIC_LINKS: 'Links dinâmicos',
  BASIC_DASHBOARD: 'Dashboard básico',
  SALES_DASHBOARD: 'Dashboard de vendas',
  PDF_REPORTS: 'Relatórios profissionais em PDF',
  ACCESS_STATISTICS: 'Estatísticas de acessos',
  GOOGLE_MAPS_PROSPECTING: 'Prospecção com Google Maps',
  AI_SUGGESTIONS: 'Sugestões com inteligência artificial',
};

export function planFeatureLabel(code: string): string {
  return FEATURE_LABELS[code] ?? code.toLowerCase().replaceAll('_', ' ');
}

export const PLAN_BENEFITS: ReadonlyArray<{ code: string; title: string; description: string }> = [
  {
    code: 'PUBLISHED_TAGS',
    title: 'Placas sob controle',
    description: 'Gerencie suas placas publicadas em um só lugar.',
  },
  {
    code: 'CLIENTS',
    title: 'Relacionamentos organizados',
    description: 'Mantenha os dados dos seus clientes organizados junto à operação.',
  },
  {
    code: 'DYNAMIC_LINKS',
    title: 'Mais flexibilidade',
    description: 'Atualize o destino dos links das suas placas quando precisar.',
  },
  {
    code: 'BASIC_DASHBOARD',
    title: 'Visão da operação',
    description: 'Acompanhe os principais indicadores no painel.',
  },
];
