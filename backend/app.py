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
# Útil si el usuario quiere que SQLAlchemy cree la base de datos automáticamente.
@app.route('/api/db-init', methods=['POST'])
def db_init():
    try:
        from models import StockSucursal, DimPersonal
        with app.app_context():
            db.create_all()
            
            # Crear/redefinir trigger para actualizar stock por sucursal
            db.session.execute(db.text("""
                CREATE OR REPLACE FUNCTION actualizar_stock_por_venta()
                RETURNS TRIGGER AS $$
                BEGIN
                    UPDATE "Stock_Sucursal"
                    SET "Stock" = "Stock" - NEW."Cantidad"
                    WHERE "SucursalKey" = NEW."SucursalKey" AND "ProductoKey" = NEW."ProductoKey";
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;
            """))
            db.session.commit()
            
            # Poblar datos semilla si la tabla está vacía
            if StockSucursal.query.count() == 0:
                initial_stocks = {
                    1: 150, # Hamburguesa Doble Queso
                    2: 120, # Hamburguesa de Pollo Crispy
                    3: 300, # Papas Fritas Medianas
                    4: 200, # Nuggets de Pollo
                    5: 500, # Refresco de Cola Grande
                    6: 80   # Malteada de Vainilla
                }
                # Ratios de distribución para sucursales 1, 2, 3 y 4
                ratios = {1: 0.4, 2: 0.3, 3: 0.2, 4: 0.1}
                for prod_key, total in initial_stocks.items():
                    for suc_key, ratio in ratios.items():
                        stock_val = int(total * ratio)
                        db.session.add(StockSucursal(SucursalKey=suc_key, ProductoKey=prod_key, Stock=stock_val))
                db.session.commit()

            # Poblar personal semilla si la tabla de personal está vacía
            if DimPersonal.query.count() == 0:
                db.session.add(DimPersonal(Nombre='Juan', Apellido='Pérez', Usuario='juan_centro', Contrasena='1234', SucursalKey=1))
                db.session.add(DimPersonal(Nombre='María', Apellido='Gómez', Usuario='maria_playas', Contrasena='5678', SucursalKey=4))
                db.session.commit()
                
        return jsonify({'message': 'Base de datos inicializada con stock por sucursal y trigger activo.'}), 200
    except Exception as e:
        return jsonify({'error': 'Error al inicializar la base de datos', 'message': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
