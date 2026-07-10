from flask import Blueprint, jsonify, request
from models import db, DimProducto, DimCliente, DimSucursal, StockSucursal
from sqlalchemy import func

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
                stock_entry = StockSucursal.query.filter_by(SucursalKey=sucursal_key, ProductoKey=p.ProductoKey).first()
                d['Stock'] = stock_entry.Stock if stock_entry else 0
            else:
                total_stock = db.session.query(func.sum(StockSucursal.Stock)).filter_by(ProductoKey=p.ProductoKey).scalar()
                d['Stock'] = int(total_stock) if total_stock is not None else 0
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
                'stock': s.Stock
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
        
        if not sucursal_key or not producto_key or cantidad is None:
            return jsonify({'error': 'Datos incompletos', 'message': 'sucursalKey, productoKey y cantidad son requeridos.'}), 400
            
        try:
            cantidad = int(cantidad)
        except ValueError:
            return jsonify({'error': 'Cantidad inválida', 'message': 'La cantidad debe ser un número entero.'}), 400
            
        if cantidad <= 0:
            return jsonify({'error': 'Cantidad inválida', 'message': 'La cantidad debe ser mayor que cero.'}), 400
            
        stock_entry = StockSucursal.query.filter_by(SucursalKey=sucursal_key, ProductoKey=producto_key).first()
        if not stock_entry:
            stock_entry = StockSucursal(SucursalKey=sucursal_key, ProductoKey=producto_key, Stock=cantidad)
            db.session.add(stock_entry)
        else:
            stock_entry.Stock += cantidad
            
        db.session.commit()
        return jsonify({
            'message': 'Stock abastecido con éxito.',
            'stock': stock_entry.Stock
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Error al abastecer stock', 'message': str(e)}), 500
