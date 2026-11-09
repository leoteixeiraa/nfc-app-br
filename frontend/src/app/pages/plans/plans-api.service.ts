import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CurrentPlan, Plan } from './plan.models';

@Injectable({ providedIn: 'root' })
export class PlansApiService {
  private readonly http = inject(HttpClient);

  list(): Observable<Plan[]> {
    return this.http.get<Plan[]>('/api/plans');
  }

  current(): Observable<CurrentPlan> {
    return this.http.get<CurrentPlan>('/api/organizations/current/plan');
  }
}
