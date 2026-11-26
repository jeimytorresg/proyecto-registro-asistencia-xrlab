import {
  ApplicationConfig,
  ErrorHandler,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, TitleStrategy } from '@angular/router';

import { routes } from './app.routes';
import { VisibleErrorHandler } from './core/errors/visible-error.handler';
import { AppTitleStrategy } from './core/title.strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(routes),
    { provide: TitleStrategy, useExisting: AppTitleStrategy },
    {
      provide: ErrorHandler,
      useClass: VisibleErrorHandler,
    },
  ],
};
