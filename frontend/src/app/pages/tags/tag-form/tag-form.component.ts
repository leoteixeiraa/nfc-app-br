import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LocalTagsError, LocalTagsService } from '../../../core/tags/local-tags.service';
import {
  buildDestinationUrl,
  destinationToFormValue,
  isNfcTagType,
  NAME_MAX_LENGTH,
  NFC_TAG_TYPES,
  NfcTagType,
  validateDestinationUrl,
  validateTagName,
} from '../../../core/tags/nfc-tag';
import { ButtonComponent } from '../../../shared/components/ui/button/button.component';
import { InputDirective } from '../../../shared/components/ui/input/input.directive';

const FIELD_CLASSES =
  'h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30';

@Component({
  selector: 'app-tag-form',
  imports: [ReactiveFormsModule, RouterLink, ButtonComponent, InputDirective],
  host: { class: 'block' },
  templateUrl: './tag-form.component.html',
})
export class TagFormComponent {
  private readonly localTags = inject(LocalTagsService);
  private readonly router = inject(Router);

  readonly types = NFC_TAG_TYPES;
  readonly nameMaxLength = NAME_MAX_LENGTH;
  readonly fieldClasses = FIELD_CLASSES;
  readonly submitError = signal('');
  readonly notFound = signal(false);
  readonly tagId: string | null = inject(ActivatedRoute).snapshot.paramMap.get('id');

  readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, (control: AbstractControl) => this.nameValidator(control)]],
    type: ['google-review' as NfcTagType, Validators.required],
    destination: ['', [(control: AbstractControl) => this.destinationValidator(control)]],
  });

  constructor() {
    this.form.controls.type.valueChanges.subscribe(() => this.form.controls.destination.updateValueAndValidity());

    if (this.tagId) {
      this.loadTag(this.tagId);
    }
  }

  get isEditing(): boolean {
    return this.tagId !== null;
  }

  get isWhatsapp(): boolean {
    return this.form.controls.type.value === 'whatsapp';
  }

  get destinationLabel(): string {
    return this.isWhatsapp ? 'Número do WhatsApp (com DDI)' : 'URL de destino (HTTPS)';
  }

  get destinationPlaceholder(): string {
    switch (this.form.controls.type.value) {
      case 'whatsapp':
        return '5511999999999';
      case 'google-review':
        return 'https://g.page/r/.../review';
      case 'pix':
        return 'https://link-de-pagamento.exemplo/pix';
      default:
        return 'https://exemplo.com.br';
    }
  }

  onTypeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (isNfcTagType(value)) {
      this.form.controls.type.setValue(value);
    }
  }

  showError(name: 'name' | 'destination'): string | null {
    const control = this.form.controls[name];
    return control.touched && control.errors ? (control.errors['message'] as string) : null;
  }

  save(): void {
    this.submitError.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, type, destination } = this.form.getRawValue();
    const input = { name, type, destinationUrl: buildDestinationUrl(type, destination) };

    try {
      if (this.tagId) {
        this.localTags.update(this.tagId, input);
      } else {
        this.localTags.create(input);
      }
    } catch (error) {
      this.submitError.set(
        error instanceof LocalTagsError ? error.message : 'Não foi possível salvar a placa. Tente novamente.',
      );
      return;
    }

    void this.router.navigate(['/'], {
      state: { notice: this.tagId ? 'Placa atualizada com sucesso.' : 'Placa criada com sucesso.' },
    });
  }

  private loadTag(id: string): void {
    try {
      const tag = this.localTags.getById(id);
      if (!tag) {
        this.notFound.set(true);
        return;
      }
      this.form.setValue({
        name: tag.name,
        type: tag.type,
        destination: destinationToFormValue(tag.type, tag.destinationUrl),
      });
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
    const message = validateDestinationUrl(type, buildDestinationUrl(type, String(control.value ?? '')));
    return message ? { message } : null;
  }
}
