import { HttpErrorResponse } from '@angular/common/http';

export function googleSignInErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 409) {
      return 'Este e-mail já está vinculado a outra conta Google.';
    }
    if (error.status === 401) {
      return 'Não foi possível validar sua conta Google. Tente novamente.';
    }
  }

  const code = (error as { code?: string } | null)?.code;
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'O acesso com o Google foi cancelado.';
  }
  if (code === 'auth/popup-blocked') {
    return 'O navegador bloqueou a janela do Google. Libere pop-ups e tente novamente.';
  }
  return 'Não foi possível entrar com o Google. Tente novamente.';
}
