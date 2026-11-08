import { Routes } from '@angular/router';
import { TagsDashboardComponent } from './pages/tags/tags-dashboard/tags-dashboard.component';
import { TagFormComponent } from './pages/tags/tag-form/tag-form.component';
import { TagWriteComponent } from './pages/tags/tag-write/tag-write.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { FormElementsComponent } from './pages/forms/form-elements/form-elements.component';
import { BasicTablesComponent } from './pages/tables/basic-tables/basic-tables.component';
import { BlankComponent } from './pages/blank/blank.component';
import { NotFoundComponent } from './pages/other-page/not-found/not-found.component';
import { AppLayoutComponent } from './shared/layout/app-layout/app-layout.component';
import { InvoiceComponent } from './pages/ecommerce/invoice/invoice.component';
import { LineChartComponent } from './pages/charts/line-chart/line-chart.component';
import { BarChartComponent } from './pages/charts/bar-chart/bar-chart.component';
import { AlertsComponent } from './pages/ui-elements/alerts/alerts.component';
import { AvatarElementComponent } from './pages/ui-elements/avatars/avatars.component';
import { BadgesComponent } from './pages/ui-elements/badge/badge.component';
import { ButtonsComponent } from './pages/ui-elements/buttons/buttons.component';
import { ImagesComponent } from './pages/ui-elements/images/images.component';
import { VideosComponent } from './pages/ui-elements/videos/videos.component';
import { SignInComponent } from './pages/auth-pages/sign-in/sign-in.component';
import { SignUpComponent } from './pages/auth-pages/sign-up/sign-up.component';
import { CalendarComponent } from './pages/calendar/calendar.component';
import { authGuard, guestGuard } from './core/auth/auth.guard';
import { ClientsComponent } from './pages/clients/clients.component';
import { ClientDetailComponent } from './pages/clients/client-detail.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';

export const routes: Routes = [
  {
    path:'',
    component:AppLayoutComponent,
    children:[
      {
        path: '',
        component: DashboardComponent,
        pathMatch: 'full',
        title: 'Dashboard | NFC.APP',
      },
      {
        path: 'tags',
        component: TagsDashboardComponent,
        title: 'Minhas placas | NFC.APP',
      },
      {
        path: 'tags/new',
        component: TagFormComponent,
        title: 'Nova placa | NFC.APP',
      },
      {
        path: 'tags/:id/write',
        component: TagWriteComponent,
        title: 'Gravar placa | NFC.APP',
      },
      {
        path: 'tags/:id/edit',
        component: TagFormComponent,
        title: 'Editar placa | NFC.APP',
      },
      {
        path: 'clientes',
        component: ClientsComponent,
        title: 'Clientes | NFC.APP',
      },
      {
        path: 'clientes/:placeId',
        component: ClientDetailComponent,
        title: 'Detalhes do cliente | NFC.APP',
      },
      {
        path: '',
        canActivateChild: [authGuard],
        children: [
      {
        path:'calendar',
        component:CalendarComponent,
        title:'Angular Calender | TailAdmin - Angular Admin Dashboard Template'
      },
      {
        path:'profile',
        component:ProfileComponent,
        title:'Angular Profile Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      {
        path:'form-elements',
        component:FormElementsComponent,
        title:'Angular Form Elements Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      {
        path:'basic-tables',
        component:BasicTablesComponent,
        title:'Angular Basic Tables Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      {
        path:'blank',
        component:BlankComponent,
        title:'Angular Blank Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      // support tickets
      {
        path:'invoice',
        component:InvoiceComponent,
        title:'Angular Invoice Details Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      {
        path:'line-chart',
        component:LineChartComponent,
        title:'Angular Line Chart Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      {
        path:'bar-chart',
        component:BarChartComponent,
        title:'Angular Bar Chart Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      {
        path:'alerts',
        component:AlertsComponent,
        title:'Angular Alerts Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      {
        path:'avatars',
        component:AvatarElementComponent,
        title:'Angular Avatars Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      {
        path:'badge',
        component:BadgesComponent,
        title:'Angular Badges Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      {
        path:'buttons',
        component:ButtonsComponent,
        title:'Angular Buttons Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      {
        path:'images',
        component:ImagesComponent,
        title:'Angular Images Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
      {
        path:'videos',
        component:VideosComponent,
        title:'Angular Videos Dashboard | TailAdmin - Angular Admin Dashboard Template'
      },
        ]
      },
    ]
  },
  // auth pages
  {
    path:'signin',
    component:SignInComponent,
    canActivate: [guestGuard],
    title:'Angular Sign In Dashboard | TailAdmin - Angular Admin Dashboard Template'
  },
  {
    path:'signup',
    component:SignUpComponent,
    canActivate: [guestGuard],
    title:'Angular Sign Up Dashboard | TailAdmin - Angular Admin Dashboard Template'
  },
  // error pages
  {
    path:'**',
    component:NotFoundComponent,
    title:'Angular NotFound Dashboard | TailAdmin - Angular Admin Dashboard Template'
  },
];
