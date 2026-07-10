from flask import Blueprint, request, jsonify
from models import DimPersonal

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json() or {}
        role = data.get('role')
        username = data.get('username')
        password = data.get('password')

        if not role or not username or not password:
            return jsonify({'error': 'Datos incompletos', 'message': 'Rol, usuario y contraseña son requeridos.'}), 400

        if role == 'admin':
            # Credenciales de administrador fijas para el Data Mart
            if username == 'admin' and password == 'admin123':
                return jsonify({
                    'role': 'admin',
                    'username': 'admin',
                    'name': 'Administrador',
                    'sucursalKey': None,
                    'nombreSucursal': None,
                    'token': 'admin-session-token'
                }), 200
            else:
                return jsonify({'error': 'No autorizado', 'message': 'Credenciales de administrador incorrectas.'}), 401

        elif role == 'gerente' or role == 'vendedor':
            # Autenticación del gerente/vendedor consultando la base de datos
            personal = DimPersonal.query.filter_by(Usuario=username).first()
            if not personal or personal.Contrasena != password:
                return jsonify({'error': 'No autorizado', 'message': 'Usuario o contraseña de gerente incorrectos.'}), 401
            
            return jsonify({
                'role': 'gerente',
                'username': personal.Usuario,
                'name': f"{personal.Nombre} {personal.Apellido}",
                'sucursalKey': personal.SucursalKey,
                'nombreSucursal': personal.sucursal.NombreSucursal if personal.sucursal else 'Desconocida',
                'token': f"gerente-{personal.PersonalKey}-token"
            }), 200

        elif role == 'proveedor':
            # Autenticación del proveedor
            if username == 'proveedor' and password == 'prove123':
                return jsonify({
                    'role': 'proveedor',
                    'username': 'proveedor',
                    'name': 'Proveedor Principal',
                    'sucursalKey': None,
                    'nombreSucursal': None,
                    'token': 'proveedor-session-token'
                }), 200
            else:
                return jsonify({'error': 'No autorizado', 'message': 'Credenciales de proveedor incorrectas.'}), 401

        else:
            return jsonify({'error': 'Rol inválido', 'message': 'El rol debe ser admin, gerente o proveedor.'}), 400

    except Exception as e:
        return jsonify({'error': 'Error de autenticación', 'message': str(e)}), 500
