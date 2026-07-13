import os

class Config:
    # URL de conexión por defecto a PostgreSQL.
    # El usuario puede modificar las credenciales aquí si es necesario.
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        'postgresql+pg8000://postgres:admin123@localhost:5432/BurgerQuery_DataMart'
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = os.environ.get('SECRET_KEY', 'burgerquery-super-secret-key')
