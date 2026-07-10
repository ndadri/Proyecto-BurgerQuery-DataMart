import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { LoginComponent } from './components/login/login.component';
import { ProveedorComponent } from './components/proveedor/proveedor.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'proveedor', component: ProveedorComponent },
  { path: '', component: DashboardComponent },
  { path: '**', redirectTo: '' }
];
