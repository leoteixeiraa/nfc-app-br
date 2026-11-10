import { provideAppInitializer, inject, EnvironmentProviders } from '@angular/core';
import { AnalyticsService } from './analytics.service';

export function provideAnalytics(): EnvironmentProviders {
  return provideAppInitializer(() => inject(AnalyticsService).init());
}
