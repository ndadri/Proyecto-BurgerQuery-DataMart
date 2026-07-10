import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterOutlet, Router } from '@angular/router';
import { ApiService } from './services/api.service';
import { SessionInfo, DimSucursal } from './models/datamart.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  private router = inject(Router);
  private apiService = inject(ApiService);

  sucursales: DimSucursal[] = [];

  // Modal de Personal
  mostrarModalPersonal = false;
  personalNombre = '';
  personalApellido = '';
  personalUsuario = '';
  personalContrasena = '';
  personalSucursalKey: number | null = null;
  mensajeErrorPersonal: string | null = null;
  mensajeExitoPersonal: string | null = null;
  guardandoPersonal = false;

  ngOnInit(): void {
    if (this.isLoggedIn()) {
      this.cargarSucursales();
    }
  }

  cargarSucursales(): void {
    this.apiService.getSucursales().subscribe({
      next: (data) => this.sucursales = data,
      error: (err) => console.error('Error al cargar sucursales:', err)
    });
  }

  isLoggedIn(): boolean {
    return localStorage.getItem('bq_session') !== null;
  }

  getSession(): SessionInfo | null {
    const sessionStr = localStorage.getItem('bq_session');
    if (!sessionStr) return null;
    try {
      return JSON.parse(sessionStr) as SessionInfo;
    } catch {
      return null;
    }
  }

  getSessionName(): string {
    const s = this.getSession();
    if (!s) return '';
    if (s.role === 'admin') {
      return 'Administrador';
    }
    return `${s.name} (${s.nombreSucursal})`;
  }

  logout(): void {
    localStorage.removeItem('bq_session');
    this.router.navigate(['/login']);
  }

  abrirModalPersonal(): void {
    this.personalNombre = '';
    this.personalApellido = '';
    this.personalUsuario = '';
    this.personalContrasena = '';
    this.personalSucursalKey = null;
    this.mensajeErrorPersonal = null;
    this.mensajeExitoPersonal = null;
    this.mostrarModalPersonal = true;
    this.cargarSucursales();
  }

  cerrarModalPersonal(): void {
    this.mostrarModalPersonal = false;
  }

  crearPersonalSubmit(): void {
    if (!this.personalNombre || !this.personalApellido || !this.personalUsuario || !this.personalContrasena || !this.personalSucursalKey) {
      this.mensajeErrorPersonal = 'Por favor complete todos los campos obligatorios.';
      return;
    }
    this.guardandoPersonal = true;
    this.mensajeErrorPersonal = null;
    this.mensajeExitoPersonal = null;

    const payload = {
      Nombre: this.personalNombre,
      Apellido: this.personalApellido,
      Usuario: this.personalUsuario,
      Contrasena: this.personalContrasena,
      SucursalKey: Number(this.personalSucursalKey)
    };

    this.apiService.crearPersonal(payload).subscribe({
      next: (res) => {
        this.mensajeExitoPersonal = res.message || 'Personal de ventas creado correctamente.';
        this.guardandoPersonal = false;
        setTimeout(() => {
          this.cerrarModalPersonal();
        }, 1500);
      },
      error: (err) => {
        this.mensajeErrorPersonal = err.error?.message || err.error?.error || 'Error al registrar personal.';
        this.guardandoPersonal = false;
      }
    });
  }
}
