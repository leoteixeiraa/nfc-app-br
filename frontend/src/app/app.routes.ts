import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
	{
		path: 'login',
		loadComponent: () => import('./auth/login-page').then((module) => module.LoginPage),
		title: 'Entrar | NFC.APP'
	},
	{
		path: '',
		loadComponent: () => import('./home/home-page').then((module) => module.HomePage),
		canActivate: [authGuard],
		title: 'NFC.APP'
	},
	{ path: '**', redirectTo: '' }
];
