import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthSessionStore } from '../../../../core/auth/auth-session.store';
import { CurrentPlanService } from '../../../../core/plans/current-plan.service';
import { UserDropdownComponent } from './user-dropdown.component';

describe('Plano do usuário no cabeçalho', () => {
  it('reflete a resposta do backend, atualização, falha e troca de conta', () => {
    TestBed.configureTestingModule({
      imports: [UserDropdownComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: { getCurrentUser: () => of(null) } },
      ],
    });
    spyOn(console, 'error');
    const session = TestBed.inject(AuthSessionStore);
    const http = TestBed.inject(HttpTestingController);
    const url = '/api/organizations/current/plan';
    const user = { id: '1', name: 'Pessoa', email: 'pessoa@example.com', pictureUrl: null };
    session.setUser(user);
    const header = TestBed.createComponent(UserDropdownComponent);
    header.detectChanges();
    const plan = TestBed.inject(CurrentPlanService);
    http.expectOne(url).flush({ code: 'FREE', name: 'Start', status: 'ACTIVE', premium: false });
    header.detectChanges();
    (header.nativeElement.querySelector('.dropdown-toggle') as HTMLButtonElement).click();
    header.detectChanges();
    expect(header.nativeElement.querySelector('app-premium-avatar').textContent).toContain('Plano Start');
    expect(header.nativeElement.querySelector('.nfc-plan-label').textContent).toContain('Plano Start');

    plan.refresh();
    http.expectOne(url).flush({ code: 'PRO', name: 'Pro', status: 'ACTIVE', premium: true });
    header.detectChanges();
    expect(header.nativeElement.querySelector('app-premium-avatar').textContent).toContain('Plano Pro');
    expect(header.nativeElement.querySelector('.nfc-plan-label').textContent).toContain('Plano Pro');

    plan.refresh();
    http.expectOne(url).flush('Erro', { status: 500, statusText: 'Erro' });
    header.detectChanges();
    expect(header.nativeElement.textContent).toContain('Plano indisponível');
    expect(header.nativeElement.textContent).not.toContain('Plano Pro');

    session.setUser({ ...user, id: '2' });
    header.detectChanges();
    http.expectOne(url).flush({ code: 'FREE', name: 'Start', status: 'ACTIVE', premium: false });
    header.detectChanges();
    expect(header.nativeElement.querySelector('.nfc-plan-label').textContent).toContain('Plano Start');
    session.clear();
    header.detectChanges();
    expect(header.nativeElement.querySelector('app-premium-avatar')).toBeNull();
    http.verify();
  });
});
