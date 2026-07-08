from flask import Blueprint, request, jsonify
from datetime import datetime
from models import db, FactVentas, DimProducto, DimCliente, DimSucursal, DimTiempo
from sqlalchemy import func

sales_bp = Blueprint('sales', __name__)

# Meses en español para la dimensión tiempo
MESES_ES = {
    1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
    5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
    9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
}

def obtener_o_crear_tiempo(fecha_str):
    """
    Parsea una fecha YYYY-MM-DD, crea la dimensión de tiempo si no existe,
    y retorna la TiempoKey correspondiente.
    """
    fecha = datetime.strptime(fecha_str, '%Y-%m-%d').date()
    # TiempoKey formato YYYYMMDD
    tiempo_key = int(fecha.strftime('%Y%m%d'))
    
    tiempo = DimTiempo.query.get(tiempo_key)
    if not tiempo:
        dia = fecha.day
        mes = fecha.month
        nombre_mes = MESES_ES.get(mes, 'Desconocido')
        anio = fecha.year
        # Calcular Trimestre (1 a 4)
        trimestre = (mes - 1) // 3 + 1
        
        tiempo = DimTiempo(
            TiempoKey=tiempo_key,
            Fecha=fecha,
            Dia=dia,
            Mes=mes,
            NombreMes=nombre_mes,
            Anio=anio,
            Trimestre=trimestre
        )
        db.session.add(tiempo)
        # Hacemos flush para asegurar que la FK exista en la transacción
        db.session.flush()
        
    return tiempo_key

@sales_bp.route('', methods=['POST'])
def registrar_venta():
    try:
        data = request.get_json()
        
        # Validar campos obligatorios
        required_fields = ['ProductoKey', 'ClienteKey', 'SucursalKey', 'Cantidad', 'Fecha']
        for field in required_fields:
            if field not in data or data[field] is None:
                return jsonify({'error': 'Dato faltante', 'message': f'El campo {field} es requerido.'}), 400
                
        producto_key = int(data['ProductoKey'])
        cliente_key = int(data['ClienteKey'])
        sucursal_key = int(data['SucursalKey'])
        cantidad = int(data['Cantidad'])
        fecha_str = data['Fecha']
        descuento = float(data.get('Descuento', 0.0))
        
        if cantidad <= 0:
            return jsonify({'error': 'Cantidad no válida', 'message': 'La cantidad debe ser mayor a cero.'}), 400
            
        if descuento < 0:
            return jsonify({'error': 'Descuento no válido', 'message': 'El descuento no puede ser negativo.'}), 400
            
        # Verificar dimensiones
        producto = DimProducto.query.get(producto_key)
        if not producto:
            return jsonify({'error': 'No encontrado', 'message': f'Producto con llave {producto_key} no existe.'}), 404
            
        cliente = DimCliente.query.get(cliente_key)
        if not cliente:
            return jsonify({'error': 'No encontrado', 'message': f'Cliente con llave {cliente_key} no existe.'}), 404
            
        sucursal = DimSucursal.query.get(sucursal_key)
        if not sucursal:
            return jsonify({'error': 'No encontrado', 'message': f'Sucursal con llave {sucursal_key} no existe.'}), 404
            
        # Validar stock
        if producto.Stock < cantidad:
            return jsonify({
                'error': 'Stock insuficiente', 
                'message': f'No hay suficiente stock para {producto.Nombre}. Stock disponible: {producto.Stock}, Solicitado: {cantidad}'
            }), 400
            
        # Resolver tiempo
        try:
            tiempo_key = obtener_o_crear_tiempo(fecha_str)
        except ValueError:
            return jsonify({'error': 'Formato de fecha inválido', 'message': 'Use el formato YYYY-MM-DD.'}), 400
            
        # Resolver hora
        hora = data.get('Hora')
        if hora is not None:
            try:
                hora = int(hora)
                if hora < 0 or hora > 23:
                    return jsonify({'error': 'Hora no válida', 'message': 'La hora debe estar entre 0 y 23.'}), 400
            except ValueError:
                return jsonify({'error': 'Hora no válida', 'message': 'La hora debe ser un número entero.'}), 400
        else:
            hora = datetime.now().hour

        # Calcular montos
        precio_aplicado = float(producto.PrecioUnitario)
        monto_total = (cantidad * precio_aplicado) - descuento
        if monto_total < 0:
            monto_total = 0.0 # No permitir montos negativos
            
        # Crear la venta
        nueva_venta = FactVentas(
            TiempoKey=tiempo_key,
            ProductoKey=producto_key,
            ClienteKey=cliente_key,
            SucursalKey=sucursal_key,
            Cantidad=cantidad,
            PrecioAplicado=precio_aplicado,
            MontoTotal=monto_total,
            Descuento=descuento,
            Hora=hora
        )
        
        db.session.add(nueva_venta)
        db.session.commit()
        
        # Recargar el producto en la sesión para que retorne el stock actualizado por el trigger
        db.session.refresh(producto)
        
        return jsonify({
            'message': 'Venta registrada con éxito.',
            'venta': nueva_venta.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Error interno del servidor', 'message': str(e)}), 500


@sales_bp.route('/reporte', methods=['GET'])
def obtener_reporte_olap():
    try:
        # 1. KPIs Generales
        kpis = db.session.query(
            func.coalesce(func.sum(FactVentas.MontoTotal), 0).label('total_ventas'),
            func.count(FactVentas.VentaID).label('transacciones'),
            func.coalesce(func.sum(FactVentas.Cantidad), 0).label('unidades_vendidas'),
            func.coalesce(func.sum(FactVentas.Descuento), 0).label('total_descuentos')
        ).first()
        
        # 2. Ventas por Categoría (Join con DimProducto)
        ventas_categoria = db.session.query(
            DimProducto.Categoria,
            func.coalesce(func.sum(FactVentas.MontoTotal), 0).label('total'),
            func.coalesce(func.sum(FactVentas.Cantidad), 0).label('cantidad')
        ).join(FactVentas, DimProducto.ProductoKey == FactVentas.ProductoKey)\
         .group_by(DimProducto.Categoria).all()
         
        # 3. Ventas por Sucursal (Join con DimSucursal)
        ventas_sucursal = db.session.query(
            DimSucursal.NombreSucursal,
            DimSucursal.Ciudad,
            func.coalesce(func.sum(FactVentas.MontoTotal), 0).label('total'),
            func.coalesce(func.sum(FactVentas.Cantidad), 0).label('cantidad')
        ).join(FactVentas, DimSucursal.SucursalKey == FactVentas.SucursalKey)\
         .group_by(DimSucursal.NombreSucursal, DimSucursal.Ciudad).all()
         
        # 4. Tendencia Mensual (Join con DimTiempo)
        ventas_mensuales = db.session.query(
            DimTiempo.Anio,
            DimTiempo.Mes,
            DimTiempo.NombreMes,
            func.coalesce(func.sum(FactVentas.MontoTotal), 0).label('total')
        ).join(FactVentas, DimTiempo.TiempoKey == FactVentas.TiempoKey)\
         .group_by(DimTiempo.Anio, DimTiempo.Mes, DimTiempo.NombreMes)\
         .order_by(DimTiempo.Anio, DimTiempo.Mes).all()
         
        # 5. Listado de últimas 10 ventas
        ultimas_ventas = FactVentas.query.order_by(FactVentas.VentaID.desc()).limit(10).all()
        
        # 6. Inventario Actualizado (para ver efecto del trigger)
        productos_inventario = DimProducto.query.order_by(DimProducto.Stock.asc()).all()

        # 7. Diagrama de Calor: transacciones por día de semana (1=Lunes, 7=Domingo) y hora (0-23)
        ventas_hora = db.session.query(
            func.extract('isodow', DimTiempo.Fecha).label('dia_semana'),
            FactVentas.Hora.label('hora'),
            func.count(FactVentas.VentaID).label('cantidad')
        ).join(DimTiempo, FactVentas.TiempoKey == DimTiempo.TiempoKey)\
         .group_by('dia_semana', 'hora').all()

        return jsonify({
            'kpis': {
                'total_ventas': float(kpis.total_ventas),
                'transacciones': kpis.transacciones,
                'unidades_vendidas': int(kpis.unidades_vendidas),
                'total_descuentos': float(kpis.total_descuentos)
            },
            'ventas_categoria': [
                {'Categoria': c, 'total': float(t), 'cantidad': int(q)} 
                for c, t, q in ventas_categoria
            ],
            'ventas_sucursal': [
                {'NombreSucursal': s, 'Ciudad': ciu, 'total': float(t), 'cantidad': int(q)} 
                for s, ciu, t, q in ventas_sucursal
            ],
            'ventas_mensuales': [
                {'Anio': y, 'Mes': m, 'NombreMes': nm, 'total': float(t)} 
                for y, m, nm, t in ventas_mensuales
            ],
            'ultimas_ventas': [v.to_dict() for v in ultimas_ventas],
            'inventario': [p.to_dict() for p in productos_inventario],
            'ventas_hora': [
                {'dia_semana': int(float(d)), 'hora': int(h), 'cantidad': int(c)} 
                for d, h, c in ventas_hora
            ]
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'Error al procesar el reporte OLAP', 'message': str(e)}), 500
