from flask import Blueprint, jsonify, request
from models import db, DimProducto, DimCliente, DimSucursal, StockSucursal
from sqlalchemy import func
from datetime import datetime

dimensions_bp = Blueprint('dimensions', __name__)

@dimensions_bp.route('/productos', methods=['GET'])
def get_productos():
    try:
        sucursal_key = request.args.get('sucursalKey', type=int)
        productos = DimProducto.query.all()
        
        result = []
        for p in productos:
            d = p.to_dict()
            if sucursal_key:
                # Sumar el stock total disponible de todos los lotes del producto en esa sucursal
                total_stock = db.session.query(func.sum(StockSucursal.Stock)).filter_by(SucursalKey=sucursal_key, ProductoKey=p.ProductoKey).scalar()
                d['Stock'] = int(total_stock) if total_stock is not None else 0
                
                # Buscar el lote más próximo a caducar que tenga stock disponible
                next_batch = StockSucursal.query.filter(
                    StockSucursal.SucursalKey == sucursal_key,
                    StockSucursal.ProductoKey == p.ProductoKey,
                    StockSucursal.Stock > 0
                ).order_by(StockSucursal.FechaCaducidad.asc()).first()
                
                if next_batch:
                    d['DescuentoPorcentaje'] = next_batch.DescuentoPorcentaje
                    d['LoteProximaCaducidad'] = next_batch.Lote
                    d['FechaCaducidadProxima'] = next_batch.FechaCaducidad.isoformat() if next_batch.FechaCaducidad else None
                else:
                    d['DescuentoPorcentaje'] = 0
                    d['LoteProximaCaducidad'] = None
                    d['FechaCaducidadProxima'] = None
            else:
                total_stock = db.session.query(func.sum(StockSucursal.Stock)).filter_by(ProductoKey=p.ProductoKey).scalar()
                d['Stock'] = int(total_stock) if total_stock is not None else 0
                d['DescuentoPorcentaje'] = 0
                d['LoteProximaCaducidad'] = None
                d['FechaCaducidadProxima'] = None
            result.append(d)
            
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': 'Error al obtener productos', 'message': str(e)}), 500

@dimensions_bp.route('/clientes', methods=['GET'])
def get_clientes():
    try:
        clientes = DimCliente.query.all()
        return jsonify([c.to_dict() for c in clientes]), 200
    except Exception as e:
        return jsonify({'error': 'Error al obtener clientes', 'message': str(e)}), 500

@dimensions_bp.route('/sucursales', methods=['GET'])
def get_sucursales():
    try:
        sucursales = DimSucursal.query.all()
        return jsonify([s.to_dict() for s in sucursales]), 200
    except Exception as e:
        return jsonify({'error': 'Error al obtener sucursales', 'message': str(e)}), 500

@dimensions_bp.route('/stock/all', methods=['GET'])
def get_all_stocks():
    try:
        stocks = StockSucursal.query.all()
        result = []
        for s in stocks:
            result.append({
                'sucursalKey': s.SucursalKey,
                'nombreSucursal': s.sucursal.NombreSucursal if s.sucursal else 'Desconocida',
                'productoKey': s.ProductoKey,
                'nombreProducto': s.producto.Nombre if s.producto else 'Desconocido',
                'categoria': s.producto.Categoria if s.producto else 'Desconocida',
                'stock': s.Stock,
                'lote': s.Lote,
                'fechaCaducidad': s.FechaCaducidad.isoformat() if s.FechaCaducidad else None,
                'descuentoPorcentaje': s.DescuentoPorcentaje
            })
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': 'Error al obtener todos los stocks', 'message': str(e)}), 500

@dimensions_bp.route('/stock/supply', methods=['POST'])
def supply_stock():
    try:
        data = request.get_json() or {}
        sucursal_key = data.get('sucursalKey')
        producto_key = data.get('productoKey')
        cantidad = data.get('cantidad')
        lote = data.get('lote') or 'L-GEN'
        fecha_caducidad_str = data.get('fechaCaducidad')
        
        if not sucursal_key or not producto_key or cantidad is None:
            return jsonify({'error': 'Datos incompletos', 'message': 'sucursalKey, productoKey y cantidad son requeridos.'}), 400
            
        try:
            cantidad = int(cantidad)
        except ValueError:
            return jsonify({'error': 'Cantidad inválida', 'message': 'La cantidad debe ser un número entero.'}), 400
            
        if cantidad <= 0:
            return jsonify({'error': 'Cantidad inválida', 'message': 'La cantidad debe ser mayor que cero.'}), 400
            
        fecha_caducidad = None
        if fecha_caducidad_str:
            try:
                fecha_caducidad = datetime.strptime(fecha_caducidad_str, '%Y-%m-%d').date()
            except ValueError:
                pass

        stock_entry = StockSucursal.query.filter_by(
            SucursalKey=sucursal_key, 
            ProductoKey=producto_key,
            Lote=lote
        ).first()
        
        if not stock_entry:
            stock_entry = StockSucursal(
                SucursalKey=sucursal_key, 
                ProductoKey=producto_key, 
                Lote=lote,
                FechaCaducidad=fecha_caducidad,
                Stock=cantidad
            )
            db.session.add(stock_entry)
        else:
            stock_entry.Stock += cantidad
            if fecha_caducidad:
                stock_entry.FechaCaducidad = fecha_caducidad
            
        db.session.commit()
        return jsonify({
            'message': 'Stock abastecido con éxito.',
            'stock': stock_entry.Stock
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Error al abastecer stock', 'message': str(e)}), 500

@dimensions_bp.route('/stock/discount', methods=['POST'])
def set_stock_discount():
    try:
        data = request.get_json() or {}
        sucursal_key = data.get('sucursalKey')
        producto_key = data.get('productoKey')
        lote = data.get('lote')
        descuento = data.get('descuentoPorcentaje', 0)
        role = data.get('role')

        if role != 'admin':
            return jsonify({'error': 'No autorizado', 'message': 'Solo el Administrador puede aplicar descuentos.'}), 403

        if not sucursal_key or not producto_key or not lote:
            return jsonify({'error': 'Datos incompletos', 'message': 'sucursalKey, productoKey y lote son requeridos.'}), 400

        try:
            descuento = int(descuento)
        except ValueError:
            return jsonify({'error': 'Descuento inválido', 'message': 'El descuento debe ser un número entero.'}), 400

        if descuento < 0 or descuento > 90:
            return jsonify({'error': 'Descuento inválido', 'message': 'El descuento debe estar entre 0% y 90%.'}), 400

        stock_entry = StockSucursal.query.filter_by(
            SucursalKey=sucursal_key,
            ProductoKey=producto_key,
            Lote=lote
        ).first()

        if not stock_entry:
            return jsonify({'error': 'No encontrado', 'message': 'No se encontró la entrada de stock correspondiente.'}), 404

        stock_entry.DescuentoPorcentaje = descuento
        db.session.commit()

        return jsonify({
            'message': f'Descuento del {descuento}% aplicado con éxito al lote {lote}.',
            'descuentoPorcentaje': descuento
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Error al configurar descuento', 'message': str(e)}), 500

