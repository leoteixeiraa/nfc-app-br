import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { FirebaseAuthService } from '../core/firebase-auth.service';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule, RouterLink, ButtonModule, InputTextModule, PasswordModule],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss'
})
export class LoginPage {
  private readonly auth = inject(FirebaseAuthService);
  private readonly router = inject(Router);

  protected email = '';
  protected password = '';
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly isConfigured = this.auth.isConfigured;

  protected async submit(): Promise<void> {
    await this.authenticate(() => this.auth.signIn(this.email.trim(), this.password));
  }

  protected async submitWithGoogle(): Promise<void> {
    await this.authenticate(() => this.auth.signInWithGoogle());
  }

  private async authenticate(signIn: () => Promise<void>): Promise<void> {
    this.errorMessage.set('');
    if (!this.isConfigured) {
      this.errorMessage.set('Configure as variáveis Firebase no .env e recrie o container frontend.');
      return;
    }

    this.isSubmitting.set(true);
    try {
      await signIn();
      await this.router.navigateByUrl('/');
    } catch (error) {
      this.errorMessage.set(this.getErrorMessage(error));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private getErrorMessage(error: unknown): string {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return 'Não foi possível entrar. Tente novamente.';
    }

    switch (error.code) {
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'E-mail ou senha incorretos.';
      case 'auth/invalid-email':
        return 'Informe um endereço de e-mail válido.';
      case 'auth/too-many-requests':
        return 'Muitas tentativas. Aguarde um pouco e tente novamente.';
      case 'auth/network-request-failed':
        return 'Falha de conexão. Verifique sua internet e tente novamente.';
      case 'auth/operation-not-allowed':
        return 'Este método de login não está habilitado no Firebase.';
      case 'auth/popup-closed-by-user':
        return 'A janela de autenticação foi fechada antes da conclusão.';
      case 'auth/popup-blocked':
        return 'O navegador bloqueou a janela de login. Permita pop-ups e tente novamente.';
      case 'auth/cancelled-popup-request':
        return 'Já existe uma janela de autenticação aberta.';
      case 'auth/unauthorized-domain':
        return 'Este domínio não está autorizado para login no Firebase.';
      case 'auth/account-exists-with-different-credential':
        return 'Já existe uma conta com este e-mail usando outro método de login.';
      default:
        return 'Não foi possível entrar. Verifique sua conta e tente novamente.';
    }
  }
}