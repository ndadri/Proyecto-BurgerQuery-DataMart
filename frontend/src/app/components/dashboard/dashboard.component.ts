import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { DashboardReport } from '../../models/datamart.model';
import { BillingFormComponent } from '../billing-form/billing-form.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, BillingFormComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  private apiService = inject(ApiService);

  reporte: DashboardReport | null = null;
  cargando: boolean = true;
  mensajeError: string | null = null;
  mensajeInfo: string | null = null;

  diasSemana = [
    { key: 1, label: 'Lun' },
    { key: 2, label: 'Mar' },
    { key: 3, label: 'Mié' },
    { key: 4, label: 'Jue' },
    { key: 5, label: 'Vie' },
    { key: 6, label: 'Sáb' },
    { key: 7, label: 'Dom' }
  ];

  horasDia = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

  obtenerVentasCelda(dia: number, hora: number): number {
    if (!this.reporte || !this.reporte.ventas_hora) return 0;
    const celda = this.reporte.ventas_hora.find(v => v.dia_semana === dia && v.hora === hora);
    return celda ? celda.cantidad : 0;
  }

  obtenerColorCelda(dia: number, hora: number): string {
    const cantidad = this.obtenerVentasCelda(dia, hora);
    if (cantidad === 0) return 'rgba(255, 255, 255, 0.02)';
    
    let maxVentas = 1;
    if (this.reporte && this.reporte.ventas_hora && this.reporte.ventas_hora.length > 0) {
      maxVentas = Math.max(...this.reporte.ventas_hora.map(v => v.cantidad), 1);
    }
    
    const ratio = cantidad / maxVentas;
    // Usamos el tono primario amarillo/naranja con opacidad escalada
    const opacity = 0.2 + (ratio * 0.8); 
    return `rgba(245, 158, 11, ${opacity})`;
  }


  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.cargando = true;
    this.mensajeError = null;
    this.apiService.getReporteOlap().subscribe({
      next: (data) => {
        this.reporte = data;
        this.cargando = false;
      },
      error: (err) => {
        console.error('Error al cargar reporte:', err);
        // Si hay un error, puede ser porque las tablas no existen todavía.
        this.mensajeError = 'No se pudo obtener datos del Data Mart. Verifique que la base de datos esté activa y las tablas creadas.';
        this.cargando = false;
      }
    });
  }

  inicializarBaseDeDatos(): void {
    this.cargando = true;
    this.apiService.inicializarDb().subscribe({
      next: (res) => {
        this.mensajeInfo = res.message || 'Base de datos inicializada correctamente. Recargando...';
        setTimeout(() => {
          this.mensajeInfo = null;
          this.cargarDatos();
        }, 2000);
      },
      error: (err) => {
        this.mensajeError = 'Error al crear tablas en PostgreSQL: ' + (err.error?.message || err.message);
        this.cargando = false;
      }
    });
  }
}
