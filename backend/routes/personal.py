from flask import Blueprint, request, jsonify
from models import db, DimPersonal

personal_bp = Blueprint('personal', __name__)

@personal_bp.route('', methods=['POST'])
def crear_personal():
    try:
        data = request.get_json() or {}
        nombre = data.get('Nombre')
        apellido = data.get('Apellido')
        usuario = data.get('Usuario')
        contrasena = data.get('Contrasena')
        sucursal_key = data.get('SucursalKey')

        if not nombre or not apellido or not usuario or not contrasena or not sucursal_key:
            return jsonify({'error': 'Datos faltantes', 'message': 'Todos los campos (Nombre, Apellido, Usuario, Contrasena, SucursalKey) son requeridos.'}), 400

        # Verificar si usuario ya existe
        existe = DimPersonal.query.filter_by(Usuario=usuario).first()
        if existe:
            return jsonify({'error': 'Usuario duplicado', 'message': f'El usuario "{usuario}" ya está registrado en el sistema.'}), 400

        nuevo_personal = DimPersonal(
            Nombre=nombre,
            Apellido=apellido,
            Usuario=usuario,
            Contrasena=contrasena,
            SucursalKey=int(sucursal_key)
        )

        db.session.add(nuevo_personal)
        db.session.commit()

        return jsonify({
            'message': 'Personal de ventas creado correctamente.',
            'personal': nuevo_personal.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Error interno del servidor', 'message': str(e)}), 500


@personal_bp.route('', methods=['GET'])
def listar_personal():
    try:
        personal = DimPersonal.query.all()
        return jsonify([p.to_dict() for p in personal]), 200
    except Exception as e:
        return jsonify({'error': 'Error al listar personal', 'message': str(e)}), 500
