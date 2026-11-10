import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { AuthSessionStore } from '../../core/auth/auth-session.store';
import { CurrentPlanService } from '../../core/plans/current-plan.service';
import { SidebarService } from '../services/sidebar.service';
import { AppHeaderComponent } from './app-header/app-header.component';
import { AppSidebarComponent } from './app-sidebar/app-sidebar.component';

describe('Navegação do MVP', () => {
  const user = signal<{ name: string; email: string } | null>({ name: 'Usuário', email: 'usuario@example.com' });
  beforeEach(async () => {
    user.set({ name: 'Usuário', email: 'usuario@example.com' });
    await TestBed.configureTestingModule({
      imports: [AppHeaderComponent, AppSidebarComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { getCurrentUser: () => of(null) } },
        { provide: AuthSessionStore, useValue: { currentUser: user } },
        { provide: CurrentPlanService, useValue: { isPremium: signal(false), label: signal(null), isLoading: signal(false) } },
      ],
    }).compileComponents();
  });

  it('exibe apenas as entradas do MVP no menu lateral', () => {
    const fixture = TestBed.createComponent(AppSidebarComponent);
    fixture.detectChanges();

    const links = Array.from(fixture.nativeElement.querySelectorAll('nav a')) as HTMLAnchorElement[];
    expect(links.map(link => [link.textContent?.trim(), link.getAttribute('href')])).toEqual([
      ['Dashboard', '/'],
      ['Minhas placas', '/tags'],
      ['Clientes', '/clientes'],
      ['Planos e assinatura', '/plans'],
    ]);
    expect(fixture.nativeElement.textContent).not.toContain('Others');
  });

  it('mantém a navegação mobile e fecha o menu após selecionar uma entrada', () => {
    spyOnProperty(window, 'innerWidth', 'get').and.returnValue(375);
    const header = TestBed.createComponent(AppHeaderComponent);
    const sidebar = TestBed.createComponent(AppSidebarComponent);
    header.detectChanges();
    sidebar.detectChanges();

    const service = TestBed.inject(SidebarService);
    let mobileOpen = false;
    const subscription = service.isMobileOpen$.subscribe(value => mobileOpen = value);
    (header.nativeElement.querySelector('[aria-label="Toggle Sidebar"]') as HTMLButtonElement).click();
    sidebar.detectChanges();
    expect(mobileOpen).toBeTrue();
    expect(sidebar.nativeElement.querySelector('aside').classList).toContain('translate-x-0');
    (sidebar.nativeElement.querySelector('nav a[href="/clientes"]') as HTMLAnchorElement).click();
    expect(mobileOpen).toBeFalse();
    subscription.unsubscribe();
  });

  it('preserva o perfil e o tema no header sem pesquisa nem captura do atalho', () => {
    const fixture = TestBed.createComponent(AppHeaderComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('input')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-theme-toggle-button')).not.toBeNull();
    const shortcut = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true });
    document.dispatchEvent(shortcut);
    expect(shortcut.defaultPrevented).toBeFalse();

    (fixture.nativeElement.querySelector('.dropdown-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-user-dropdown a[href="/profile"]')).not.toBeNull();
  });

  it('oferece entrada e criação de conta para visitantes', () => {
    user.set(null);
    const fixture = TestBed.createComponent(AppHeaderComponent);
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('app-user-dropdown a[href="/signin"]') as HTMLAnchorElement;
    expect(link.textContent).toContain('Entrar / Criar conta');
  });

  it('mantém o menu de usuário acessível ao abrir o menu mobile', () => {
    spyOnProperty(window, 'innerWidth', 'get').and.returnValue(375);
    const fixture = TestBed.createComponent(AppHeaderComponent);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[aria-label="Toggle application menu"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const dropdown = fixture.nativeElement.querySelector('app-user-dropdown') as HTMLElement;
    expect(dropdown.parentElement?.classList).toContain('flex');
    (dropdown.querySelector('.dropdown-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(dropdown.querySelector('a[href="/profile"]')).not.toBeNull();
  });
});
