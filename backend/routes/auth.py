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

        elif role == 'vendedor':
            # Autenticación del vendedor consultando la base de datos
            personal = DimPersonal.query.filter_by(Usuario=username).first()
            if not personal or personal.Contrasena != password:
                return jsonify({'error': 'No autorizado', 'message': 'Usuario o contraseña de vendedor incorrectos.'}), 401
            
            return jsonify({
                'role': 'vendedor',
                'username': personal.Usuario,
                'name': f"{personal.Nombre} {personal.Apellido}",
                'sucursalKey': personal.SucursalKey,
                'nombreSucursal': personal.sucursal.NombreSucursal if personal.sucursal else 'Desconocida',
                'token': f"vendedor-{personal.PersonalKey}-token"
            }), 200

        else:
            return jsonify({'error': 'Rol inválido', 'message': 'El rol debe ser admin o vendedor.'}), 400

    except Exception as e:
        return jsonify({'error': 'Error de autenticación', 'message': str(e)}), 500
