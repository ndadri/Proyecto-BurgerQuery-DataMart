import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { 
  DimProducto, 
  DimCliente, 
  DimSucursal, 
  VentaPayload, 
  DashboardReport 
} from '../models/datamart.model';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = 'http://localhost:5000/api';

  // Dimensiones
  getProductos(): Observable<DimProducto[]> {
    return this.http.get<DimProducto[]>(`${this.baseUrl}/dimensiones/productos`);
  }

  getClientes(): Observable<DimCliente[]> {
    return this.http.get<DimCliente[]>(`${this.baseUrl}/dimensiones/clientes`);
  }

  getSucursales(): Observable<DimSucursal[]> {
    return this.http.get<DimSucursal[]>(`${this.baseUrl}/dimensiones/sucursales`);
  }

  // Ventas y Métricas
  registrarVenta(payload: VentaPayload): Observable<{ message: string; venta: any }> {
    return this.http.post<{ message: string; venta: any }>(`${this.baseUrl}/ventas`, payload);
  }

  getReporteOlap(): Observable<DashboardReport> {
    return this.http.get<DashboardReport>(`${this.baseUrl}/ventas/reporte`);
  }

  // Inicialización de Base de Datos
  inicializarDb(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/db-init`, {});
  }
}
