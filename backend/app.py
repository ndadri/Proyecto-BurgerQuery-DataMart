from flask import Flask, jsonify
from flask_cors import CORS
from config import Config
from models import db
from routes.dimensions import dimensions_bp
from routes.sales import sales_bp

app = Flask(__name__)
app.config.from_object(Config)

# Inicializar SQLAlchemy
db.init_app(app)

# Configuración estricta de CORS para http://localhost:4200
CORS(app, resources={r"/api/*": {"origins": "http://localhost:4200"}})

# Registro de Blueprints
from routes.auth import auth_bp
from routes.personal import personal_bp

app.register_blueprint(dimensions_bp, url_prefix='/api/dimensiones')
app.register_blueprint(sales_bp, url_prefix='/api/ventas')
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(personal_bp, url_prefix='/api/personal')

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'message': 'Servidor de BurgerQuery_DataMart operando correctamente.'
    }), 200

# Endpoint de inicialización rápida para crear tablas si no existen en PostgreSQL.
# Lee y ejecuta el script schema.sql directamente para poblar todas las dimensiones y datos semilla de forma consistente.
@app.route('/api/db-init', methods=['POST'])
def db_init():
    try:
        import os
        schema_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'db', 'schema.sql')
        if not os.path.exists(schema_path):
            return jsonify({
                'error': 'No se encontró el archivo schema.sql', 
                'message': f'Ruta buscada: {schema_path}'
            }), 404
            
        with open(schema_path, 'r', encoding='utf-8') as f:
            sql_content = f.read()
            
        # Conectar usando la conexión cruda para evitar que SQLAlchemy interprete los ":" en comentarios y bloques de triggers
        connection = db.engine.raw_connection()
        try:
            cursor = connection.cursor()
            
            # Limpiar tablas en orden inverso para evitar conflictos de claves foráneas
            drop_statements = [
                'DROP TABLE IF EXISTS "Fact_Ventas" CASCADE;',
                'DROP TABLE IF EXISTS "Dim_Personal" CASCADE;',
                'DROP TABLE IF EXISTS "Stock_Sucursal" CASCADE;',
                'DROP TABLE IF EXISTS "Dim_Tiempo" CASCADE;',
                'DROP TABLE IF EXISTS "Dim_Sucursal" CASCADE;',
                'DROP TABLE IF EXISTS "Dim_Cliente" CASCADE;',
                'DROP TABLE IF EXISTS "Dim_Producto" CASCADE;'
            ]
            for drop_stmt in drop_statements:
                cursor.execute(drop_stmt)
                
            # Ejecutar todo el script de creación y población
            cursor.execute(sql_content)
            connection.commit()
        finally:
            cursor.close()
            connection.close()
            
        return jsonify({'message': 'Base de datos inicializada con stock por sucursal, trigger activo y todos los datos semilla.'}), 200
    except Exception as e:
        return jsonify({'error': 'Error al inicializar la base de datos', 'message': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
