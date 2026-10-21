import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiStatusService } from './api-status.service';

describe('ApiStatusService', () => {
  let service: ApiStatusService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ApiStatusService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests the public status using a relative API path', () => {
    service.getStatus().subscribe((response) => expect(response.status).toBe('UP'));
    const request = http.expectOne('/api/status');
    expect(request.request.method).toBe('GET');
    request.flush({ status: 'UP', application: 'NFC.APP' });
  });
});
