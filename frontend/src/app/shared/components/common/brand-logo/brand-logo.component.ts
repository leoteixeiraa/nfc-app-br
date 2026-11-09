import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-brand-logo',
  templateUrl: './brand-logo.component.html',
  styleUrl: './brand-logo.component.css',
})
export class BrandLogoComponent {
  @Input() compact = false;
  @Input() light = false;
}
