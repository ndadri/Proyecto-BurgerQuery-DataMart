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
  categoriaSeleccionada: string | null = null;
  vistaGrafico: boolean = true;
  ventaSeleccionadaId: number | null = null;
  fechaSeleccionada: string | null = null;
  clienteSeleccionado: any | null = null;
  productoSeleccionado: any | null = null;
  puntoHovered: any | null = null;
  fechaInicioSeleccionada: string | null = null;
  fechaFinSeleccionada: string | null = null;
  stocksExpiring: any[] = [];

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

  // Estado del modal de facturación rápida
  mostrarModalFacturacion = false;

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
    const sucursalKey = (this.session && this.session.role === 'gerente') ? (this.session.sucursalKey || undefined) : undefined;
    
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
        // Si es gerente, autoseleccionar su sucursal de la lista
        if (this.session && this.session.role === 'gerente') {
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

    // Si es gerente, forzar la sucursal asignada
    let sucursalKey = this.sucursalSeleccionada?.SucursalKey;
    if (this.session && this.session.role === 'gerente') {
      sucursalKey = this.session.sucursalKey || undefined;
    }

    const diaSemana = this.diaSemanaSeleccionado !== null ? this.diaSemanaSeleccionado : undefined;
    const hora = this.horaSeleccionada !== null ? this.horaSeleccionada : undefined;
    const categoria = this.categoriaSeleccionada !== null ? this.categoriaSeleccionada : undefined;
    const fecha = this.fechaSeleccionada !== null ? this.fechaSeleccionada : undefined;
    const productoKey = this.productoSeleccionado ? this.productoSeleccionado.ProductoKey : undefined;
    const clienteKey = this.clienteSeleccionado ? this.clienteSeleccionado.ClienteKey : undefined;
    const ventaId = this.ventaSeleccionadaId !== null ? this.ventaSeleccionadaId : undefined;
    const fechaInicio = this.fechaInicioSeleccionada !== null ? this.fechaInicioSeleccionada : undefined;
    const fechaFin = this.fechaFinSeleccionada !== null ? this.fechaFinSeleccionada : undefined;

    this.apiService.getReporteOlap(
      sucursalKey,
      diaSemana,
      hora,
      categoria,
      fecha,
      productoKey,
      clienteKey,
      ventaId,
      fechaInicio,
      fechaFin
    ).subscribe({
      next: (data) => {
        this.reporte = data;
        this.cargando = false;
        
        // Asegurar sucursal seleccionada para la UI del gerente
        if (this.session && this.session.role === 'gerente' && !this.sucursalSeleccionada && this.sucursales.length > 0) {
          this.sucursalSeleccionada = this.sucursales.find(s => s.SucursalKey === this.session?.sucursalKey) || null;
        }

        // Cargar lotes con fechas próximas de vencimiento
        this.cargarCaducidades();
      },
      error: (err) => {
        console.error('Error al cargar reporte:', err);
        this.mensajeError = 'No se pudo obtener datos del Data Mart. Verifique que la base de datos esté activa y las tablas creadas.';
        this.cargando = false;
      }
    });
  }

  seleccionarSucursal(sucursal: any): void {
    if (this.session && this.session.role === 'gerente') {
      // El gerente tiene bloqueado el filtrado de sucursales
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
    this.categoriaSeleccionada = null;
    this.ventaSeleccionadaId = null;
    this.fechaSeleccionada = null;
    this.clienteSeleccionado = null;
    this.productoSeleccionado = null;
    this.fechaInicioSeleccionada = null;
    this.fechaFinSeleccionada = null;
    this.cargarDatos();
  }

  onFechaInicioChange(event: any): void {
    const value = event.target.value;
    this.fechaInicioSeleccionada = value ? value : null;
    this.cargarDatos();
  }

  onFechaFinChange(event: any): void {
    const value = event.target.value;
    this.fechaFinSeleccionada = value ? value : null;
    this.cargarDatos();
  }

  cargarCaducidades(): void {
    this.apiService.getAllStocks().subscribe({
      next: (data) => {
        const hoy = new Date();
        // Filtrar lotes con fecha de vencimiento y stock > 0 que expiren en 30 días o menos
        this.stocksExpiring = data
          .filter(item => {
            if (!item.fechaCaducidad || item.stock <= 0) return false;
            const expDate = new Date(item.fechaCaducidad);
            const diffTime = expDate.getTime() - hoy.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays <= 30; // 30 días o menos (próximos a caducar) o ya caducados
          })
          .sort((a, b) => new Date(a.fechaCaducidad).getTime() - new Date(b.fechaCaducidad).getTime());
      },
      error: (err) => console.error('Error al obtener stock para caducidad:', err)
    });
  }

  guardarDescuento(item: any): void {
    if (!this.session || this.session.role !== 'admin') {
      alert('Operación no autorizada. Solo el Administrador puede configurar descuentos.');
      return;
    }
    
    const desc = Number(item.descuentoPorcentaje);
    if (isNaN(desc) || desc < 0 || desc > 90) {
      alert('El descuento debe ser un número entero entre 0 y 90%.');
      return;
    }

    this.apiService.applyStockDiscount(
      item.sucursalKey,
      item.productoKey,
      item.lote,
      desc,
      'admin'
    ).subscribe({
      next: (res) => {
        this.cargarDatos(); // Recargar datos
        alert(res.message);
      },
      error: (err) => {
        console.error('Error al guardar descuento:', err);
        alert('Error al aplicar el descuento: ' + (err.error?.message || err.message));
      }
    });
  }

  seleccionarVenta(ventaId: number | undefined | null): void {
    if (ventaId === undefined || ventaId === null) return;
    if (this.ventaSeleccionadaId === ventaId) {
      this.ventaSeleccionadaId = null;
    } else {
      this.ventaSeleccionadaId = ventaId;
    }
    this.cargarDatos();
  }

  seleccionarFecha(fecha: string | undefined | null): void {
    if (!fecha) return;
    if (this.fechaSeleccionada === fecha) {
      this.fechaSeleccionada = null;
    } else {
      this.fechaSeleccionada = fecha;
    }
    this.cargarDatos();
  }

  seleccionarCliente(cliente: any | undefined | null): void {
    if (!cliente) return;
    if (this.clienteSeleccionado?.ClienteKey === cliente.ClienteKey) {
      this.clienteSeleccionado = null;
    } else {
      this.clienteSeleccionado = cliente;
    }
    this.cargarDatos();
  }

  seleccionarProducto(producto: any | undefined | null): void {
    if (!producto) return;
    if (this.productoSeleccionado?.ProductoKey === producto.ProductoKey) {
      this.productoSeleccionado = null;
    } else {
      this.productoSeleccionado = producto;
    }
    this.cargarDatos();
  }

  seleccionarCategoria(categoria: string): void {
    if (this.categoriaSeleccionada === categoria) {
      this.categoriaSeleccionada = null;
    } else {
      this.categoriaSeleccionada = categoria;
    }
    this.cargarDatos();
  }

  obtenerColorCategoria(categoria: string): string {
    const map: { [key: string]: string } = {
      'hamburguesas': '#f59e0b',
      'acompañamientos': '#3b82f6',
      'bebidas': '#06b6d4',
      'postres': '#ec4899',
      'entradas': '#10b981',
      'combos': '#8b5cf6'
    };
    return map[categoria.toLowerCase()] || '#6366f1';
  }

  get slices() {
    if (!this.reporte || !this.reporte.ventas_categoria) return [];
    const totalVentas = this.reporte.ventas_categoria.reduce((acc, cat) => acc + cat.total, 0);
    if (totalVentas === 0) return [];

    let acumulado = 0;
    const circumference = 251.327; // 2 * pi * 40
    return this.reporte.ventas_categoria.map(cat => {
      const porcentaje = cat.total / totalVentas;
      const strokeDashArray = `${(porcentaje * circumference).toFixed(2)} ${circumference.toFixed(2)}`;
      const strokeDashOffset = -acumulado * circumference;
      const color = this.obtenerColorCategoria(cat.Categoria);
      
      acumulado += porcentaje;
      
      return {
        ...cat,
        porcentaje: porcentaje * 100,
        strokeDashArray,
        strokeDashOffset: strokeDashOffset.toFixed(2),
        color
      };
    });
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

  get trendMaxVal(): number {
    if (!this.reporte || !this.reporte.ventas_mensuales || this.reporte.ventas_mensuales.length === 0) return 1;
    return Math.max(...this.reporte.ventas_mensuales.map(m => m.total), 1);
  }

  get trendPoints() {
    if (!this.reporte || !this.reporte.ventas_mensuales || this.reporte.ventas_mensuales.length === 0) return [];
    
    const data = this.reporte.ventas_mensuales;
    const width = 500;
    const height = 150;
    const paddingLeft = 50;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;
    
    const maxVal = this.trendMaxVal;
    const n = data.length;
    
    return data.map((m, i) => {
      // Calcular coordenada X. Si es 1 punto, ubicar en el centro.
      const x = n > 1 
        ? paddingLeft + (i * (width - paddingLeft - paddingRight) / (n - 1)) 
        : paddingLeft + (width - paddingLeft - paddingRight) / 2;
        
      // Calcular coordenada Y
      const ratio = m.total / maxVal;
      const y = height - paddingBottom - (ratio * (height - paddingTop - paddingBottom));
      
      return {
        x,
        y,
        label: `${m.NombreMes}`,
        value: m.total,
        anio: m.Anio,
        rawMonth: m
      };
    });
  }

  get trendLinePath(): string {
    const points = this.trendPoints;
    if (points.length === 0) return '';
    if (points.length === 1) {
      // Para un único punto, dibujar una línea constante de extremo a extremo
      return `M 50 ${points[0].y.toFixed(1)} L 480 ${points[0].y.toFixed(1)}`;
    }
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  }

  get trendAreaPath(): string {
    const points = this.trendPoints;
    if (points.length === 0) return '';
    const width = 500;
    const height = 150;
    const paddingBottom = 30;
    const bottomY = (height - paddingBottom).toFixed(1);
    
    if (points.length === 1) {
      // Para un único punto, dibujar el área constante de extremo a extremo
      return `M 50 ${points[0].y.toFixed(1)} L 480 ${points[0].y.toFixed(1)} L 480 ${bottomY} L 50 ${bottomY} Z`;
    }
    
    const startX = points[0].x.toFixed(1);
    const endX = points[points.length - 1].x.toFixed(1);
    
    const linePath = this.trendLinePath;
    return `${linePath} L ${endX} ${bottomY} L ${startX} ${bottomY} Z`;
  }

  abrirModalFacturacion(): void {
    this.mostrarModalFacturacion = true;
  }

  cerrarModalFacturacion(): void {
    this.mostrarModalFacturacion = false;
  }
}
