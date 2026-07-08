from flask import Blueprint, jsonify
from models import DimProducto, DimCliente, DimSucursal

dimensions_bp = Blueprint('dimensions', __name__)

@dimensions_bp.route('/productos', methods=['GET'])
def get_productos():
    try:
        productos = DimProducto.query.all()
        return jsonify([p.to_dict() for p in productos]), 200
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
