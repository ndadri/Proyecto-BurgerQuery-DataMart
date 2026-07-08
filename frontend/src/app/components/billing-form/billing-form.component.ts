import { Component, OnInit, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { DimProducto, DimCliente, DimSucursal, VentaPayload } from '../../models/datamart.model';

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

  // Datos del formulario
  productoKey: number | null = null;
  clienteKey: number | null = null;
  sucursalKey: number | null = null;
  cantidad: number = 1;
  descuento: number = 0.00;
  fecha: string = '';
  hora: number = 12;

  // Estado
  mensajeExito: string | null = null;
  mensajeError: string | null = null;
  cargando: boolean = false;

  ngOnInit(): void {
    // Establecer fecha y hora de hoy por defecto
    const hoy = new Date();
    this.fecha = hoy.toISOString().split('T')[0];
    this.hora = hoy.getHours();

    this.cargarDimensiones();
  }

  cargarDimensiones(): void {
    this.apiService.getProductos().subscribe({
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

  get productoSeleccionado(): DimProducto | undefined {
    return this.productos.find(p => p.ProductoKey === Number(this.productoKey));
  }

  get subtotal(): number {
    const prod = this.productoSeleccionado;
    return prod ? prod.PrecioUnitario * this.cantidad : 0;
  }

  get total(): number {
    const totalCalc = this.subtotal - this.descuento;
    return totalCalc > 0 ? totalCalc : 0;
  }

  registrarVenta(): void {
    if (!this.productoKey || !this.clienteKey || !this.sucursalKey || this.cantidad <= 0 || !this.fecha) {
      this.mensajeError = 'Por favor complete todos los campos obligatorios con valores correctos.';
      return;
    }

    const prod = this.productoSeleccionado;
    if (prod && prod.Stock < this.cantidad) {
      this.mensajeError = `Stock insuficiente. Disponible: ${prod.Stock}, Solicitado: ${this.cantidad}`;
      return;
    }

    this.cargando = true;
    this.mensajeExito = null;
    this.mensajeError = null;

    const payload: VentaPayload = {
      ProductoKey: Number(this.productoKey),
      ClienteKey: Number(this.clienteKey),
      SucursalKey: Number(this.sucursalKey),
      Cantidad: this.cantidad,
      Descuento: this.descuento,
      Fecha: this.fecha,
      Hora: Number(this.hora)
    };


    this.apiService.registrarVenta(payload).subscribe({
      next: (res) => {
        this.mensajeExito = res.message || '¡Venta registrada con éxito!';
        this.limpiarFormulario();
        this.ventaRegistrada.emit();
        this.cargando = false;
        // Recargar dimensiones para actualizar stocks en los selectores
        this.cargarDimensiones();
      },
      error: (err) => {
        this.mensajeError = err.error?.message || err.error?.error || 'Error al registrar la venta.';
        this.cargando = false;
      }
    });
  }

  limpiarFormulario(): void {
    this.productoKey = null;
    this.cantidad = 1;
    this.descuento = 0.00;
    // Mantener cliente, sucursal y fecha para facilitar facturación sucesiva
  }
}
