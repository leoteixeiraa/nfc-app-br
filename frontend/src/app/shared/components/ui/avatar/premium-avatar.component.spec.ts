import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthSessionStore } from '../../../../core/auth/auth-session.store';
import { CurrentPlanService } from '../../../../core/plans/current-plan.service';
import { ProfileComponent } from '../../../../pages/profile/profile.component';
import { UserDropdownComponent } from '../../header/user-dropdown/user-dropdown.component';

describe('Avatar por plano no cabeçalho e perfil', () => {
  const label = signal<'Start' | 'Pro' | null>('Start');
  const isPremium = computed(() => label() === 'Pro');
  const user = signal<{ id: string; name: string; email: string; pictureUrl: string | null } | null>(null);

  beforeEach(async () => {
    label.set('Start');
    user.set({ id: '1', name: 'Pessoa', email: 'pessoa@example.com', pictureUrl: null });
    await TestBed.configureTestingModule({
      imports: [UserDropdownComponent, ProfileComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { getCurrentUser: () => of(null) } },
        { provide: AuthSessionStore, useValue: { currentUser: user } },
        { provide: CurrentPlanService, useValue: { isPremium, label, isLoading: signal(false) } },
      ],
    }).compileComponents();
  });

  it('identifica Start e Pro no avatar e no menu sem alterar a foto', () => {
    const header = TestBed.createComponent(UserDropdownComponent);
    const profile = TestBed.createComponent(ProfileComponent);
    header.detectChanges();
    profile.detectChanges();

    const headerAvatar = header.nativeElement.querySelector('app-premium-avatar') as HTMLElement;
    const profileAvatar = profile.nativeElement.querySelector('app-premium-avatar') as HTMLElement;
    for (const avatar of [headerAvatar, profileAvatar]) {
      expect(avatar.classList).not.toContain('nfc-premium-avatar');
      expect(avatar.classList).toContain('nfc-free-avatar');
      expect(avatar.textContent).toContain('Plano Start');
    }
    expect(headerAvatar.querySelector('span')?.classList).toContain('rounded-full');
    expect(profileAvatar.textContent).toContain('P');

    (header.nativeElement.querySelector('.dropdown-toggle') as HTMLButtonElement).click();
    header.detectChanges();
    expect(header.nativeElement.querySelector('.nfc-plan-label')?.textContent).toContain('Plano Start');

    label.set('Pro');
    header.detectChanges();
    profile.detectChanges();
    for (const avatar of [headerAvatar, profileAvatar]) {
      expect(avatar.classList).toContain('nfc-premium-avatar');
      expect(avatar.textContent).toContain('Plano Pro');
      expect(avatar.querySelector('.nfc-premium-avatar__badge')?.textContent).toContain('Pro');
    }
    expect(headerAvatar.querySelector('span')?.classList).toContain('rounded-full');
    expect(header.nativeElement.querySelector('.nfc-plan-label')?.textContent).toContain('Plano Pro');

    label.set(null);
    header.detectChanges();
    profile.detectChanges();
    expect(headerAvatar.classList).not.toContain('nfc-premium-avatar');
    expect(profileAvatar.classList).not.toContain('nfc-premium-avatar');
    expect(headerAvatar.querySelector('.nfc-premium-avatar__badge')).toBeNull();
    expect(header.nativeElement.textContent).toContain('Plano indisponível');
  });

  it('mantém a foto e seu texto alternativo no perfil Pro', () => {
    label.set('Pro');
    user.set({ id: '1', name: 'Pessoa', email: 'pessoa@example.com', pictureUrl: 'https://example.com/avatar.png' });
    const profile = TestBed.createComponent(ProfileComponent);
    profile.detectChanges();
    const image = profile.nativeElement.querySelector('app-premium-avatar img') as HTMLImageElement;
    expect(image.getAttribute('alt')).toBe('Foto de perfil de Pessoa');
    expect(image.getAttribute('referrerpolicy')).toBe('no-referrer');
  });

  it('mantém as proporções e adapta o acabamento ao tema escuro', () => {
    label.set('Pro');
    const header = TestBed.createComponent(UserDropdownComponent);
    header.detectChanges();
    const headerAvatar = header.nativeElement.querySelector('app-premium-avatar') as HTMLElement;
    expect(headerAvatar.getBoundingClientRect().width).toBe(44);

    const profile = TestBed.createComponent(ProfileComponent);
    profile.detectChanges();
    const profileAvatar = profile.nativeElement.querySelector('app-premium-avatar') as HTMLElement;
    const badge = profileAvatar.querySelector('.nfc-premium-avatar__badge') as HTMLElement;
    const root = document.documentElement;
    const wasDark = root.classList.contains('dark');
    try {
      root.classList.remove('dark');
      expect(profileAvatar.getBoundingClientRect().width).toBe(64);
      const lightShadow = getComputedStyle(profileAvatar).boxShadow;
      const lightBorder = getComputedStyle(badge).borderColor;
      root.classList.add('dark');
      expect(getComputedStyle(profileAvatar).boxShadow).not.toBe(lightShadow);
      expect(getComputedStyle(badge).borderColor).not.toBe(lightBorder);
    } finally {
      root.classList.toggle('dark', wasDark);
    }
  });
});
