import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthSessionStore } from '../../../core/auth/auth-session.store';
import { LOCAL_CLIENTS_STORAGE_KEY, LocalClientsService } from '../../../core/clients/local-clients.service';
import { LOCAL_TAGS_STORAGE_KEY, LocalTagsService } from '../../../core/tags/local-tags.service';
import { NfcTag, NfcTagInput } from '../../../core/tags/nfc-tag';
import { PlaceDetails, TagsApiService } from '../../../core/tags/tags-api.service';
import { TagAccountSyncService } from '../../../core/tags/tag-account-sync.service';
import { TagFormComponent } from './tag-form.component';

describe('gravação após criar a placa', () => {
  const code = 'abcdefghijklmnopqrstuvwx';
  let originalReader: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalReader = Object.getOwnPropertyDescriptor(window, 'NDEFReader');
    Object.defineProperty(window, 'NDEFReader', { value: class {}, configurable: true });
    spyOnProperty(navigator, 'userAgent', 'get').and.returnValue('Mozilla/5.0 (Linux; Android 14)');
    TestBed.configureTestingModule({
      imports: [TagFormComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null } } } },
        { provide: LocalTagsService, useValue: {} },
        { provide: TagAccountSyncService, useValue: { refresh: jasmine.createSpy() } },
        {
          provide: TagsApiService,
          useValue: {
            writeConfiguration: () => of({
              name: 'Balcão',
              publicUrl: `https://nfc.app.br/t/${code}`,
              continuationQrCodeDataUri: 'data:image/svg+xml;base64,cXI=',
            }),
          },
        },
      ],
    });
  });

  afterEach(() => {
    if (originalReader) Object.defineProperty(window, 'NDEFReader', originalReader);
    else Reflect.deleteProperty(window, 'NDEFReader');
  });

  it('apresenta a gravação diretamente após a publicação sem QR intermediário', () => {
    const fixture = TestBed.createComponent(TagFormComponent);
    fixture.componentInstance.createdTag.set({
      id: code,
      name: 'Balcão',
      type: 'url',
      destinationUrl: 'https://example.com',
      publicUrl: `https://nfc.app.br/t/${code}`,
      qrCodeDataUri: 'data:image/svg+xml;base64,cXI=',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('app-tag-write')).not.toBeNull();
    expect(element.textContent).toContain('Gravar placa NFC');
    expect(element.textContent).not.toContain('Leia este QR Code com o celular');
    expect(element.querySelector('details')?.open).toBeFalse();
    expect(element.querySelector('summary')?.textContent).toContain('QR Code do link (opcional)');
    expect(element.textContent).toContain('salva neste dispositivo e navegador, não na conta');
    expect(element.querySelector('a[href="/signup"]')).not.toBeNull();
    TestBed.inject(AuthSessionStore).setUser({ id: '1', name: 'Pessoa', email: 'pessoa@example.com', pictureUrl: null });
    fixture.detectChanges();
    expect(element.querySelector('a[href="/signup"]')).toBeNull();
    expect(element.textContent).toContain('salva neste dispositivo e navegador, não na conta');
  });
});

describe('edição de placa Google Avaliações', () => {
  const oldPlace: PlaceDetails = {
        placeId: 'old-place', name: 'Café antigo', address: 'Rua A',
        reviewUrl: 'https://google.com/review/old', rating: 4, userRatingCount: 3,
        googleMapsUrl: null, photoUrl: null, photoAttributions: [],
  };
  const newPlace: PlaceDetails = {
        placeId: 'new-place', name: 'Café novo', address: 'Rua B',
        reviewUrl: 'https://google.com/review/new', rating: 5, userRatingCount: 10,
        googleMapsUrl: null, photoUrl: null, photoAttributions: [],
  };
  const original: NfcTag = {
        id: 'existing-tag', name: oldPlace.name, type: 'google-review',
        destinationUrl: oldPlace.reviewUrl, destinationLabel: oldPlace.name,
        publicUrl: 'https://nfc.app.br/t/existing-tag', managementToken: 'token',
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  };
  let tags: LocalTagsService;
  let clients: LocalClientsService;
  let api: jasmine.SpyObj<TagsApiService>;

  beforeEach(() => {
        localStorage.removeItem(LOCAL_TAGS_STORAGE_KEY);
        localStorage.removeItem(LOCAL_CLIENTS_STORAGE_KEY);
        api = jasmine.createSpyObj<TagsApiService>('TagsApiService', ['searchPlaces', 'placeDetails', 'update', 'create']);
        api.searchPlaces.and.returnValue(of([newPlace]));
        api.placeDetails.and.returnValue(of(newPlace));
        TestBed.configureTestingModule({
          imports: [TagFormComponent],
          providers: [
            provideRouter([]),
            { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => original.id } } } },
            { provide: TagsApiService, useValue: api },
          ],
        });
        tags = TestBed.inject(LocalTagsService);
        clients = TestBed.inject(LocalClientsService);
        tags.saveRemote(original);
        clients.setPlace(original, oldPlace);
        api.update.and.callFake((id: string, input: NfcTagInput) => {
          const updated = { ...original, ...input, id };
          tags.saveRemote(updated);
          return of(updated);
        });
  });

  afterEach(() => {
        localStorage.removeItem(LOCAL_TAGS_STORAGE_KEY);
        localStorage.removeItem(LOCAL_CLIENTS_STORAGE_KEY);
  });

  it('carrega o estabelecimento e pesquisa outro usando o fluxo de cadastro', fakeAsync(() => {
        const fixture = TestBed.createComponent(TagFormComponent);
        fixture.detectChanges();
        const form = fixture.componentInstance;
        const element = fixture.nativeElement as HTMLElement;

        expect(element.textContent).toContain(oldPlace.name);
        expect(form.selectedPlace()?.placeId).toBe(oldPlace.placeId);
        expect(element.querySelector('#tag-name')).toBeNull();
        const change = Array.from(element.querySelectorAll('button'))
          .find((button) => button.textContent?.includes('Alterar estabelecimento'));
        expect(change).toBeDefined();
        change!.click();
        fixture.detectChanges();

        const search = element.querySelector<HTMLInputElement>('#place-search')!;
        search.value = 'Café novo';
        search.dispatchEvent(new Event('input'));
        tick(400);
        fixture.detectChanges();
        expect(api.searchPlaces).toHaveBeenCalledOnceWith('Café novo');
        const result = Array.from(element.querySelectorAll('button'))
          .find((button) => button.textContent?.includes(newPlace.address));
        expect(result).toBeDefined();
        result!.click();
        fixture.detectChanges();
        expect(api.placeDetails).toHaveBeenCalledOnceWith(newPlace.placeId);
        expect(form.selectedPlace()?.placeId).toBe(newPlace.placeId);
        expect(form.form.controls.name.value).toBe(newPlace.name);
        expect(form.form.controls.destination.value).toBe(newPlace.reviewUrl);

        form.continueToReview();
        expect(form.reviewMode()).toBeTrue();
        form.publish();
        expect(api.update).toHaveBeenCalledOnceWith(original.id, jasmine.objectContaining({
          name: newPlace.name, destinationLabel: newPlace.name, destinationUrl: newPlace.reviewUrl,
        }), original.managementToken!);
        expect(api.create).not.toHaveBeenCalled();
        const saved = tags.getById(original.id)!;
        expect(saved.publicUrl).toBe(original.publicUrl);
        expect(saved.id).toBe(original.id);
        expect(clients.placeForTag(saved)?.placeId).toBe(newPlace.placeId);
        tick(400);
  }));

  it('preserva o estabelecimento e o link público ao salvar sem alterações', () => {
        const form = TestBed.createComponent(TagFormComponent).componentInstance;
        form.continueToReview();
        form.publish();
        const saved = tags.getById(original.id)!;
        expect(saved.publicUrl).toBe(original.publicUrl);
        expect(saved.destinationUrl).toBe(oldPlace.reviewUrl);
        expect(clients.placeForTag(saved)?.placeId).toBe(oldPlace.placeId);
  });

  it('conclui a edição sem solicitar uma nova gravação NFC', () => {
        const fixture = TestBed.createComponent(TagFormComponent);
        fixture.componentInstance.continueToReview();
        fixture.componentInstance.publish();
        fixture.detectChanges();

        const element = fixture.nativeElement as HTMLElement;
        expect(element.textContent).toContain('não é necessário gravar o NFC novamente');
        expect(element.querySelector('app-tag-write')).toBeNull();
        expect(element.querySelector('a[href="/tags"]')?.textContent).toContain('Concluir');
  });

  it('permite pesquisar ou inserir manualmente quando não há dados locais do estabelecimento', () => {
        clients.forgetTag(original.id);
        const fixture = TestBed.createComponent(TagFormComponent);
        fixture.detectChanges();
        const form = fixture.componentInstance;
        const element = fixture.nativeElement as HTMLElement;
        expect(element.textContent).toContain(oldPlace.name);
        expect(form.form.controls.destination.value).toBe(oldPlace.reviewUrl);
        form.useGoogleSearch();
        fixture.detectChanges();
        expect(element.querySelector('#place-search')).not.toBeNull();
        form.switchToManualGoogle();
        fixture.detectChanges();
        expect(element.querySelector('#tag-name')).not.toBeNull();
        expect(element.querySelector('#google-link')).not.toBeNull();
  });
});
