import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ApiStatusService } from '../core/api-status.service';
import { FirebaseAuthService } from '../core/firebase-auth.service';

@Component({
  selector: 'app-home-page',
  imports: [ButtonModule, CardModule, TagModule],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss'
})
export class HomePage implements OnInit {
  private readonly apiStatusService = inject(ApiStatusService);
  private readonly auth = inject(FirebaseAuthService);
  private readonly router = inject(Router);

  protected readonly userEmail = computed(() => this.auth.user()?.email ?? 'Conta conectada');
  protected readonly apiState = signal<'checking' | 'online' | 'offline'>('checking');
  protected readonly statusMessage = signal('Verificando comunicação com a API…');
  protected readonly statusLabel = computed(() => ({
    checking: 'Verificando',
    online: 'Online',
    offline: 'Indisponível'
  })[this.apiState()]);
  protected readonly statusSeverity = computed(() => ({
    checking: 'warn',
    online: 'success',
    offline: 'danger'
  })[this.apiState()] as 'warn' | 'success' | 'danger');

  ngOnInit(): void {
    this.apiStatusService.getStatus().subscribe({
      next: () => {
        this.apiState.set('online');
        this.statusMessage.set('API conectada e respondendo.');
      },
      error: (error: HttpErrorResponse) => {
        this.apiState.set('offline');
        this.statusMessage.set(error.status === 0
          ? 'Não foi possível alcançar a API.'
          : 'A API está indisponível no momento.');
      }
    });
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login');
  }
}
