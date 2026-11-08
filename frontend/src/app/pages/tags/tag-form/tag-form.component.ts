import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { LocalTagsError, LocalTagsService } from '../../../core/tags/local-tags.service';
import {
  NfcTag,
  NfcTagInput,
  NfcTagType,
  tagTypeLabel,
  validateDestinationUrl,
  validateTagName,
} from '../../../core/tags/nfc-tag';
import { PixPreview, PlaceDetails, PlaceResult, TagsApiService } from '../../../core/tags/tags-api.service';
import { ButtonComponent } from '../../../shared/components/ui/button/button.component';
import { InputDirective } from '../../../shared/components/ui/input/input.directive';
import { TagWriteComponent } from '../tag-write/tag-write.component';

const FIELD_CLASSES =
  'h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30';

@Component({
  selector: 'app-tag-form',
  imports: [ReactiveFormsModule, RouterLink, ButtonComponent, InputDirective, TagWriteComponent],
  host: { class: 'block' },
  templateUrl: './tag-form.component.html',
})
export class TagFormComponent {
  private readonly localTags = inject(LocalTagsService);
  private readonly tagsApi = inject(TagsApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly fieldClasses = FIELD_CLASSES;
  readonly typeLabel = tagTypeLabel;
  readonly submitError = signal('');
  readonly notFound = signal(false);
  readonly isSaving = signal(false);
  readonly isSearching = signal(false);
  readonly isLoadingPlaceDetails = signal(false);
  readonly searchError = signal('');
  readonly results = signal<PlaceResult[]>([]);
  readonly selectedPlace = signal<PlaceDetails | PlaceResult | null>(null);
  readonly manualGoogle = signal(false);
  readonly reviewMode = signal(false);
  readonly createdTag = signal<NfcTag | null>(null);
  readonly writingTag = signal(false);
  readonly pixPreview = signal<PixPreview | null>(null);
  readonly tagId: string | null = inject(ActivatedRoute).snapshot.paramMap.get('id');
  private managementToken = '';
  private idempotencyKey = '';
  private legacyTagId: string | null = null;

  readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, (control: AbstractControl) => this.nameValidator(control)]],
    type: ['google-review' as NfcTagType, Validators.required],
    destination: ['', [(control: AbstractControl) => this.destinationValidator(control)]],
    placeSearch: [''],
    pixKey: [''],
    pixCity: [''],
  });

  constructor() {
    this.form.controls.type.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((type) => {
      this.form.controls.destination.updateValueAndValidity();
      const selectedName = this.selectedPlace()?.name;
      if (selectedName && selectedName === this.form.controls.name.value) {
        this.form.controls.name.setValue('');
      }
      this.results.set([]);
      this.selectedPlace.set(null);
      this.searchError.set('');
      this.manualGoogle.set(false);
      if (type !== 'pix') {
        this.form.controls.pixKey.markAsUntouched();
        this.form.controls.pixCity.markAsUntouched();
      }
    });

    this.form.controls.placeSearch.valueChanges
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap((query) => {
          const value = query.trim();
          this.results.set([]);
          this.searchError.set('');
          if (value.length < 3 || this.form.controls.type.value !== 'google-review' || this.manualGoogle()) {
            this.isSearching.set(false);
            return of([]);
          }
          this.isSearching.set(true);
          return this.tagsApi.searchPlaces(value).pipe(
            catchError((error: unknown) => {
              this.searchError.set(this.messageFrom(error, 'Não foi possível pesquisar no Google.'));
              return of([]);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((places) => {
        this.isSearching.set(false);
        this.results.set(places);
        if (places.length === 0 && this.form.controls.placeSearch.value.trim().length >= 3 && !this.searchError()) {
          this.searchError.set('Nenhuma empresa encontrada. Tente outro nome ou insira o link manualmente.');
        }
      });

    if (this.tagId) {
      this.loadTag(this.tagId);
    }
  }

  get isEditing(): boolean {
    return this.tagId !== null;
  }

  get type(): NfcTagType {
    return this.form.controls.type.value;
  }

  get isPix(): boolean {
    return this.type === 'pix';
  }

  get isGoogleReview(): boolean {
    return this.type === 'google-review';
  }

  get destinationLabel(): string {
    return this.type === 'whatsapp' ? 'Número do WhatsApp (com DDI)' : 'URL de destino (HTTPS)';
  }

  get destinationPlaceholder(): string {
    return this.type === 'whatsapp' ? '5511999999999' : 'https://exemplo.com.br';
  }

  showError(name: 'name' | 'destination'): string | null {
    const control = this.form.controls[name];
    return control.touched && control.errors ? (control.errors['message'] as string) : null;
  }

  selectType(type: NfcTagType): void {
    this.form.controls.type.setValue(type);
    this.form.controls.destination.setValue('');
    this.form.controls.placeSearch.setValue('');
  }

  choosePlace(place: PlaceResult): void {
    this.isLoadingPlaceDetails.set(true);
    this.searchError.set('');
    this.tagsApi
      .placeDetails(place.placeId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (details) => {
          this.isLoadingPlaceDetails.set(false);
          if (!this.isGoogleReview || this.manualGoogle()) {
            return;
          }
          this.selectedPlace.set(details);
          this.form.controls.name.setValue(details.name);
          this.form.controls.destination.setValue(details.reviewUrl);
          this.results.set([]);
        },
        error: (error: unknown) => {
          this.isLoadingPlaceDetails.set(false);
          if (this.isGoogleReview && !this.manualGoogle()) {
            this.searchError.set(this.messageFrom(error, 'Não foi possível obter as informações do estabelecimento.'));
          }
        },
      });
  }

  switchToManualGoogle(): void {
    this.manualGoogle.set(true);
    this.results.set([]);
    this.selectedPlace.set(null);
    this.form.controls.name.setValue('');
    this.form.controls.placeSearch.setValue('');
    this.form.controls.destination.setValue('');
  }

  useGoogleSearch(): void {
    this.manualGoogle.set(false);
    this.selectedPlace.set(null);
    this.form.controls.destination.setValue('');
  }

  continueToReview(): void {
    this.submitError.set('');
    const { name, type, destination, pixKey, pixCity } = this.form.getRawValue();
    const invalidName = validateTagName(name);
    if (invalidName) {
      this.form.controls.name.markAsTouched();
      this.submitError.set(invalidName);
      return;
    }
    if (type === 'pix') {
      if (name.trim().length > 25) {
        this.form.controls.name.markAsTouched();
        this.submitError.set('O nome do estabelecimento deve ter até 25 caracteres para o Pix.');
        return;
      }
      if (!pixKey.trim() || !pixCity.trim()) {
        this.form.controls.pixKey.markAsTouched();
        this.form.controls.pixCity.markAsTouched();
        this.submitError.set('Preencha o nome do estabelecimento, a chave Pix e a cidade.');
        return;
      }
    } else {
      const error = validateDestinationUrl(type, destination.trim());
      if (error) {
        this.form.controls.destination.markAsTouched();
        this.submitError.set(error);
        return;
      }
    }
    if (type === 'pix') {
      this.isSaving.set(true);
      this.tagsApi.previewPix(pixKey, name.trim(), pixCity).subscribe({
        next: (preview) => {
          this.pixPreview.set(preview);
          this.isSaving.set(false);
          this.reviewMode.set(true);
        },
        error: (error: unknown) => {
          this.isSaving.set(false);
          this.submitError.set(this.messageFrom(error, 'Não foi possível gerar o código Pix.'));
        },
      });
      return;
    }
    this.reviewMode.set(true);
  }

  backToForm(): void {
    this.reviewMode.set(false);
    this.submitError.set('');
  }

  publish(): void {
    if (this.isSaving()) {
      return;
    }
    this.submitError.set('');
    this.isSaving.set(true);
    const input = this.toInput();
    const isRemoteEdit = Boolean(this.tagId && this.managementToken);
    if (!this.managementToken) {
      this.managementToken = this.randomToken();
    }
    if (!isRemoteEdit && !this.idempotencyKey) {
      this.idempotencyKey = crypto.randomUUID();
    }

    const request = isRemoteEdit
      ? this.tagsApi.update(this.tagId!, input, this.managementToken)
      : this.tagsApi.create(input, this.managementToken, this.idempotencyKey);
    request.subscribe({
      next: (tag) => {
        if (this.legacyTagId) {
          try {
            this.localTags.remove(this.legacyTagId);
          } catch (error) {
            this.submitError.set(error instanceof LocalTagsError ? error.message : 'A placa foi publicada, mas o rascunho antigo não foi removido.');
          }
        }
        this.createdTag.set(tag);
        this.isSaving.set(false);
      },
      error: (error: unknown) => {
        this.submitError.set(this.messageFrom(error, 'Não foi possível publicar a placa. Tente novamente.'));
        this.isSaving.set(false);
      },
    });
  }

  async copyLink(tag: NfcTag): Promise<void> {
    if (!tag.publicUrl) {
      this.submitError.set('Esta placa antiga ainda não possui um link público.');
      return;
    }
    try {
      await navigator.clipboard.writeText(tag.publicUrl);
    } catch {
      this.submitError.set('Não foi possível copiar o link. Verifique a permissão do navegador.');
    }
  }

  async copyValue(value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      this.submitError.set('Não foi possível copiar o código. Verifique a permissão do navegador.');
    }
  }

  testDestination(): void {
    const url = this.form.controls.destination.value.trim();
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  downloadQr(tag: NfcTag): void {
    if (!tag.qrCodeDataUri) {
      this.submitError.set('O QR Code desta placa não está disponível.');
      return;
    }
    const anchor = document.createElement('a');
    anchor.href = tag.qrCodeDataUri;
    anchor.download = `nfc-app-${tag.id}.svg`;
    anchor.click();
  }

  private toInput(): NfcTagInput {
    const values = this.form.getRawValue();
    const type = values.type;
    const digits = values.destination.trim().replace(/[\s().+-]/g, '');
    const destinationUrl = type === 'whatsapp' ? `https://wa.me/${digits}` : values.destination.trim();
    return {
      name: values.name.trim(),
      type,
      destinationUrl: type === 'pix' ? '' : destinationUrl,
      destinationLabel: type === 'google-review' ? this.selectedPlace()?.name : undefined,
      pixKey: type === 'pix' ? values.pixKey.trim() : undefined,
      pixReceiverName: type === 'pix' ? values.name.trim() : undefined,
      pixCity: type === 'pix' ? values.pixCity.trim() : undefined,
    };
  }

  private loadTag(id: string): void {
    try {
      const tag = this.localTags.getById(id);
      if (!tag) {
        this.notFound.set(true);
        return;
      }
      const legacyPix = tag.type === 'pix' && !tag.pixKey;
      this.form.patchValue({
        name: tag.type === 'pix' ? tag.pixReceiverName ?? tag.name : tag.destinationLabel ?? tag.name,
        type: legacyPix ? 'url' : tag.type,
        destination: legacyPix
          ? tag.destinationUrl
          : tag.type === 'pix'
            ? ''
            : tag.type === 'whatsapp'
              ? tag.destinationUrl.replace('https://wa.me/', '')
              : tag.destinationUrl,
        pixKey: tag.pixKey ?? '',
        pixCity: tag.pixCity ?? '',
      });
      this.managementToken = tag.managementToken ?? '';
      this.legacyTagId = tag.managementToken ? null : tag.id;
      if (tag.type === 'google-review' && tag.destinationLabel) {
        this.selectedPlace.set({ placeId: '', name: tag.destinationLabel, address: '' });
        this.manualGoogle.set(true);
      }
    } catch (error) {
      this.notFound.set(true);
      this.submitError.set(error instanceof LocalTagsError ? error.message : 'Não foi possível carregar a placa.');
    }
  }

  private nameValidator(control: AbstractControl): ValidationErrors | null {
    const message = validateTagName(String(control.value ?? ''));
    return message ? { message } : null;
  }

  private destinationValidator(control: AbstractControl): ValidationErrors | null {
    const type = this.form?.controls.type.value ?? 'google-review';
    if (type === 'pix') {
      return null;
    }
    const destination = String(control.value ?? '').trim();
    const message = validateDestinationUrl(type, type === 'whatsapp' ? `https://wa.me/${destination}` : destination);
    return message ? { message } : null;
  }

  private randomToken(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  private messageFrom(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 429) {
        return 'Muitas buscas em pouco tempo. Aguarde um instante e tente novamente.';
      }
      const detail = error.error?.detail ?? error.error?.message;
      return typeof detail === 'string' ? detail : fallback;
    }
    return error instanceof Error ? error.message : fallback;
  }
}
