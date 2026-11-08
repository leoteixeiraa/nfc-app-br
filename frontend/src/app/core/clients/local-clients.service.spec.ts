import { TestBed } from '@angular/core/testing';
import { LOCAL_TAGS_STORAGE_KEY, LocalTagsService } from '../tags/local-tags.service';
import { ClientPlace, LOCAL_CLIENTS_STORAGE_KEY, LocalClientsService } from './local-clients.service';
import { TableThreeComponent } from '../../pages/tables/components/basic-tables/table-three/table-three.component';

describe('Clientes locais', () => {
  let clients: LocalClientsService;
  let tags: LocalTagsService;
  const place: ClientPlace = {
    placeId: 'place-1', name: 'Café', address: 'Rua A', reviewUrl: 'https://google.com/review',
    rating: 4.5, userRatingCount: 20, googleMapsUrl: 'https://google.com/maps',
  };
  const input = { name: 'Balcão', type: 'google-review' as const, destinationUrl: place.reviewUrl };

  beforeEach(() => {
    localStorage.removeItem(LOCAL_TAGS_STORAGE_KEY);
    localStorage.removeItem(LOCAL_CLIENTS_STORAGE_KEY);
    TestBed.configureTestingModule({});
    clients = TestBed.inject(LocalClientsService);
    tags = TestBed.inject(LocalTagsService);
  });

  afterEach(() => {
    localStorage.removeItem(LOCAL_TAGS_STORAGE_KEY);
    localStorage.removeItem(LOCAL_CLIENTS_STORAGE_KEY);
  });

  it('registra imediatamente e agrupa placas pelo Place ID', () => {
    const first = tags.create(input);
    const second = tags.create({ ...input, name: 'Mesa' });
    clients.setPlace(first, place);
    clients.setPlace(second, place);
    const createdAt = clients.list()[0].createdAt;
    expect(clients.list().length).toBe(1);
    expect(clients.list()[0].createdAt).toBe(createdAt);
    expect(clients.list()[0].tags.map((tag) => tag.id)).toEqual(jasmine.arrayContaining([first.id, second.id]));
    expect(clients.list()[0].tags.length).toBe(2);
  });

  it('mantém cadastro e reflete edição ou remoção da placa', () => {
    const tag = tags.create(input);
    clients.setPlace(tag, place);
    const updated = tags.update(tag.id, { ...input, name: 'Editada' });
    clients.setPlace(updated, place);
    expect(clients.get(place.placeId)?.tags[0].name).toBe('Editada');
    const changed = tags.update(tag.id, { ...input, destinationUrl: 'https://google.com/other' });
    clients.setPlace(changed, null);
    expect(clients.get(place.placeId)?.tags.length).toBe(0);
    expect(clients.list().find((client) => client.name === changed.name)?.tags[0].id).toBe(tag.id);
    tags.remove(tag.id);
    clients.forgetTag(tag.id);
    expect(clients.get(place.placeId)?.tags.length).toBe(0);
  });

  it('atualiza vínculo imediatamente ao mudar o estabelecimento', () => {
    const tag = tags.create(input);
    clients.setPlace(tag, place);
    const other = { ...place, placeId: 'place-2', reviewUrl: 'https://google.com/other' };
    const updated = tags.update(tag.id, { ...input, destinationUrl: other.reviewUrl });
    clients.setPlace(updated, other);
    expect(clients.list().length).toBe(2);
    expect(clients.get(place.placeId)?.tags.length).toBe(0);
    expect(clients.get(other.placeId)?.tags[0].id).toBe(tag.id);
  });

  it('agrupa placas sem Place ID pelo nome e aproveita cliente Google', () => {
    const first = tags.create({ name: 'Padoca da Praça', type: 'url', destinationUrl: 'https://example.com' });
    const second = tags.create({ name: '  PADOCA  DA PRAÇA ', type: 'whatsapp', destinationUrl: 'https://wa.me/5511999999999' });
    clients.setPlace(first, null);
    clients.setPlace(second, null);
    expect(clients.list().length).toBe(1);
    expect(clients.list()[0].tags.length).toBe(2);
    const google = { ...place, name: 'Padoca da Praça' };
    const third = tags.create({ ...input, name: google.name });
    clients.setPlace(third, google);
    expect(clients.list().length).toBe(1);
    expect(clients.get(place.placeId)?.tags.length).toBe(3);
    expect(clients.get(place.placeId)?.local).toBeUndefined();
  });

  it('mantém estabelecimentos Google com Place IDs diferentes separados', () => {
    const first = tags.create(input);
    const second = tags.create(input);
    clients.setPlace(first, place);
    clients.setPlace(second, { ...place, placeId: 'place-2' });
    expect(clients.list().length).toBe(2);
    expect(clients.get('place-1')?.tags[0].id).toBe(first.id);
    expect(clients.get('place-2')?.tags[0].id).toBe(second.id);
  });

  it('recupera vínculos pendentes e placas públicas anteriores', () => {
    const pending = { ...tags.create(input), publicUrl: 'https://nfc.app.br/t/first' };
    tags.saveRemote(pending);
    const other = { ...tags.create({ name: 'Padoca', type: 'url', destinationUrl: 'https://example.com' }), publicUrl: 'https://nfc.app.br/t/second' };
    tags.saveRemote(other);
    localStorage.setItem(LOCAL_CLIENTS_STORAGE_KEY, JSON.stringify({
      clients: [],
      links: [{ tagId: pending.id, destinationUrl: pending.destinationUrl, placeId: place.placeId, pending: place }],
    }));
    expect(clients.get(place.placeId)?.tags[0].id).toBe(pending.id);
    expect(clients.list().find((client) => client.name === 'Padoca')?.tags[0].id).toBe(other.id);
    expect(JSON.parse(localStorage.getItem(LOCAL_CLIENTS_STORAGE_KEY)!).links.every((link: { pending?: unknown }) => !link.pending)).toBeTrue();
  });

  it('preserva dados corrompidos e informa falhas de armazenamento', () => {
    localStorage.setItem(LOCAL_CLIENTS_STORAGE_KEY, '{inválido');
    expect(() => clients.list()).toThrowError(/inválidos/);
    expect(localStorage.getItem(LOCAL_CLIENTS_STORAGE_KEY)).toBe('{inválido');
    localStorage.removeItem(LOCAL_CLIENTS_STORAGE_KEY);
    const tag = tags.create(input);
    spyOn(Storage.prototype, 'setItem').and.throwError('quota');
    expect(() => clients.setPlace(tag, place)).toThrowError(/Não foi possível salvar/);
  });

  it('filtra e pagina a tabela de clientes', () => {
    const tag = tags.create(input);
    clients.setPlace(tag, place);
    const client = clients.list()[0];
    const table = new TableThreeComponent();
    table.clients = Array.from({ length: 11 }, (_, i) => ({ ...client, placeId: String(i), name: `Cliente ${i}` }));
    expect(table.clientTotalPages).toBe(2);
    expect(table.pagedClients.length).toBe(10);
    table.currentPage = 2;
    expect(table.pagedClients.length).toBe(1);
    table.onSearchChange('Cliente 10');
    expect(table.currentPage).toBe(1);
    expect(table.pagedClients.length).toBe(1);
  });
});
