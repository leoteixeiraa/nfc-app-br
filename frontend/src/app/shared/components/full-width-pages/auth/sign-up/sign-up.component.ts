import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../../core/auth/auth.service';
import { googleSignInErrorMessage } from '../../../../../core/auth/google-sign-in-error';
import { SignUpHeaderComponent } from './header.component';
import { SocialButtonsComponent } from './social-button.component';

@Component({
  selector: 'app-sign-up-content',
  imports: [
    CommonModule,
    RouterModule,
    SignUpHeaderComponent,
    SocialButtonsComponent,
  ],
  templateUrl: './sign-up.component.html',
  host: {
    class: 'contents',
  },
  styles: [
    `
      :host {
        display: contents;
      }
    `,
  ],
})
export class SignUpContentComponent {
  @Input() className: string = '';
  errorMessage = '';
  isConnecting = false;

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {
    this.authService.preloadGoogleSignIn();
  }

  onProviderSelected(providerId: string): void {
    if (providerId !== 'google' || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.errorMessage = '';
    this.authService.signInWithGoogle().subscribe({
      next: () => void this.router.navigateByUrl('/'),
      error: (error: unknown) => {
        this.isConnecting = false;
        this.errorMessage = googleSignInErrorMessage(error);
      },
    });
  }
}
