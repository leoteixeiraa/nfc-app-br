import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-sign-in-header',
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
export class SignInHeaderComponent {
  @Input() title: string = 'Entrar na NFC.APP';
  @Input() description: string = 'Acesse sua conta com o Google.';
  @Input() className: string = '';
}
