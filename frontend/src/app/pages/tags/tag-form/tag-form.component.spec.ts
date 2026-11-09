import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthSessionStore } from '../../../core/auth/auth-session.store';
import { LocalTagsService } from '../../../core/tags/local-tags.service';
import { TagsApiService } from '../../../core/tags/tags-api.service';
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
