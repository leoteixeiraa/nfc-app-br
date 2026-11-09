import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../../core/auth/auth.service';
import { googleSignInErrorMessage } from '../../../../../core/auth/google-sign-in-error';
import { SignInHeaderComponent } from './header.component';
import { SocialButtonsComponent } from './social-button.component';

@Component({
  selector: 'app-sign-in-content',
  imports: [
    CommonModule,
    RouterModule,
    SignInHeaderComponent,
    SocialButtonsComponent,
  ],
  templateUrl: './sign-in.component.html',
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
export class SignInContentComponent implements OnInit {
  @Input() className: string = '';
  errorMessage = '';
  isConnecting = false;

  constructor(
    private readonly authService: AuthService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {
    this.authService.preloadGoogleSignIn();
  }

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.has('error')) {
      this.errorMessage = 'Não foi possível entrar com o Google. Tente novamente.';
    } else if (this.route.snapshot.queryParamMap.has('expired')) {
      this.errorMessage = 'Sua sessão expirou. Entre novamente com o Google.';
    }
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
