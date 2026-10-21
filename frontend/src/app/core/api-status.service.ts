import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface ApiStatus {
  status: 'UP';
  application: string;
}

@Injectable({ providedIn: 'root' })
export class ApiStatusService {
  private readonly http = inject(HttpClient);

  getStatus(): Observable<ApiStatus> {
    return this.http.get<ApiStatus>('/api/status');
  }
}
