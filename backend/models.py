from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class DimProducto(db.Model):
    __tablename__ = 'Dim_Producto'
    
    ProductoKey = db.Column('ProductoKey', db.Integer, primary_key=True, autoincrement=True)
    ProductoID = db.Column('ProductoID', db.Integer, nullable=False)
    Nombre = db.Column('Nombre', db.String(100), nullable=False)
    Categoria = db.Column('Categoria', db.String(50))
    PrecioUnitario = db.Column('PrecioUnitario', db.Numeric(10, 2), nullable=False)
    Stock = db.Column('Stock', db.Integer, nullable=False)

    def to_dict(self):
        return {
            'ProductoKey': self.ProductoKey,
            'ProductoID': self.ProductoID,
            'Nombre': self.Nombre,
            'Categoria': self.Categoria,
            'PrecioUnitario': float(self.PrecioUnitario),
            'Stock': self.Stock
        }


class DimCliente(db.Model):
    __tablename__ = 'Dim_Cliente'
    
    ClienteKey = db.Column('ClienteKey', db.Integer, primary_key=True, autoincrement=True)
    ClienteID = db.Column('ClienteID', db.Integer, nullable=False)
    NombreCompleto = db.Column('NombreCompleto', db.String(150), nullable=False)
    TipoCliente = db.Column('TipoCliente', db.String(50))

    def to_dict(self):
        return {
            'ClienteKey': self.ClienteKey,
            'ClienteID': self.ClienteID,
            'NombreCompleto': self.NombreCompleto,
            'TipoCliente': self.TipoCliente
        }


class DimTiempo(db.Model):
    __tablename__ = 'Dim_Tiempo'
    
    TiempoKey = db.Column('TiempoKey', db.Integer, primary_key=True)
    Fecha = db.Column('Fecha', db.Date, nullable=False, unique=True)
    Dia = db.Column('Dia', db.Integer, nullable=False)
    Mes = db.Column('Mes', db.Integer, nullable=False)
    NombreMes = db.Column('NombreMes', db.String(20), nullable=False)
    Anio = db.Column('Anio', db.Integer, nullable=False)
    Trimestre = db.Column('Trimestre', db.Integer, nullable=False)

    def to_dict(self):
        return {
            'TiempoKey': self.TiempoKey,
            'Fecha': self.Fecha.isoformat(),
            'Dia': self.Dia,
            'Mes': self.Mes,
            'NombreMes': self.NombreMes,
            'Anio': self.Anio,
            'Trimestre': self.Trimestre
        }


class DimSucursal(db.Model):
    __tablename__ = 'Dim_Sucursal'
    
    SucursalKey = db.Column('SucursalKey', db.Integer, primary_key=True, autoincrement=True)
    SucursalID = db.Column('SucursalID', db.Integer, nullable=False)
    NombreSucursal = db.Column('NombreSucursal', db.String(100), nullable=False)
    Ciudad = db.Column('Ciudad', db.String(100))

    def to_dict(self):
        return {
            'SucursalKey': self.SucursalKey,
            'SucursalID': self.SucursalID,
            'NombreSucursal': self.NombreSucursal,
            'Ciudad': self.Ciudad
        }


class FactVentas(db.Model):
    __tablename__ = 'Fact_Ventas'
    
    VentaID = db.Column('VentaID', db.Integer, primary_key=True, autoincrement=True)
    TiempoKey = db.Column('TiempoKey', db.Integer, db.ForeignKey('Dim_Tiempo.TiempoKey'), nullable=False)
    ProductoKey = db.Column('ProductoKey', db.Integer, db.ForeignKey('Dim_Producto.ProductoKey'), nullable=False)
    ClienteKey = db.Column('ClienteKey', db.Integer, db.ForeignKey('Dim_Cliente.ClienteKey'), nullable=False)
    SucursalKey = db.Column('SucursalKey', db.Integer, db.ForeignKey('Dim_Sucursal.SucursalKey'), nullable=False)
    Cantidad = db.Column('Cantidad', db.Integer, nullable=False)
    PrecioAplicado = db.Column('PrecioAplicado', db.Numeric(10, 2), nullable=False)
    MontoTotal = db.Column('MontoTotal', db.Numeric(10, 2), nullable=False)
    Descuento = db.Column('Descuento', db.Numeric(10, 2), default=0.00)
    Hora = db.Column('Hora', db.Integer, default=12, nullable=False)

    # Relaciones para joins y búsquedas
    tiempo = db.relationship('DimTiempo', backref='ventas')
    producto = db.relationship('DimProducto', backref='ventas')
    cliente = db.relationship('DimCliente', backref='ventas')
    sucursal = db.relationship('DimSucursal', backref='ventas')

    def to_dict(self):
        return {
            'VentaID': self.VentaID,
            'TiempoKey': self.TiempoKey,
            'ProductoKey': self.ProductoKey,
            'ClienteKey': self.ClienteKey,
            'SucursalKey': self.SucursalKey,
            'Cantidad': self.Cantidad,
            'PrecioAplicado': float(self.PrecioAplicado),
            'MontoTotal': float(self.MontoTotal),
            'Descuento': float(self.Descuento),
            'Hora': self.Hora,
            'Producto': self.producto.to_dict() if self.producto else None,
            'Cliente': self.cliente.to_dict() if self.cliente else None,
            'Sucursal': self.sucursal.to_dict() if self.sucursal else None,
            'Tiempo': self.tiempo.to_dict() if self.tiempo else None
        }


class StockSucursal(db.Model):
    __tablename__ = 'Stock_Sucursal'
    
    SucursalKey = db.Column('SucursalKey', db.Integer, db.ForeignKey('Dim_Sucursal.SucursalKey'), primary_key=True)
    ProductoKey = db.Column('ProductoKey', db.Integer, db.ForeignKey('Dim_Producto.ProductoKey'), primary_key=True)
    Stock = db.Column('Stock', db.Integer, nullable=False)
    
    # Relaciones para joins
    sucursal = db.relationship('DimSucursal', backref='stocks')
    producto = db.relationship('DimProducto', backref='stocks')
    
    def to_dict(self):
        return {
            'SucursalKey': self.SucursalKey,
            'ProductoKey': self.ProductoKey,
            'Stock': self.Stock,
            'Producto': self.producto.to_dict() if self.producto else None,
            'Sucursal': self.sucursal.to_dict() if self.sucursal else None
        }


class DimPersonal(db.Model):
    __tablename__ = 'Dim_Personal'
    
    PersonalKey = db.Column('PersonalKey', db.Integer, primary_key=True, autoincrement=True)
    Nombre = db.Column('Nombre', db.String(100), nullable=False)
    Apellido = db.Column('Apellido', db.String(100), nullable=False)
    Usuario = db.Column('Usuario', db.String(50), unique=True, nullable=False)
    Contrasena = db.Column('Contrasena', db.String(100), nullable=False)
    SucursalKey = db.Column('SucursalKey', db.Integer, db.ForeignKey('Dim_Sucursal.SucursalKey'), nullable=False)
    
    sucursal = db.relationship('DimSucursal', backref='personal')
    
    def to_dict(self):
        return {
            'PersonalKey': self.PersonalKey,
            'Nombre': self.Nombre,
            'Apellido': self.Apellido,
            'Usuario': self.Usuario,
            'SucursalKey': self.SucursalKey,
            'NombreSucursal': self.sucursal.NombreSucursal if self.sucursal else None,
            'Ciudad': self.sucursal.Ciudad if self.sucursal else None
        }

