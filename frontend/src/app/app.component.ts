import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AnalyticsConsentBannerComponent } from './core/analytics/analytics-consent-banner.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterModule,
    AnalyticsConsentBannerComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  title = 'nfc.app.br | Gestão de experiências NFC';

  ngOnInit(): void {
    const savedDir = localStorage.getItem('dir');
    if (savedDir === 'rtl') {
      document.documentElement.setAttribute('dir', 'rtl');
    }
  }
}
