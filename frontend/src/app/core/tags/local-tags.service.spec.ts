import { LOCAL_TAGS_STORAGE_KEY, LocalTagsError, LocalTagsService } from './local-tags.service';
import { buildDestinationUrl, validateDestinationUrl } from './nfc-tag';

describe('LocalTagsService', () => {
  let service: LocalTagsService;
  const input = { name: 'Balcão', type: 'url' as const, destinationUrl: 'https://exemplo.com.br' };

  beforeEach(() => {
    localStorage.removeItem(LOCAL_TAGS_STORAGE_KEY);
    service = new LocalTagsService();
  });

  afterEach(() => {
    localStorage.removeItem(LOCAL_TAGS_STORAGE_KEY);
  });

  it('lista vazio quando não há dados', () => {
    expect(service.list()).toEqual([]);
  });

  it('cria, busca e persiste na chave única', () => {
    const tag = service.create(input);
    expect(service.getById(tag.id)?.name).toBe('Balcão');
    expect(JSON.parse(localStorage.getItem(LOCAL_TAGS_STORAGE_KEY) ?? '[]').length).toBe(1);
  });

  it('atualiza e ordena pela última alteração', async () => {
    const first = service.create(input);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = service.create({ ...input, name: 'Outra' });
    expect(service.list()[0].id).toBe(second.id);
    await new Promise((resolve) => setTimeout(resolve, 5));
    service.update(first.id, { ...input, name: 'Editada' });
    expect(service.list()[0].id).toBe(first.id);
    expect(service.list()[0].name).toBe('Editada');
  });

  it('duplica e remove', () => {
    const tag = service.create(input);
    const copy = service.duplicate(tag.id);
    expect(copy.id).not.toBe(tag.id);
    expect(copy.name).toBe('Balcão (cópia)');
    service.remove(tag.id);
    expect(service.list().map((t) => t.id)).toEqual([copy.id]);
  });

  it('rejeita dados inválidos', () => {
    expect(() => service.create({ ...input, destinationUrl: 'http://inseguro.com' })).toThrowError(LocalTagsError);
    expect(() => service.create({ ...input, name: '  ' })).toThrowError(LocalTagsError);
  });

  it('não sobrescreve dados corrompidos', () => {
    localStorage.setItem(LOCAL_TAGS_STORAGE_KEY, '{quebrado');
    expect(() => service.list()).toThrowError(LocalTagsError);
    expect(() => service.create(input)).toThrowError(LocalTagsError);
    expect(localStorage.getItem(LOCAL_TAGS_STORAGE_KEY)).toBe('{quebrado');
  });

  it('trata erro de gravação', () => {
    spyOn(Storage.prototype, 'setItem').and.throwError('QuotaExceededError');
    try {
      service.create(input);
      fail('deveria lançar');
    } catch (error) {
      expect((error as LocalTagsError).code).toBe('write');
    }
  });

  it('trata armazenamento indisponível na leitura', () => {
    spyOn(Storage.prototype, 'getItem').and.throwError('SecurityError');
    expect(() => service.list()).toThrowError(LocalTagsError);
  });

  it('gera link wa.me para WhatsApp', () => {
    const url = buildDestinationUrl('whatsapp', '+55 (11) 99999-9999');
    expect(url).toBe('https://wa.me/5511999999999');
    expect(validateDestinationUrl('whatsapp', url)).toBeNull();
  });
});
