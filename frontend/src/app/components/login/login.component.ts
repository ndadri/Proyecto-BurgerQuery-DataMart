import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  private apiService = inject(ApiService);
  private router = inject(Router);

  role: 'admin' | 'gerente' | 'proveedor' = 'admin';
  username = '';
  password = '';

  mensajeError: string | null = null;
  cargando = false;

  setRole(selectedRole: 'admin' | 'gerente' | 'proveedor'): void {
    this.role = selectedRole;
    this.mensajeError = null;
    // Pre-llenar credenciales para fácil prueba/revisión por el usuario
    if (selectedRole === 'admin') {
      this.username = 'admin';
      this.password = 'admin123';
    } else if (selectedRole === 'gerente') {
      this.username = 'adrian_basilica';
      this.password = '1234';
    } else {
      this.username = 'proveedor';
      this.password = 'prove123';
    }
  }

  ngOnInit(): void {
    // Inicializar pre-llenado
    this.setRole('admin');
  }

  iniciarSesion(): void {
    if (!this.username || !this.password) {
      this.mensajeError = 'Por favor complete todos los campos.';
      return;
    }

    this.cargando = true;
    this.mensajeError = null;

    this.apiService.login(this.role, this.username, this.password).subscribe({
      next: (session) => {
        localStorage.setItem('bq_session', JSON.stringify(session));
        this.cargando = false;
        if (session.role === 'proveedor') {
          this.router.navigate(['/proveedor']);
        } else {
          this.router.navigate(['/']);
        }
      },
      error: (err) => {
        console.error('Error al iniciar sesión:', err);
        this.mensajeError = err.error?.message || err.error?.error || 'Error al conectar con el servidor.';
        this.cargando = false;
      }
    });
  }
}
