import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { 
  DimProducto, 
  DimCliente, 
  DimSucursal, 
  VentaPayload, 
  DashboardReport,
  DimPersonal,
  SessionInfo
} from '../models/datamart.model';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = 'http://localhost:5000/api';

  // Dimensiones
  getProductos(sucursalKey?: number): Observable<DimProducto[]> {
    let url = `${this.baseUrl}/dimensiones/productos`;
    if (sucursalKey !== undefined && sucursalKey !== null) {
      url += `?sucursalKey=${sucursalKey}`;
    }
    return this.http.get<DimProducto[]>(url);
  }

  getClientes(): Observable<DimCliente[]> {
    return this.http.get<DimCliente[]>(`${this.baseUrl}/dimensiones/clientes`);
  }

  getSucursales(): Observable<DimSucursal[]> {
    return this.http.get<DimSucursal[]>(`${this.baseUrl}/dimensiones/sucursales`);
  }

  registrarVenta(payload: VentaPayload): Observable<{ message: string; venta: any }> {
    return this.http.post<{ message: string; venta: any }>(`${this.baseUrl}/ventas`, payload);
  }

  editarVenta(ventaId: number, payload: VentaPayload): Observable<{ message: string; venta: any }> {
    return this.http.put<{ message: string; venta: any }>(`${this.baseUrl}/ventas/${ventaId}`, payload);
  }

  getReporteOlap(sucursalKey?: number, diaSemana?: number, hora?: number): Observable<DashboardReport> {
    let url = `${this.baseUrl}/ventas/reporte`;
    const params: string[] = [];
    if (sucursalKey !== undefined && sucursalKey !== null) {
      params.push(`sucursalKey=${sucursalKey}`);
    }
    if (diaSemana !== undefined && diaSemana !== null) {
      params.push(`diaSemana=${diaSemana}`);
    }
    if (hora !== undefined && hora !== null) {
      params.push(`hora=${hora}`);
    }
    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }
    return this.http.get<DashboardReport>(url);
  }

  // Inicialización de Base de Datos
  inicializarDb(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/db-init`, {});
  }

  login(role: string, username: string, password: string): Observable<SessionInfo> {
    return this.http.post<SessionInfo>(`${this.baseUrl}/auth/login`, { role, username, password });
  }

  crearPersonal(payload: any): Observable<{ message: string; personal: DimPersonal }> {
    return this.http.post<{ message: string; personal: DimPersonal }>(`${this.baseUrl}/personal`, payload);
  }

  getPersonal(): Observable<DimPersonal[]> {
    return this.http.get<DimPersonal[]>(`${this.baseUrl}/personal`);
  }
}
