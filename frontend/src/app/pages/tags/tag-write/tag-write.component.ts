import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TagsApiService, WriteConfiguration } from '../../../core/tags/tags-api.service';
import { ButtonComponent } from '../../../shared/components/ui/button/button.component';

interface NdefRecord {
  recordType: string;
  data?: DataView | null;
}

interface NdefReadingEvent extends Event {
  message: { records: readonly NdefRecord[] };
}

interface NdefReader extends EventTarget {
  write(message: { records: { recordType: 'url'; data: string }[] }, options: { signal: AbortSignal; overwrite: boolean }): Promise<void>;
  scan(options: { signal: AbortSignal }): Promise<void>;
}

type NdefReaderConstructor = new () => NdefReader;
type NfcState = 'idle' | 'starting' | 'waiting' | 'reading' | 'success' | 'error';

@Component({
  selector: 'app-tag-write',
  imports: [RouterLink, ButtonComponent],
  templateUrl: './tag-write.component.html',
})
export class TagWriteComponent implements OnInit {
  @Input() code = '';
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(TagsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private operation: AbortController | null = null;
  private generation = 0;

  readonly configuration = signal<WriteConfiguration | null>(null);
  readonly loading = signal(false);
  readonly state = signal<NfcState>('idle');
  readonly message = signal('');
  readonly confirmOverwrite = signal(false);
  readonly device = this.detectDevice();
  readonly supported = window.isSecureContext && this.device === 'android' && typeof this.readerConstructor() === 'function';

  constructor() {
    this.destroyRef.onDestroy(() => this.cancel());
  }

  ngOnInit(): void {
    this.code ||= this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  load(): void {
    this.cancel();
    this.configuration.set(null);
    this.message.set('');
    this.loading.set(true);
    this.api.writeConfiguration(this.code).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (configuration) => {
        this.loading.set(false);
        if (!this.isValidPublicUrl(configuration.publicUrl)) {
          this.state.set('error');
          this.message.set('O servidor retornou um link público inválido ou sem HTTPS. Verifique a configuração do projeto.');
          return;
        }
        this.configuration.set(configuration);
      },
      error: () => {
        this.loading.set(false);
        this.state.set('error');
        this.message.set('Não foi possível confirmar a placa no servidor. Ela pode estar desativada ou indisponível. Tente novamente.');
      },
    });
  }

  async write(): Promise<void> {
    const configuration = this.configuration();
    const Reader = this.readerConstructor();
    if (!configuration || !this.supported || !Reader || !this.confirmOverwrite()) {
      return;
    }
    this.confirmOverwrite.set(false);
    this.cancel();
    const operation = new AbortController();
    this.operation = operation;
    const generation = this.generation;
    this.state.set('starting');
    this.message.set('Solicitando permissão para gravação...');
    try {
      const promise = new Reader().write(
        { records: [{ recordType: 'url', data: configuration.publicUrl }] },
        { signal: operation.signal, overwrite: true },
      );
      this.state.set('waiting');
      this.message.set('Aproxime a placa e mantenha-a próxima enquanto a gravação é realizada.');
      await promise;
      if (generation !== this.generation) return;
      this.operation = null;
      this.state.set('success');
      this.message.set('Gravação concluída. Teste a placa antes de finalizar.');
    } catch (error) {
      if (generation !== this.generation) return;
      this.operation = null;
      this.state.set('error');
      this.message.set(this.errorMessage(error));
    }
  }

  async read(): Promise<void> {
    const configuration = this.configuration();
    const Reader = this.readerConstructor();
    if (!configuration || !this.supported || !Reader) return;
    this.cancel();
    const operation = new AbortController();
    this.operation = operation;
    const generation = this.generation;
    try {
      const reader = new Reader();
      this.state.set('reading');
      this.message.set('Aproxime a placa para verificar o link gravado.');
      reader.addEventListener('reading', (event) => {
        if (generation !== this.generation) return;
        const records = (event as NdefReadingEvent).message.records;
        const matches = records.some((record) =>
          record.recordType === 'url' && record.data && new TextDecoder().decode(record.data) === configuration.publicUrl,
        );
        this.cancel();
        this.state.set(matches ? 'success' : 'error');
        this.message.set(matches
          ? 'O link NFC.APP gravado corresponde ao desta placa.'
          : 'O cartão não contém o link esperado. Confira a placa e tente gravar novamente.');
      });
      reader.addEventListener('readingerror', () => {
        if (generation !== this.generation) return;
        this.cancel();
        this.state.set('error');
        this.message.set('Não foi possível ler o cartão. Verifique se ele é compatível e tente novamente.');
      });
      await reader.scan({ signal: operation.signal });
    } catch (error) {
      if (generation !== this.generation) return;
      this.operation = null;
      this.state.set('error');
      this.message.set(this.errorMessage(error));
    }
  }

  cancel(): void {
    this.generation++;
    this.operation?.abort();
    this.operation = null;
    this.state.set('idle');
    this.message.set('');
  }

  async copy(): Promise<void> {
    const configuration = this.configuration();
    if (!configuration) return;
    try {
      await navigator.clipboard.writeText(configuration.publicUrl);
      this.message.set('Link copiado. Grave-o como URL no aplicativo NFC.');
    } catch {
      this.state.set('error');
      this.message.set('Não foi possível copiar o link. Selecione e copie o endereço exibido.');
    }
  }

  private readerConstructor(): NdefReaderConstructor | undefined {
    return (window as Window & { NDEFReader?: NdefReaderConstructor }).NDEFReader;
  }

  private detectDevice(): 'android' | 'iphone' | 'computer' {
    const agent = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(agent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'iphone';
    return /Android/i.test(agent) ? 'android' : 'computer';
  }

  private isValidPublicUrl(value: string): boolean {
    try {
      const url = new URL(value);
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      return (url.protocol === 'https:' || (url.protocol === 'http:' && local))
        && !url.username && !url.password && !url.search && !url.hash
        && url.pathname === `/t/${this.code}` && /^[A-Za-z0-9_-]{24}$/.test(this.code);
    } catch {
      return false;
    }
  }

  private errorMessage(error: unknown): string {
    const name = error instanceof Error || error instanceof DOMException ? error.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') return 'Permissão NFC negada ou contexto inseguro. Use HTTPS e permita o acesso ao NFC no navegador.';
    if (name === 'NotSupportedError') return 'NFC indisponível neste dispositivo ou navegador. Ative o NFC e use um navegador Android compatível.';
    if (name === 'NotReadableError' || name === 'NetworkError') return 'Não foi possível acessar o cartão. Verifique se o NFC está ligado e se o cartão é compatível e não está bloqueado.';
    if (name === 'InvalidStateError') return 'Outra operação NFC está em andamento. Cancele-a e tente novamente.';
    return 'Não foi possível acessar ou gravar o cartão. Ele pode ser incompatível, estar bloqueado ou fora de alcance. Tente novamente.';
  }
}
