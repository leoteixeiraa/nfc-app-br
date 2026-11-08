import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TagsApiService, WriteConfiguration } from '../../../core/tags/tags-api.service';
import { TagWriteComponent } from './tag-write.component';

const code = 'abcdefghijklmnopqrstuvwx';
const config: WriteConfiguration = {
  name: 'Balcão',
  publicUrl: `https://nfc.app.br/t/${code}`,
  continuationQrCodeDataUri: 'data:image/svg+xml;base64,cXI=',
};

class FakeReader extends EventTarget {
  static instance: FakeReader;
  static resolveWrite: () => void;
  static rejectWrite: (reason: unknown) => void;
  static written: unknown;
  static options: { signal: AbortSignal; overwrite: boolean };

  constructor() {
    super();
    FakeReader.instance = this;
  }

  write(message: unknown, options: { signal: AbortSignal; overwrite: boolean }): Promise<void> {
    FakeReader.written = message;
    FakeReader.options = options;
    return new Promise((resolve, reject) => {
      FakeReader.resolveWrite = resolve;
      FakeReader.rejectWrite = reject;
    });
  }

  scan(): Promise<void> {
    return Promise.resolve();
  }
}

describe('TagWriteComponent', () => {
  let component: TagWriteComponent;
  let api: jasmine.SpyObj<TagsApiService>;
  let originalReader: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalReader = Object.getOwnPropertyDescriptor(window, 'NDEFReader');
    Object.defineProperty(window, 'NDEFReader', { value: FakeReader, configurable: true });
    api = jasmine.createSpyObj<TagsApiService>('TagsApiService', ['writeConfiguration']);
    api.writeConfiguration.and.returnValue(of(config));
    TestBed.configureTestingModule({
      imports: [TagWriteComponent],
      providers: [
        provideRouter([]),
        { provide: TagsApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => code } } } },
      ],
    });
    const fixture = TestBed.createComponent(TagWriteComponent);
    component = fixture.componentInstance;
    Object.defineProperty(component, 'supported', { value: true });
    fixture.detectChanges();
  });

  afterEach(() => {
    if (originalReader) Object.defineProperty(window, 'NDEFReader', originalReader);
    else Reflect.deleteProperty(window, 'NDEFReader');
  });

  it('só confirma sucesso após gravar a URL dinâmica', async () => {
    const writing = component.write();
    expect(component.state()).toBe('waiting');
    expect(FakeReader.written).toEqual({ records: [{ recordType: 'url', data: config.publicUrl }] });
    expect(FakeReader.options.overwrite).toBeFalse();
    FakeReader.resolveWrite();
    await writing;
    expect(component.state()).toBe('success');
  });

  it('não permite substituir conteúdo sem identificação e confirmação', async () => {
    FakeReader.written = undefined;
    await component.write(true);
    expect(FakeReader.written).toBeUndefined();
  });

  it('mostra erro de permissão e permite nova tentativa', async () => {
    const writing = component.write();
    FakeReader.rejectWrite(new DOMException('Denied', 'NotAllowedError'));
    await writing;
    expect(component.state()).toBe('error');
    expect(component.message()).toContain('permita o NFC');
    expect(component.confirmOverwrite()).toBeFalse();
    expect(component.canInspectExisting()).toBeTrue();
    const retry = component.write();
    FakeReader.resolveWrite();
    await retry;
    expect(component.state()).toBe('success');
  });

  it('identifica falha de acesso ao cartão sem indicar sucesso', async () => {
    const writing = component.write();
    FakeReader.rejectWrite(new DOMException('Falha', 'NotReadableError'));
    await writing;
    expect(component.state()).toBe('error');
    expect(component.message()).toContain('bloqueado');
  });

  it('cancela a operação sem indicar sucesso tardio', async () => {
    const writing = component.write();
    const signal = FakeReader.options.signal;
    component.cancel();
    expect(signal.aborted).toBeTrue();
    FakeReader.resolveWrite();
    await writing;
    expect(component.state()).toBe('idle');
  });

  it('solicita confirmação somente após identificar dados e permite regravar', async () => {
    const firstWrite = component.write();
    FakeReader.rejectWrite(new DOMException('Existem dados ou falta permissão', 'NotAllowedError'));
    await firstWrite;
    await component.read(true);
    FakeReader.instance.dispatchEvent(Object.assign(new Event('reading'), {
      message: { records: [{ recordType: 'text' }] },
    }));
    expect(component.confirmOverwrite()).toBeTrue();
    const writing = component.write(true);
    expect(FakeReader.options.overwrite).toBeTrue();
    expect(component.state()).toBe('waiting');
    FakeReader.resolveWrite();
    await writing;
    expect(component.state()).toBe('success');
  });

  it('não solicita confirmação quando a leitura indica cartão vazio', async () => {
    await component.read(true);
    FakeReader.instance.dispatchEvent(Object.assign(new Event('reading'), {
      message: { records: [{ recordType: 'empty' }] },
    }));
    expect(component.confirmOverwrite()).toBeFalse();
    expect(component.message()).toContain('Nenhum conteúdo');
  });

  it('não autoriza sobrescrita quando não consegue ler a placa', async () => {
    await component.read(true);
    FakeReader.instance.dispatchEvent(new Event('readingerror'));
    expect(component.state()).toBe('error');
    expect(component.confirmOverwrite()).toBeFalse();
    expect(component.message()).toContain('compatível');
  });

  it('descarta leitura tardia e autorização após cancelamento', async () => {
    await component.read(true);
    const reader = FakeReader.instance;
    component.cancel();
    reader.dispatchEvent(Object.assign(new Event('reading'), {
      message: { records: [{ recordType: 'text' }] },
    }));
    expect(component.state()).toBe('idle');
    expect(component.confirmOverwrite()).toBeFalse();
  });

  it('valida o conteúdo lido e rejeita outro endereço', async () => {
    await component.read();
    const bytes = new TextEncoder().encode('https://example.com');
    FakeReader.instance.dispatchEvent(Object.assign(new Event('reading'), {
      message: { records: [{ recordType: 'url', data: new DataView(bytes.buffer) }] },
    }));
    expect(component.state()).toBe('error');
    await component.read();
    const expected = new TextEncoder().encode(config.publicUrl);
    FakeReader.instance.dispatchEvent(Object.assign(new Event('reading'), {
      message: { records: [{ recordType: 'url', data: new DataView(expected.buffer) }] },
    }));
    expect(component.state()).toBe('success');
  });

  it('não oferece gravação se o servidor não confirmar a placa', () => {
    api.writeConfiguration.and.returnValue(throwError(() => new Error('indisponível')));
    component.load();
    expect(component.configuration()).toBeNull();
    expect(component.state()).toBe('error');
  });

  it('rejeita URL final ou endereço público inseguro', () => {
    api.writeConfiguration.and.returnValue(of({ ...config, publicUrl: 'http://nfc.app.br/t/' + code }));
    component.load();
    expect(component.configuration()).toBeNull();
    api.writeConfiguration.and.returnValue(of({ ...config, publicUrl: 'https://example.com/' }));
    component.load();
    expect(component.configuration()).toBeNull();
  });

  it('identifica iPhone, Android e computador sem depender do armazenamento local', () => {
    const agent = spyOnProperty(navigator, 'userAgent', 'get');
    agent.and.returnValue('Mozilla/5.0 (iPhone; CPU iPhone OS)');
    expect(TestBed.createComponent(TagWriteComponent).componentInstance.device).toBe('iphone');
    agent.and.returnValue('Mozilla/5.0 (Linux; Android 14)');
    expect(TestBed.createComponent(TagWriteComponent).componentInstance.device).toBe('android');
    agent.and.returnValue('Mozilla/5.0 (Windows NT 10.0)');
    expect(TestBed.createComponent(TagWriteComponent).componentInstance.device).toBe('computer');
  });

  it('não oferece Web NFC quando a API não está disponível', () => {
    spyOnProperty(navigator, 'userAgent', 'get').and.returnValue('Mozilla/5.0 (Linux; Android 14)');
    Reflect.deleteProperty(window, 'NDEFReader');
    expect(TestBed.createComponent(TagWriteComponent).componentInstance.supported).toBeFalse();
  });

  it('exibe botão de gravação direta no Android e mantém QR do link opcional', () => {
    spyOnProperty(navigator, 'userAgent', 'get').and.returnValue('Mozilla/5.0 (Linux; Android 14)');
    const fixture = TestBed.createComponent(TagWriteComponent);
    Object.defineProperty(fixture.componentInstance, 'supported', { value: true });
    fixture.componentInstance.linkQrCodeDataUri = 'data:image/svg+xml;base64,cXI=';
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('summary')?.textContent).toContain('QR Code do link (opcional)');
    expect(element.querySelector('details')?.open).toBeFalse();
    expect(element.textContent).not.toContain('Leia este QR Code com o celular');
    const button = Array.from(element.querySelectorAll('button')).find((item) => item.textContent?.includes('Gravar placa NFC'));
    expect(button).toBeDefined();
    button?.click();
    expect(FakeReader.options.overwrite).toBeFalse();
    expect(fixture.componentInstance.state()).toBe('waiting');
    fixture.destroy();
  });

  it('oferece copiar no iPhone e QR para continuação no computador', () => {
    const agent = spyOnProperty(navigator, 'userAgent', 'get');
    agent.and.returnValue('Mozilla/5.0 (iPhone; CPU iPhone OS)');
    const iphone = TestBed.createComponent(TagWriteComponent);
    iphone.detectChanges();
    expect((iphone.nativeElement as HTMLElement).textContent).toContain('aplicativo NFC');
    expect((iphone.nativeElement as HTMLElement).textContent).toContain('Copiar link');
    expect((iphone.nativeElement as HTMLElement).textContent).not.toContain('Leia este QR Code');
    agent.and.returnValue('Mozilla/5.0 (Windows NT 10.0)');
    const desktop = TestBed.createComponent(TagWriteComponent);
    desktop.detectChanges();
    expect((desktop.nativeElement as HTMLElement).textContent).toContain('Leia este QR Code com o celular');
    expect((desktop.nativeElement as HTMLElement).textContent).toContain('apenas no navegador original');
  });
});
