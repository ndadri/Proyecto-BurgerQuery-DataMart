export interface DimProducto {
  ProductoKey: number;
  ProductoID: number;
  Nombre: string;
  Categoria: string;
  PrecioUnitario: number;
  Stock: number;
}

export interface DimCliente {
  ClienteKey: number;
  ClienteID: number;
  NombreCompleto: string;
  TipoCliente: string;
}

export interface DimSucursal {
  SucursalKey: number;
  SucursalID: number;
  NombreSucursal: string;
  Ciudad: string;
}

export interface DimTiempo {
  TiempoKey: number;
  Fecha: string;
  Dia: number;
  Mes: number;
  NombreMes: string;
  Anio: number;
  Trimestre: number;
}

export interface FactVenta {
  VentaID: number;
  TiempoKey: number;
  ProductoKey: number;
  ClienteKey: number;
  SucursalKey: number;
  Cantidad: number;
  PrecioAplicado: number;
  MontoTotal: number;
  Descuento: number;
  Hora?: number;
  Producto?: DimProducto;
  Cliente?: DimCliente;
  Sucursal?: DimSucursal;
  Tiempo?: DimTiempo;
}

export interface VentaPayload {
  ProductoKey: number;
  ClienteKey: number;
  SucursalKey: number;
  Cantidad: number;
  Descuento: number;
  Fecha: string; // Formato YYYY-MM-DD
  Hora?: number;  // 0-23
}

export interface Kpis {
  total_ventas: number;
  transacciones: number;
  unidades_vendidas: number;
  total_descuentos: number;
}

export interface VentasCategoria {
  Categoria: string;
  total: number;
  cantidad: number;
}

export interface VentasSucursal {
  SucursalKey: number;
  NombreSucursal: string;
  Ciudad: string;
  total: number;
  cantidad: number;
}

export interface VentasMensuales {
  Anio: number;
  Mes: number;
  NombreMes: string;
  total: number;
}

export interface VentasHora {
  dia_semana: number; // 1=Lunes, 7=Domingo
  hora: number;       // 0-23
  cantidad: number;   // conteo de transacciones
}

export interface DashboardReport {
  kpis: Kpis;
  ventas_categoria: VentasCategoria[];
  ventas_sucursal: VentasSucursal[];
  ventas_mensuales: VentasMensuales[];
  ultimas_ventas: FactVenta[];
  inventario: DimProducto[];
  ventas_hora: VentasHora[];
}
export interface DimPersonal {
  PersonalKey: number;
  Nombre: string;
  Apellido: string;
  Usuario: string;
  SucursalKey: number;
  NombreSucursal?: string;
  Ciudad?: string;
}

export interface SessionInfo {
  role: 'admin' | 'vendedor';
  username: string;
  name: string;
  sucursalKey: number | null;
  nombreSucursal: string | null;
  token: string;
}
