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
app.register_blueprint(dimensions_bp, url_prefix='/api/dimensiones')
app.register_blueprint(sales_bp, url_prefix='/api/ventas')

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'message': 'Servidor de BurgerQuery_DataMart operando correctamente.'
    }), 200

# Endpoint de inicialización rápida para crear tablas si no existen en PostgreSQL.
# Útil si el usuario quiere que SQLAlchemy cree la base de datos automáticamente.
@app.route('/api/db-init', methods=['POST'])
def db_init():
    try:
        with app.app_context():
            db.create_all()
        return jsonify({'message': 'Tablas creadas o verificadas exitosamente.'}), 200
    except Exception as e:
        return jsonify({'error': 'Error al inicializar la base de datos', 'message': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
