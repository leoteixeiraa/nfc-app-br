import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-sign-up-header',
  imports: [CommonModule],
  templateUrl: './header.component.html',
  host: {
    class: 'contents',
  },
  styles: [
    `
      :host {
        display: contents;
      }
    `,
  ],
})
export class SignUpHeaderComponent {
  @Input() title: string = 'Criar conta';
  @Input() description: string = 'Crie sua conta de forma segura com o Google.';
  @Input() className: string = '';
}
