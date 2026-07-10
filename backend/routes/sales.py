from flask import Blueprint, request, jsonify
from datetime import datetime
from models import db, FactVentas, DimProducto, DimCliente, DimSucursal, DimTiempo, StockSucursal
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
            
        # Validar stock por sucursal
        stock_sucursal = StockSucursal.query.filter_by(SucursalKey=sucursal_key, ProductoKey=producto_key).first()
        if not stock_sucursal:
            return jsonify({
                'error': 'Stock no inicializado', 
                'message': f'La sucursal seleccionada no tiene inventario inicializado para {producto.Nombre}.'
            }), 400
            
        if stock_sucursal.Stock < cantidad:
            return jsonify({
                'error': 'Stock insuficiente', 
                'message': f'No hay suficiente stock en esta sucursal para {producto.Nombre}. Stock disponible: {stock_sucursal.Stock}, Solicitado: {cantidad}'
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
        
        # Recargar el stock en la sesión para que retorne el stock actualizado por el trigger
        if stock_sucursal:
            db.session.refresh(stock_sucursal)
        
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
        sucursal_key = request.args.get('sucursalKey', type=int)
        dia_semana = request.args.get('diaSemana', type=int)
        hora = request.args.get('hora', type=int)

        # 1. KPIs Generales
        kpis_query = db.session.query(
            func.coalesce(func.sum(FactVentas.MontoTotal), 0).label('total_ventas'),
            func.count(FactVentas.VentaID).label('transacciones'),
            func.coalesce(func.sum(FactVentas.Cantidad), 0).label('unidades_vendidas'),
            func.coalesce(func.sum(FactVentas.Descuento), 0).label('total_descuentos')
        )
        if dia_semana or hora is not None:
            kpis_query = kpis_query.join(DimTiempo, FactVentas.TiempoKey == DimTiempo.TiempoKey)
        
        # 2. Ventas por Categoría (Join con DimProducto)
        ventas_categoria_query = db.session.query(
            DimProducto.Categoria,
            func.coalesce(func.sum(FactVentas.MontoTotal), 0).label('total'),
            func.coalesce(func.sum(FactVentas.Cantidad), 0).label('cantidad')
        ).join(FactVentas, DimProducto.ProductoKey == FactVentas.ProductoKey)
        if dia_semana or hora is not None:
            ventas_categoria_query = ventas_categoria_query.join(DimTiempo, FactVentas.TiempoKey == DimTiempo.TiempoKey)
         
        # 3. Ventas por Sucursal (Join con DimSucursal) - NEVER filter this by sucursalKey so that all branches remain listed in the UI!
        ventas_sucursal_query = db.session.query(
            DimSucursal.SucursalKey,
            DimSucursal.NombreSucursal,
            DimSucursal.Ciudad,
            func.coalesce(func.sum(FactVentas.MontoTotal), 0).label('total'),
            func.coalesce(func.sum(FactVentas.Cantidad), 0).label('cantidad')
        ).join(FactVentas, DimSucursal.SucursalKey == FactVentas.SucursalKey)
        if dia_semana or hora is not None:
            ventas_sucursal_query = ventas_sucursal_query.join(DimTiempo, FactVentas.TiempoKey == DimTiempo.TiempoKey)
         
        # 4. Tendencia Mensual (Join con DimTiempo)
        ventas_mensuales_query = db.session.query(
            DimTiempo.Anio,
            DimTiempo.Mes,
            DimTiempo.NombreMes,
            func.coalesce(func.sum(FactVentas.MontoTotal), 0).label('total')
        ).join(FactVentas, DimTiempo.TiempoKey == FactVentas.TiempoKey)
         
        # 5. Listado de últimas 10 ventas
        ultimas_ventas_query = FactVentas.query
        if dia_semana or hora is not None:
            # We must join DimTiempo to filter on it
            ultimas_ventas_query = ultimas_ventas_query.join(DimTiempo, FactVentas.TiempoKey == DimTiempo.TiempoKey)
        
        # 6. Inventario Actualizado (para ver efecto del trigger)
        productos = DimProducto.query.all()
        productos_inventario = []
        for p in productos:
            d = p.to_dict()
            if sucursal_key:
                stock_entry = StockSucursal.query.filter_by(SucursalKey=sucursal_key, ProductoKey=p.ProductoKey).first()
                d['Stock'] = stock_entry.Stock if stock_entry else 0
            else:
                total_stock = db.session.query(func.sum(StockSucursal.Stock)).filter_by(ProductoKey=p.ProductoKey).scalar()
                d['Stock'] = int(total_stock) if total_stock is not None else 0
            productos_inventario.append(d)
        productos_inventario.sort(key=lambda x: x['Stock'])

        # 7. Diagrama de Calor: transacciones por día de semana (1=Lunes, 7=Domingo) y hora (0-23)
        # NEVER filter this query by dia_semana or hora so that all cells remain visible in the heatmap!
        ventas_hora_query = db.session.query(
            func.extract('isodow', DimTiempo.Fecha).label('dia_semana'),
            FactVentas.Hora.label('hora'),
            func.count(FactVentas.VentaID).label('cantidad')
        ).join(DimTiempo, FactVentas.TiempoKey == DimTiempo.TiempoKey)

        # Aplicar filtros si se recibe sucursal_key
        if sucursal_key:
            kpis_query = kpis_query.filter(FactVentas.SucursalKey == sucursal_key)
            ventas_categoria_query = ventas_categoria_query.filter(FactVentas.SucursalKey == sucursal_key)
            ventas_mensuales_query = ventas_mensuales_query.filter(FactVentas.SucursalKey == sucursal_key)
            ultimas_ventas_query = ultimas_ventas_query.filter(FactVentas.SucursalKey == sucursal_key)
            ventas_hora_query = ventas_hora_query.filter(FactVentas.SucursalKey == sucursal_key)

        # Aplicar filtros si se recibe dia_semana
        if dia_semana:
            kpis_query = kpis_query.filter(func.extract('isodow', DimTiempo.Fecha) == dia_semana)
            ventas_categoria_query = ventas_categoria_query.filter(func.extract('isodow', DimTiempo.Fecha) == dia_semana)
            ventas_sucursal_query = ventas_sucursal_query.filter(func.extract('isodow', DimTiempo.Fecha) == dia_semana)
            ventas_mensuales_query = ventas_mensuales_query.filter(func.extract('isodow', DimTiempo.Fecha) == dia_semana)
            ultimas_ventas_query = ultimas_ventas_query.filter(func.extract('isodow', DimTiempo.Fecha) == dia_semana)

        # Aplicar filtros si se recibe hora
        if hora is not None:
            kpis_query = kpis_query.filter(FactVentas.Hora == hora)
            ventas_categoria_query = ventas_categoria_query.filter(FactVentas.Hora == hora)
            ventas_sucursal_query = ventas_sucursal_query.filter(FactVentas.Hora == hora)
            ventas_mensuales_query = ventas_mensuales_query.filter(FactVentas.Hora == hora)
            ultimas_ventas_query = ultimas_ventas_query.filter(FactVentas.Hora == hora)

        # Ejecutar consultas
        kpis = kpis_query.first()
        ventas_categoria = ventas_categoria_query.group_by(DimProducto.Categoria).all()
        ventas_sucursal = ventas_sucursal_query.group_by(DimSucursal.SucursalKey, DimSucursal.NombreSucursal, DimSucursal.Ciudad).all()
        ventas_mensuales = ventas_mensuales_query.group_by(DimTiempo.Anio, DimTiempo.Mes, DimTiempo.NombreMes)\
            .order_by(DimTiempo.Anio, DimTiempo.Mes).all()
        ultimas_ventas = ultimas_ventas_query.order_by(FactVentas.VentaID.desc()).limit(10).all()
        ventas_hora = ventas_hora_query.group_by('dia_semana', 'hora').all()

        return jsonify({
            'kpis': {
                'total_ventas': float(kpis.total_ventas) if kpis.total_ventas else 0.0,
                'transacciones': kpis.transacciones if kpis.transacciones else 0,
                'unidades_vendidas': int(kpis.unidades_vendidas) if kpis.unidades_vendidas else 0,
                'total_descuentos': float(kpis.total_descuentos) if kpis.total_descuentos else 0.0
            },
            'ventas_categoria': [
                {'Categoria': c, 'total': float(t), 'cantidad': int(q)} 
                for c, t, q in ventas_categoria
            ],
            'ventas_sucursal': [
                {'SucursalKey': sk, 'NombreSucursal': s, 'Ciudad': ciu, 'total': float(t), 'cantidad': int(q)} 
                for sk, s, ciu, t, q in ventas_sucursal
            ],
            'ventas_mensuales': [
                {'Anio': y, 'Mes': m, 'NombreMes': nm, 'total': float(t)} 
                for y, m, nm, t in ventas_mensuales
            ],
            'ultimas_ventas': [v.to_dict() for v in ultimas_ventas],
            'inventario': productos_inventario,
            'ventas_hora': [
                {'dia_semana': int(float(d)), 'hora': int(h), 'cantidad': int(c)} 
                for d, h, c in ventas_hora
            ]
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'Error al procesar el reporte OLAP', 'message': str(e)}), 500


@sales_bp.route('/<int:venta_id>', methods=['PUT'])
def editar_venta(venta_id):
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
            
        venta = FactVentas.query.get(venta_id)
        if not venta:
            return jsonify({'error': 'No encontrado', 'message': f'La venta con ID {venta_id} no existe.'}), 404
            
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

        # Conciliación de stock por sucursal
        old_stock_entry = StockSucursal.query.filter_by(SucursalKey=venta.SucursalKey, ProductoKey=venta.ProductoKey).first()
        new_stock_entry = StockSucursal.query.filter_by(SucursalKey=sucursal_key, ProductoKey=producto_key).first()
        
        if not new_stock_entry:
            return jsonify({
                'error': 'Stock no inicializado', 
                'message': f'La sucursal destino no tiene inventario inicializado para {producto.Nombre}.'
            }), 400

        # Si no cambia ni el producto ni la sucursal
        if venta.ProductoKey == producto_key and venta.SucursalKey == sucursal_key:
            diff = cantidad - venta.Cantidad
            if diff > 0 and new_stock_entry.Stock < diff:
                return jsonify({
                    'error': 'Stock insuficiente', 
                    'message': f'No hay suficiente stock en esta sucursal para {producto.Nombre}. Disponible: {new_stock_entry.Stock}, Adicional requerido: {diff}'
                }), 400
            new_stock_entry.Stock -= diff
            
        # Si cambia el producto y/o la sucursal
        else:
            # Devolver stock a la combinación anterior
            if old_stock_entry:
                old_stock_entry.Stock += venta.Cantidad
            # Descontar stock de la nueva combinación
            if new_stock_entry.Stock < cantidad:
                # Revertir devolución antes de fallar
                if old_stock_entry:
                    old_stock_entry.Stock -= venta.Cantidad
                return jsonify({
                    'error': 'Stock insuficiente', 
                    'message': f'No hay suficiente stock en la sucursal destino para {producto.Nombre}. Disponible: {new_stock_entry.Stock}, Solicitado: {cantidad}'
                }), 400
            new_stock_entry.Stock -= cantidad

        # Calcular montos
        precio_aplicado = float(producto.PrecioUnitario)
        monto_total = (cantidad * precio_aplicado) - descuento
        if monto_total < 0:
            monto_total = 0.0

        # Actualizar datos de la venta
        venta.TiempoKey = tiempo_key
        venta.ProductoKey = producto_key
        venta.ClienteKey = cliente_key
        venta.SucursalKey = sucursal_key
        venta.Cantidad = cantidad
        venta.PrecioAplicado = precio_aplicado
        venta.MontoTotal = monto_total
        venta.Descuento = descuento
        venta.Hora = hora
        
        db.session.commit()
        
        return jsonify({
            'message': 'Venta actualizada con éxito.',
            'venta': venta.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Error interno del servidor', 'message': str(e)}), 500
