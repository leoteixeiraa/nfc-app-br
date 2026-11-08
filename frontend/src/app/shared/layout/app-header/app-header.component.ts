import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
// TODO: Reativar futuramente os imports da pesquisa.
// import { ElementRef, ViewChild } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ThemeToggleButtonComponent } from '../../components/common/theme-toggle/theme-toggle-button.component';
import { NotificationDropdownComponent } from '../../components/header/notification-dropdown/notification-dropdown.component';
import { UserDropdownComponent } from '../../components/header/user-dropdown/user-dropdown.component';
import { SidebarService } from '../../services/sidebar.service';
import { BrandLogoComponent } from '../../components/common/brand-logo/brand-logo.component';

import { ButtonComponent } from '../../components/ui/button/button.component';
// TODO: Reativar futuramente a diretiva da pesquisa.
// import { InputDirective } from '../../components/ui/input/input.directive';

@Component({
  selector: 'app-header',
  imports: [BrandLogoComponent, ButtonComponent,
    // TODO: Reativar futuramente a diretiva da pesquisa.
    // InputDirective,
    CommonModule,
    RouterModule,
    ThemeToggleButtonComponent,
    NotificationDropdownComponent,
    UserDropdownComponent,
  ],
  templateUrl: './app-header.component.html',
})
export class AppHeaderComponent {
  isApplicationMenuOpen = false;
  readonly isMobileOpen$;

  // TODO: Reativar futuramente a referência da pesquisa.
  // @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  constructor(public sidebarService: SidebarService) {
    this.isMobileOpen$ = this.sidebarService.isMobileOpen$;
  }

  handleToggle() {
    if (window.innerWidth >= 1280) {
      this.sidebarService.toggleExpanded();
    } else {
      this.sidebarService.toggleMobileOpen();
    }
  }

  toggleApplicationMenu() {
    this.isApplicationMenuOpen = !this.isApplicationMenuOpen;
  }

  /* TODO: Reativar futuramente o atalho da pesquisa.
  ngAfterViewInit() {
    document.addEventListener('keydown', this.handleKeyDown);
  }

  ngOnDestroy() {
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  handleKeyDown = (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      this.searchInput?.nativeElement.focus();
    }
  };
  */
}
