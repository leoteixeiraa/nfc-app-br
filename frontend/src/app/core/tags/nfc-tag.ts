export type NfcTagType = 'google-review' | 'whatsapp' | 'pix' | 'url';

export interface NfcTag {
  id: string;
  name: string;
  type: NfcTagType;
  destinationUrl: string;
  createdAt: string;
  updatedAt: string;
  destinationLabel?: string;
  pixKey?: string;
  pixReceiverName?: string;
  pixCity?: string;
  publicUrl?: string;
  managementToken?: string;
  qrCodeDataUri?: string;
  active?: boolean;
}

export interface NfcTagInput {
  name: string;
  type: NfcTagType;
  destinationUrl: string;
  destinationLabel?: string;
  pixKey?: string;
  pixReceiverName?: string;
  pixCity?: string;
}

export const NFC_TAG_TYPES: readonly { value: NfcTagType; label: string }[] = [
  { value: 'google-review', label: 'Google Avaliações' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'pix', label: 'Pix' },
  { value: 'url', label: 'Link personalizado' },
];

export const NAME_MAX_LENGTH = 80;
const URL_MAX_LENGTH = 2048;
const WHATSAPP_URL_PATTERN = /^https:\/\/wa\.me\/\d{10,15}$/;
const GOOGLE_HOSTS = ['google.com', 'g.page', 'goo.gl', 'g.co'];

export function tagTypeLabel(type: NfcTagType): string {
  return NFC_TAG_TYPES.find((item) => item.value === type)?.label ?? type;
}

export function isNfcTagType(value: unknown): value is NfcTagType {
  return NFC_TAG_TYPES.some((item) => item.value === value);
}

/** Converte o valor digitado no formulário na URL final armazenada. */
export function buildDestinationUrl(type: NfcTagType, rawValue: string): string {
  const value = rawValue.trim();
  if (type !== 'whatsapp') {
    return value;
  }
  const digits = value.replace(/[\s().+-]/g, '');
  return /^\d+$/.test(digits) ? `https://wa.me/${digits}` : value;
}

/** Recupera o valor editável (telefone ou URL) a partir da URL armazenada. */
export function destinationToFormValue(type: NfcTagType, destinationUrl: string): string {
  return type === 'whatsapp' ? destinationUrl.replace('https://wa.me/', '') : destinationUrl;
}

export function validateTagName(name: string): string | null {
  const value = name.trim();
  if (!value) {
    return 'Informe o nome da placa.';
  }
  if (value.length > NAME_MAX_LENGTH) {
    return `O nome deve ter no máximo ${NAME_MAX_LENGTH} caracteres.`;
  }
  return null;
}

export function validateDestinationUrl(type: NfcTagType, destinationUrl: string): string | null {
  if (type === 'pix') {
    if (/^000201[\s\S]+6304[A-Fa-f0-9]{4}$/.test(destinationUrl)) {
      return null;
    }
  }

  if (type === 'whatsapp') {
    return WHATSAPP_URL_PATTERN.test(destinationUrl)
      ? null
      : 'Informe o número com DDI e DDD, apenas dígitos. Ex.: 5511999999999.';
  }

  if (!destinationUrl) {
    return 'Informe o endereço de destino.';
  }

  let url: URL;
  try {
    url = new URL(destinationUrl);
  } catch {
    return 'Informe uma URL válida iniciada por https://.';
  }

  if (url.protocol !== 'https:' || destinationUrl.length > URL_MAX_LENGTH) {
    return 'A URL deve usar HTTPS e ter no máximo 2048 caracteres.';
  }
  if (url.username || url.password) {
    return 'A URL não pode conter usuário ou senha.';
  }
  if (type === 'google-review' && !isGoogleHost(url.hostname)) {
    return 'Use o link de avaliação do Google (google.com, g.page ou goo.gl).';
  }
  return null;
}

export function validateTagInput(input: NfcTagInput): string | null {
  if (!isNfcTagType(input.type)) {
    return 'Tipo de destino inválido.';
  }
  return validateTagName(input.name) ?? validateDestinationUrl(input.type, input.destinationUrl);
}

function isGoogleHost(hostname: string): boolean {
  return GOOGLE_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}
