import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { DashboardReport, DimProducto, DimCliente, DimSucursal, FactVenta, VentaPayload, SessionInfo, DimPersonal } from '../../models/datamart.model';
import { BillingFormComponent } from '../billing-form/billing-form.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, BillingFormComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  private apiService = inject(ApiService);
  private router = inject(Router);

  reporte: DashboardReport | null = null;
  cargando: boolean = true;
  mensajeError: string | null = null;
  mensajeInfo: string | null = null;
  sucursalSeleccionada: any | null = null;
  diaSemanaSeleccionado: number | null = null;
  horaSeleccionada: number | null = null;

  // Sesión activa
  session: SessionInfo | null = null;

  // Estado del modal de Personal
  mostrarModalPersonal = false;
  personalNombre = '';
  personalApellido = '';
  personalUsuario = '';
  personalContrasena = '';
  personalSucursalKey: number | null = null;
  personalList: DimPersonal[] = [];
  mensajeErrorPersonal: string | null = null;
  mensajeExitoPersonal: string | null = null;
  guardandoPersonal = false;

  // Catálogos para el modal
  productos: DimProducto[] = [];
  clientes: DimCliente[] = [];
  sucursales: DimSucursal[] = [];

  // Estado del modal de edición
  mostrarModalEdicion = false;
  ventaSeleccionadaParaEditar: FactVenta | null = null;
  mensajeErrorModal: string | null = null;
  guardandoEdicion = false;

  // Campos de edición
  editProductoKey: number | null = null;
  editClienteKey: number | null = null;
  editSucursalKey: number | null = null;
  editCantidad: number = 1;
  editDescuento: number = 0.00;
  editFecha: string = '';
  editHora: number = 12;

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
    const sessionStr = localStorage.getItem('bq_session');
    if (!sessionStr) {
      this.router.navigate(['/login']);
      return;
    }
    try {
      this.session = JSON.parse(sessionStr) as SessionInfo;
    } catch {
      this.router.navigate(['/login']);
      return;
    }

    this.cargarDimensiones();
    this.cargarDatos();

    if (this.session && this.session.role === 'admin') {
      this.cargarPersonal();
    }
  }

  cargarDimensiones(): void {
    const sucursalKey = (this.session && this.session.role === 'vendedor') ? (this.session.sucursalKey || undefined) : undefined;
    
    this.apiService.getProductos(sucursalKey).subscribe({
      next: (data) => this.productos = data,
      error: (err) => console.error('Error al cargar productos:', err)
    });

    this.apiService.getClientes().subscribe({
      next: (data) => this.clientes = data,
      error: (err) => console.error('Error al cargar clientes:', err)
    });

    this.apiService.getSucursales().subscribe({
      next: (data) => {
        this.sucursales = data;
        // Si es vendedor, autoseleccionar su sucursal de la lista
        if (this.session && this.session.role === 'vendedor') {
          this.sucursalSeleccionada = this.sucursales.find(s => s.SucursalKey === this.session?.sucursalKey) || null;
        }
      },
      error: (err) => console.error('Error al cargar sucursales:', err)
    });
  }

  abrirModalEdicion(venta: FactVenta): void {
    this.ventaSeleccionadaParaEditar = venta;
    this.editProductoKey = venta.ProductoKey;
    this.editClienteKey = venta.ClienteKey;
    this.editSucursalKey = venta.SucursalKey;
    this.editCantidad = venta.Cantidad;
    this.editDescuento = venta.Descuento;
    this.editFecha = venta.Tiempo?.Fecha ? venta.Tiempo.Fecha.split('T')[0] : '';
    this.editHora = venta.Hora || 12;
    this.mensajeErrorModal = null;
    
    // Cargar productos con el stock de la sucursal de la venta
    this.apiService.getProductos(venta.SucursalKey).subscribe({
      next: (data) => {
        this.productos = data;
        this.mostrarModalEdicion = true;
      },
      error: (err) => {
        console.error('Error al cargar productos:', err);
        this.mostrarModalEdicion = true;
      }
    });
  }

  cerrarModalEdicion(): void {
    this.mostrarModalEdicion = false;
    this.ventaSeleccionadaParaEditar = null;
    this.mensajeErrorModal = null;
    this.cargarDimensiones(); // Restablecer catálogo de productos con stock global
  }

  onEditSucursalChange(): void {
    if (this.editSucursalKey) {
      this.apiService.getProductos(Number(this.editSucursalKey)).subscribe({
        next: (data) => this.productos = data,
        error: (err) => console.error('Error al cargar productos para edición:', err)
      });
    }
  }

  guardarEdicion(): void {
    if (!this.ventaSeleccionadaParaEditar) return;
    if (!this.editProductoKey || !this.editClienteKey || !this.editSucursalKey || this.editCantidad <= 0 || !this.editFecha) {
      this.mensajeErrorModal = 'Por favor complete todos los campos obligatorios con valores correctos.';
      return;
    }

    this.guardandoEdicion = true;
    this.mensajeErrorModal = null;

    const payload: VentaPayload = {
      ProductoKey: Number(this.editProductoKey),
      ClienteKey: Number(this.editClienteKey),
      SucursalKey: Number(this.editSucursalKey),
      Cantidad: this.editCantidad,
      Descuento: this.editDescuento,
      Fecha: this.editFecha,
      Hora: Number(this.editHora)
    };

    this.apiService.editarVenta(this.ventaSeleccionadaParaEditar.VentaID, payload).subscribe({
      next: (res) => {
        this.guardandoEdicion = false;
        this.cerrarModalEdicion();
        this.cargarDatos(); // Actualizar panel analítico
      },
      error: (err) => {
        console.error('Error al editar venta:', err);
        this.mensajeErrorModal = err.error?.message || err.error?.error || 'Error al actualizar la venta.';
        this.guardandoEdicion = false;
      }
    });
  }

  get editProductoSeleccionado(): DimProducto | undefined {
    return this.productos.find(p => p.ProductoKey === Number(this.editProductoKey));
  }

  get editSubtotal(): number {
    const prod = this.editProductoSeleccionado;
    return prod ? prod.PrecioUnitario * this.editCantidad : 0;
  }

  get editTotal(): number {
    const totalCalc = this.editSubtotal - this.editDescuento;
    return totalCalc > 0 ? totalCalc : 0;
  }

  cargarDatos(): void {
    this.cargando = true;
    this.mensajeError = null;

    // Si es vendedor, forzar la sucursal asignada
    let sucursalKey = this.sucursalSeleccionada?.SucursalKey;
    if (this.session && this.session.role === 'vendedor') {
      sucursalKey = this.session.sucursalKey || undefined;
    }

    const diaSemana = this.diaSemanaSeleccionado !== null ? this.diaSemanaSeleccionado : undefined;
    const hora = this.horaSeleccionada !== null ? this.horaSeleccionada : undefined;

    this.apiService.getReporteOlap(sucursalKey, diaSemana, hora).subscribe({
      next: (data) => {
        this.reporte = data;
        this.cargando = false;
        
        // Asegurar sucursal seleccionada para la UI del vendedor
        if (this.session && this.session.role === 'vendedor' && !this.sucursalSeleccionada && this.sucursales.length > 0) {
          this.sucursalSeleccionada = this.sucursales.find(s => s.SucursalKey === this.session?.sucursalKey) || null;
        }
      },
      error: (err) => {
        console.error('Error al cargar reporte:', err);
        this.mensajeError = 'No se pudo obtener datos del Data Mart. Verifique que la base de datos esté activa y las tablas creadas.';
        this.cargando = false;
      }
    });
  }

  seleccionarSucursal(sucursal: any): void {
    if (this.session && this.session.role === 'vendedor') {
      // El vendedor tiene bloqueado el filtrado de sucursales
      return;
    }
    if (this.sucursalSeleccionada?.SucursalKey === sucursal.SucursalKey) {
      this.sucursalSeleccionada = null;
      this.cargarDatos();
    } else {
      this.sucursalSeleccionada = sucursal;
      this.cargarDatos();
    }
  }

  seleccionarDiaSemana(diaKey: number): void {
    if (this.diaSemanaSeleccionado === diaKey && this.horaSeleccionada === null) {
      this.limpiarFiltroTemporal();
    } else {
      this.diaSemanaSeleccionado = diaKey;
      this.horaSeleccionada = null;
      this.cargarDatos();
    }
  }

  seleccionarCeldaHeatmap(diaKey: number, hora: number): void {
    if (this.diaSemanaSeleccionado === diaKey && this.horaSeleccionada === hora) {
      this.limpiarFiltroTemporal();
    } else {
      this.diaSemanaSeleccionado = diaKey;
      this.horaSeleccionada = hora;
      this.cargarDatos();
    }
  }

  limpiarFiltroTemporal(): void {
    this.diaSemanaSeleccionado = null;
    this.horaSeleccionada = null;
    this.cargarDatos();
  }

  limpiarFiltro(): void {
    this.sucursalSeleccionada = null;
    this.diaSemanaSeleccionado = null;
    this.horaSeleccionada = null;
    this.cargarDatos();
  }

  obtenerNombreDia(key: number): string {
    const dia = this.diasSemana.find(d => d.key === key);
    return dia ? dia.label : 'Día';
  }

  // Métodos de Creación de Personal
  abrirModalPersonal(): void {
    this.personalNombre = '';
    this.personalApellido = '';
    this.personalUsuario = '';
    this.personalContrasena = '';
    this.personalSucursalKey = null;
    this.mensajeErrorPersonal = null;
    this.mensajeExitoPersonal = null;
    this.mostrarModalPersonal = true;
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
        this.cargarPersonal();
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

  cargarPersonal(): void {
    this.apiService.getPersonal().subscribe({
      next: (data) => this.personalList = data,
      error: (err) => console.error('Error al obtener personal:', err)
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
