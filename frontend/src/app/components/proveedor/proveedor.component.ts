import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { SessionInfo, DimProducto, DimSucursal } from '../../models/datamart.model';

@Component({
  selector: 'app-proveedor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './proveedor.component.html',
  styleUrls: ['./proveedor.component.css']
})
export class ProveedorComponent implements OnInit {
  private apiService = inject(ApiService);
  private router = inject(Router);

  session: SessionInfo | null = null;

  // Datos
  stocks: any[] = [];
  productos: DimProducto[] = [];
  sucursales: DimSucursal[] = [];

  // Formulario
  sucursalKeySelected: number | null = null;
  productoKeySelected: number | null = null;
  cantidadToSend: number | null = null;

  // Estados
  cargando = false;
  enviando = false;
  mensajeExito: string | null = null;
  mensajeError: string | null = null;

  ngOnInit(): void {
    const sessionStr = localStorage.getItem('bq_session');
    if (!sessionStr) {
      this.router.navigate(['/login']);
      return;
    }

    try {
      this.session = JSON.parse(sessionStr) as SessionInfo;
      if (this.session.role !== 'proveedor') {
        this.router.navigate(['/']);
        return;
      }
    } catch {
      this.router.navigate(['/login']);
      return;
    }

    this.cargarDatos();
  }

  cargarDatos(): void {
    this.cargando = true;
    this.mensajeError = null;

    // Cargar todos los stocks por sucursal
    this.apiService.getAllStocks().subscribe({
      next: (data) => {
        this.stocks = data;
        this.cargando = false;
      },
      error: (err) => {
        console.error('Error al cargar stocks:', err);
        this.mensajeError = 'No se pudieron cargar los stocks actuales de las sucursales.';
        this.cargando = false;
      }
    });

    // Cargar productos para el dropdown
    this.apiService.getProductos().subscribe({
      next: (data) => this.productos = data,
      error: (err) => console.error('Error al cargar productos:', err)
    });

    // Cargar sucursales para el dropdown
    this.apiService.getSucursales().subscribe({
      next: (data) => this.sucursales = data,
      error: (err) => console.error('Error al cargar sucursales:', err)
    });
  }

  enviarStockSubmit(): void {
    if (!this.sucursalKeySelected || !this.productoKeySelected || !this.cantidadToSend) {
      this.mensajeError = 'Por favor complete todos los campos del formulario.';
      return;
    }

    if (this.cantidadToSend <= 0) {
      this.mensajeError = 'La cantidad a enviar debe ser mayor a cero.';
      return;
    }

    this.enviando = true;
    this.mensajeExito = null;
    this.mensajeError = null;

    const sucKey = Number(this.sucursalKeySelected);
    const prodKey = Number(this.productoKeySelected);
    const cant = Number(this.cantidadToSend);

    this.apiService.supplyStock(sucKey, prodKey, cant).subscribe({
      next: (res) => {
        this.mensajeExito = `¡Éxito! ${res.message} (Nuevo stock de este producto en la sucursal: ${res.stock} unidades).`;
        this.enviando = false;
        
        // Limpiar inputs del formulario
        this.productoKeySelected = null;
        this.cantidadToSend = null;

        // Recargar tabla de stocks
        this.cargarDatos();
      },
      error: (err) => {
        console.error('Error al enviar stock:', err);
        this.mensajeError = err.error?.message || err.error?.error || 'Ocurrió un error al enviar el stock al servidor.';
        this.enviando = false;
      }
    });
  }

  obtenerNombreSucursal(key: number): string {
    const s = this.sucursales.find(suc => suc.SucursalKey === key);
    return s ? s.NombreSucursal : `Sucursal #${key}`;
  }

  obtenerNombreProducto(key: number): string {
    const p = this.productos.find(prod => prod.ProductoKey === key);
    return p ? p.Nombre : `Producto #${key}`;
  }
}
