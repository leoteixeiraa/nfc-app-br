import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiStatusService } from '../core/api-status.service';

@Component({
  selector: 'app-home-page',
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss'
})
export class HomePage implements OnInit {
  private readonly apiStatusService = inject(ApiStatusService);

  protected readonly apiState = signal<'checking' | 'online' | 'offline'>('checking');
  protected readonly statusMessage = signal('Verificando comunicação com a API…');

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
}
