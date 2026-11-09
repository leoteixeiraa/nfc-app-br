import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LOCAL_CLIENTS_STORAGE_KEY, LocalClientsService } from '../../core/clients/local-clients.service';
import { LOCAL_TAGS_STORAGE_KEY, LocalTagsService } from '../../core/tags/local-tags.service';
import { NfcTagInput } from '../../core/tags/nfc-tag';
import { PlaceDetails, TagsApiService } from '../../core/tags/tags-api.service';
import { TagFormComponent } from '../tags/tag-form/tag-form.component';

describe('Fluxo de clientes e publicação', () => {
  const place: PlaceDetails = {
    placeId: 'google-123', name: 'Café', address: 'Rua A',
    reviewUrl: 'https://google.com/review', rating: 4, userRatingCount: 3,
    googleMapsUrl: 'https://google.com/maps', photoUrl: null, photoAttributions: [],
  };
  let tags: LocalTagsService;
  let clients: LocalClientsService;
  let failPublication: boolean;

  beforeEach(() => {
    localStorage.removeItem(LOCAL_TAGS_STORAGE_KEY);
    localStorage.removeItem(LOCAL_CLIENTS_STORAGE_KEY);
    failPublication = false;
    TestBed.configureTestingModule({
      imports: [TagFormComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null } } } },
        { provide: TagsApiService, useValue: {
          create: (input: NfcTagInput) => failPublication ? throwError(() => new Error('Falha ao publicar')) : of(tags.create(input)),
        } },
      ],
    });
    tags = TestBed.inject(LocalTagsService);
    clients = TestBed.inject(LocalClientsService);
  });

  afterEach(() => {
    localStorage.removeItem(LOCAL_TAGS_STORAGE_KEY);
    localStorage.removeItem(LOCAL_CLIENTS_STORAGE_KEY);
  });

  it('registra o estabelecimento imediatamente após publicação sem gravar NFC', () => {
    const form = TestBed.createComponent(TagFormComponent).componentInstance;
    form.form.patchValue({ name: place.name, type: 'google-review', destination: place.reviewUrl });
    form.selectedPlace.set(place);
    form.publish();
    const tag = form.createdTag();
    expect(tag).not.toBeNull();
    expect(clients.get(place.placeId)?.tags[0].id).toBe(tag!.id);
    expect(clients.placeForTag(tag!)?.placeId).toBe(place.placeId);
  });

  it('não cadastra cliente se a publicação falhar', () => {
    failPublication = true;
    const form = TestBed.createComponent(TagFormComponent).componentInstance;
    form.form.patchValue({ name: place.name, type: 'google-review', destination: place.reviewUrl });
    form.selectedPlace.set(place);
    form.publish();
    expect(clients.list()).toEqual([]);
    expect(form.submitError()).toContain('Falha ao publicar');
  });

  it('registra cliente para link personalizado', () => {
    const form = TestBed.createComponent(TagFormComponent).componentInstance;
    form.form.patchValue({ name: 'Padoca', type: 'url', destination: 'https://exemplo.com' });
    form.publish();
    expect(clients.list()[0].name).toBe('Padoca');
    expect(clients.list()[0].tags[0].id).toBe(form.createdTag()!.id);
  });
});
