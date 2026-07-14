import { Component, OnInit, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { DimProducto, DimCliente, DimSucursal, VentaPayload, SessionInfo } from '../../models/datamart.model';

interface CartItem {
  ProductoKey: number;
  Nombre: string;
  Cantidad: number;
  PrecioUnitario: number;
  Descuento: number;
  Total: number;
}

@Component({
  selector: 'app-billing-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './billing-form.component.html',
  styleUrls: ['./billing-form.component.css']
})
export class BillingFormComponent implements OnInit {
  private apiService = inject(ApiService);

  @Output() ventaRegistrada = new EventEmitter<void>();

  // Catálogos cargados de dimensiones
  productos: DimProducto[] = [];
  clientes: DimCliente[] = [];
  sucursales: DimSucursal[] = [];

  // Datos comunes de la venta
  clienteKey: number | null = null;
  sucursalKey: number | null = null;
  fecha: string = '';
  hora: number = 12;

  // Datos del producto actual a agregar
  productoKey: number | null = null;
  cantidad: number = 1;
  descuento: number = 0.00;

  // Carrito de compras (Múltiples productos)
  itemsCarrito: CartItem[] = [];

  // Estado
  mensajeExito: string | null = null;
  mensajeError: string | null = null;
  cargando: boolean = false;
  session: SessionInfo | null = null;

  // Estado de creación inline de cliente
  mostrarFormCliente = false;
  nuevoClienteNombre = '';
  nuevoClienteID: number | null = null;
  nuevoClienteTipo = 'Regular';
  creandoCliente = false;
  errorClienteMsg: string | null = null;

  ngOnInit(): void {
    const sessionStr = localStorage.getItem('bq_session');
    if (sessionStr) {
      try {
        this.session = JSON.parse(sessionStr) as SessionInfo;
        if (this.session && this.session.role === 'gerente') {
          this.sucursalKey = this.session.sucursalKey;
        }
      } catch (e) {
        console.error('Error parsing session in billing form:', e);
      }
    }

    // Establecer fecha y hora de hoy por defecto
    const hoy = new Date();
    this.fecha = hoy.toISOString().split('T')[0];
    this.hora = hoy.getHours();

    this.cargarDimensiones();
  }

  cargarDimensiones(): void {
    const sucursalId = this.sucursalKey ? Number(this.sucursalKey) : undefined;
    this.apiService.getProductos(sucursalId).subscribe({
      next: (data) => this.productos = data,
      error: (err) => this.mensajeError = 'Error al cargar productos: ' + (err.error?.message || err.message)
    });

    this.apiService.getClientes().subscribe({
      next: (data) => this.clientes = data,
      error: (err) => this.mensajeError = 'Error al cargar clientes: ' + (err.error?.message || err.message)
    });

    this.apiService.getSucursales().subscribe({
      next: (data) => this.sucursales = data,
      error: (err) => this.mensajeError = 'Error al cargar sucursales: ' + (err.error?.message || err.message)
    });
  }

  onSucursalChange(): void {
    const sucursalId = this.sucursalKey ? Number(this.sucursalKey) : undefined;
    // Si cambia la sucursal, vaciar el carrito porque el inventario/stock depende de la sucursal
    if (this.itemsCarrito.length > 0) {
      if (confirm('Cambiar de sucursal vaciará los productos agregados al carrito. ¿Desea continuar?')) {
        this.itemsCarrito = [];
      } else {
        // Revertir sucursal
        return;
      }
    }
    this.apiService.getProductos(sucursalId).subscribe({
      next: (data) => {
        this.productos = data;
        this.productoKey = null;
        this.descuento = 0.00;
      },
      error: (err) => this.mensajeError = 'Error al cargar productos: ' + (err.error?.message || err.message)
    });
  }

  onProductoChange(): void {
    this.calcularDescuentoCaducidad();
  }

  onCantidadChange(): void {
    this.calcularDescuentoCaducidad();
  }

  calcularDescuentoCaducidad(): void {
    const prod = this.productoSeleccionado as any;
    if (prod && prod.DescuentoPorcentaje > 0) {
      const descMonto = (prod.PrecioUnitario * this.cantidad * prod.DescuentoPorcentaje) / 100;
      this.descuento = Number(descMonto.toFixed(2));
    } else {
      this.descuento = 0.00;
    }
  }

  get productoSeleccionado(): DimProducto | undefined {
    return this.productos.find(p => p.ProductoKey === Number(this.productoKey));
  }

  get productoSeleccionadoConDescuento(): any {
    return this.productoSeleccionado;
  }

  get subtotal(): number {
    const prod = this.productoSeleccionado;
    return prod ? prod.PrecioUnitario * this.cantidad : 0;
  }

  get total(): number {
    const totalCalc = this.subtotal - this.descuento;
    return totalCalc > 0 ? totalCalc : 0;
  }

  // Métodos del carrito
  agregarProductoAlCarrito(): void {
    if (!this.productoKey || this.cantidad <= 0) return;

    const prod = this.productos.find(p => p.ProductoKey === Number(this.productoKey));
    if (!prod) return;

    // Calcular cantidad total de este producto ya agregada al carrito
    const enCarrito = this.itemsCarrito
      .filter(item => item.ProductoKey === prod.ProductoKey)
      .reduce((sum, item) => sum + item.Cantidad, 0);

    const cantidadSolicitada = Number(this.cantidad);
    const stockDisponible = prod.Stock;

    if (stockDisponible < (enCarrito + cantidadSolicitada)) {
      alert(`Stock insuficiente para ${prod.Nombre}. Disponible en sucursal: ${stockDisponible} uds, en carrito: ${enCarrito} uds, solicitado: ${cantidadSolicitada} uds.`);
      return;
    }

    const subtotalItem = cantidadSolicitada * prod.PrecioUnitario;
    const desc = Number(this.descuento || 0);
    const totalItem = Math.max(subtotalItem - desc, 0);

    // Agregar nuevo ítem al carrito
    this.itemsCarrito.push({
      ProductoKey: prod.ProductoKey,
      Nombre: prod.Nombre,
      Cantidad: cantidadSolicitada,
      PrecioUnitario: prod.PrecioUnitario,
      Descuento: desc,
      Total: totalItem
    });

    // Resetear campos del producto actual
    this.productoKey = null;
    this.cantidad = 1;
    this.descuento = 0.00;
  }

  removerProductoDelCarrito(index: number): void {
    this.itemsCarrito.splice(index, 1);
  }

  get totalCarritoSubtotal(): number {
    return this.itemsCarrito.reduce((acc, item) => acc + (item.Cantidad * item.PrecioUnitario), 0);
  }

  get totalCarritoDescuento(): number {
    return this.itemsCarrito.reduce((acc, item) => acc + item.Descuento, 0);
  }

  get totalCarritoTotal(): number {
    return this.itemsCarrito.reduce((acc, item) => acc + item.Total, 0);
  }

  registrarVenta(): void {
    if (this.itemsCarrito.length === 0) {
      this.mensajeError = 'Debe agregar al menos un producto al carrito.';
      return;
    }

    if (!this.clienteKey || !this.sucursalKey || !this.fecha) {
      this.mensajeError = 'Por favor complete todos los campos obligatorios comunes (Cliente, Sucursal, Fecha).';
      return;
    }

    this.cargando = true;
    this.mensajeExito = null;
    this.mensajeError = null;

    const payload = {
      ClienteKey: Number(this.clienteKey),
      SucursalKey: Number(this.sucursalKey),
      Fecha: this.fecha,
      Hora: Number(this.hora),
      Items: this.itemsCarrito.map(item => ({
        ProductoKey: item.ProductoKey,
        Cantidad: item.Cantidad,
        Descuento: item.Descuento
      }))
    };

    this.apiService.registrarVenta(payload as any).subscribe({
      next: (res) => {
        this.mensajeExito = res.message || '¡Venta registrada con éxito!';
        this.limpiarFormulario();
        this.ventaRegistrada.emit();
        this.cargando = false;
        this.cargarDimensiones();
      },
      error: (err) => {
        this.mensajeError = err.error?.message || err.error?.error || 'Error al registrar la venta.';
        this.cargando = false;
      }
    });
  }

  limpiarFormulario(): void {
    this.itemsCarrito = [];
    this.productoKey = null;
    this.cantidad = 1;
    this.descuento = 0.00;
  }

  toggleCrearCliente(): void {
    this.mostrarFormCliente = !this.mostrarFormCliente;
    this.errorClienteMsg = null;
    this.nuevoClienteNombre = '';
    this.nuevoClienteID = null;
    this.nuevoClienteTipo = 'Regular';
  }

  crearClienteSubmit(): void {
    if (!this.nuevoClienteNombre || this.nuevoClienteID === null) {
      this.errorClienteMsg = 'Complete Nombre e ID.';
      return;
    }
    this.creandoCliente = true;
    this.errorClienteMsg = null;

    const payload = {
      ClienteID: this.nuevoClienteID,
      NombreCompleto: this.nuevoClienteNombre,
      TipoCliente: this.nuevoClienteTipo
    };

    this.apiService.crearCliente(payload).subscribe({
      next: (res) => {
        this.apiService.getClientes().subscribe({
          next: (data) => {
            this.clientes = data;
            const nuevo = data.find(c => c.ClienteID === payload.ClienteID);
            if (nuevo) {
              this.clienteKey = nuevo.ClienteKey;
            }
            this.creandoCliente = false;
            this.mostrarFormCliente = false;
          },
          error: (err) => {
            console.error('Error al recargar clientes:', err);
            this.creandoCliente = false;
            this.mostrarFormCliente = false;
          }
        });
      },
      error: (err) => {
        console.error('Error al crear cliente:', err);
        this.errorClienteMsg = err.error?.message || err.error?.error || 'Error al guardar cliente.';
        this.creandoCliente = false;
      }
    });
  }
}
