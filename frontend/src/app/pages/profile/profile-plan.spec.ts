import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthSessionStore } from '../../core/auth/auth-session.store';
import { ProfileComponent } from './profile.component';

describe('Atualização do plano no perfil', () => {
  it('reflete a alteração de Start para Pro sem trocar de conta', () => {
    TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    const session = TestBed.inject(AuthSessionStore);
    session.setUser({ id: '1', name: 'Pessoa', email: 'pessoa@example.com', pictureUrl: null });
    const profile = TestBed.createComponent(ProfileComponent);
    profile.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    const url = '/api/organizations/current/plan';
    http.expectOne(url).flush({
      code: 'FREE', name: 'Start', status: 'ACTIVE', premium: false, expiresAt: null,
    });
    profile.detectChanges();
    const avatar = profile.nativeElement.querySelector('app-premium-avatar') as HTMLElement;
    expect(avatar.classList).not.toContain('nfc-premium-avatar');

    window.dispatchEvent(new Event('focus'));
    http.expectOne(url).flush({ code: 'PRO', name: 'Pro', status: 'ACTIVE', premium: true });
    profile.detectChanges();
    expect(avatar.classList).toContain('nfc-premium-avatar');
    expect(avatar.textContent).toContain('Plano Pro');
    http.verify();
  });
});
