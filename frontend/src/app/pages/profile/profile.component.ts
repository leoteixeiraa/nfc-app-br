import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { PageBreadcrumbComponent } from '../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { AuthSessionStore } from '../../core/auth/auth-session.store';

// Componentes originais do template, preservados para uso futuro:
// import { AddressComponent } from './address';
// import { DangerComponent } from './danger';
// import { PersonalInformationComponent } from './personal-information';
// import { SecurityComponent } from './security';

@Component({
  selector: 'app-profile',
  // Componentes antigos retirados do imports enquanto a página é somente leitura:
  /*
  imports: [
    CommonModule,
    PageBreadcrumbComponent,
    PersonalInformationComponent,
    AddressComponent,
    SecurityComponent,
    DangerComponent,
  ],
  */
  imports: [CommonModule, PageBreadcrumbComponent],
  host: {
    class: 'block',
  },
  templateUrl: './profile.component.html',
  styles: ``,
})
export class ProfileComponent {
  constructor(public readonly sessionStore: AuthSessionStore) {}
}
