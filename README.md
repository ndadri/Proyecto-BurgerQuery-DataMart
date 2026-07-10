# Guía de Despliegue - BurgerQuery OLAP Data Mart

Esta guía explica paso a paso cómo levantar el proyecto desde cero en una máquina nueva para la presentación de clase.

El sistema consta de:
1. **Base de Datos**: PostgreSQL (con dimensiones, tablas de hechos, triggers de conciliación y personal semilla).
2. **Backend**: API REST en Flask (Python) con ORM SQLAlchemy.
3. **Frontend**: Aplicación SPA en Angular 18 (TypeScript) con estilos de diseño Glassmorphism.

---

## Requisitos Previos

Asegúrate de que la nueva máquina tenga instalado lo siguiente:
1. **Python 3.10+** (Asegurar que esté marcado "Add Python to PATH" durante la instalación).
2. **Node.js (v18 o v20)** (Incluye `npm`).
3. **PostgreSQL (v14 o superior)**.

---

## Paso 1: Configurar la Base de Datos (PostgreSQL)

1. Abre **pgAdmin** o la consola de PostgreSQL (`psql`).
2. Crea una base de datos vacía llamada exactamente:
   ```sql
   CREATE DATABASE "BurgerQuery_DataMart";
   ```
3. **Configurar Credenciales en el Backend**:
   Abre el archivo `backend/config.py` y verifica la cadena de conexión en la línea 8. Modifica el usuario y contraseña si son diferentes a los tuyos (por defecto está configurado con `postgres` y `admin123`):
   ```python
   'postgresql+pg8000://[USUARIO]:[CONTRASEÑA]@localhost:5432/BurgerQuery_DataMart'
   ```

*Nota: No es necesario que importes el archivo SQL manualmente ya que el sistema tiene un botón de inicialización automatizada en la interfaz.*

---

## Paso 2: Levantar el Servidor Backend (Flask)

1. Abre una terminal/consola y navega a la carpeta `backend` del proyecto:
   ```bash
   cd backend
   ```
2. Instala las dependencias necesarias de Python:
   ```bash
   pip install -r requirements.txt
   ```
3. Ejecuta el servidor de Flask:
   ```bash
   python app.py
   ```
   *El servidor backend quedará corriendo en `http://localhost:5000`.*

---

## Paso 3: Levantar la Interfaz Frontend (Angular)

1. Abre una **nueva terminal** (dejando la del backend abierta) y navega a la carpeta `frontend`:
   ```bash
   cd frontend
   ```
2. Instala los módulos y dependencias de Node:
   ```bash
   npm install
   ```
3. Inicia el servidor de desarrollo de Angular:
   ```bash
   npm start
   ```
   *(También puedes usar `npx ng serve`).*
4. Abre tu navegador e ingresa a:
   `http://localhost:4200`

---

## Paso 4: Inicialización de Datos (Primer Ingreso)

1. Al abrir `http://localhost:4200`, el navegador te redirigirá a la pantalla de **Login**.
2. Selecciona la pestaña **"Administrador"** (las credenciales se auto-completarán con usuario: `admin` y contraseña: `admin123`).
3. Haz clic en **"Ingresar"**.
4. Dado que la base de datos está vacía, verás un recuadro de advertencia rojo indicando que faltan las tablas. Haz clic en el botón superior derecho: **"Inicializar Tablas DB"**.
5. ¡Listo! El sistema creará automáticamente la estructura física en PostgreSQL, instalará el trigger de stock por sucursal y poblará todos los datos analíticos y semillas.

---

## Credenciales para la Demostración en Clase

Puedes utilizar los siguientes perfiles precargados para demostrar los flujos en clase:

| Rol | Usuario | Contraseña | Sucursal Asignada | Comportamiento en la Demo |
| :--- | :--- | :--- | :--- | :--- |
| **Administrador** | `admin` | `admin123` | *Acceso Global* | Acceso completo a todas las sucursales, visualización global y el botón **"Crear Personal"** en el navbar. |
| **Gerente (La Basílica)** | `adrian_basilica` | `1234` | Sucursal La Basílica | Vistas analíticas y stock bloqueados a la sede La Basílica. Formulario de facturación rápida deshabilitado y fijo en la sede La Basílica. |
| **Gerente (Solanda)** | `andres_solanda` | `1234` | Sucursal Solanda | Vistas analíticas y stock bloqueados a la sede Solanda. Factura únicamente a la sede Solanda. |

### Flujos Recomendados para Presentar:
1. **Flujo de Admin (Creación)**: Inicia como Admin, abre el modal de personal y crea un gerente asignado a la "Sucursal La Carolina" (ej. usuario: `carlos_norte`, clave: `123`).
2. **Flujo de Gerente (Seguridad/Filtros)**: Cierra sesión e ingresa con `adrian_basilica` o el gerente que acabas de crear. Muestra cómo todo el dashboard se restringe a su sucursal de forma automática y segura.
3. **Flujo de Stock por Sucursal (Trigger)**: Registra una venta en el formulario de facturación rápida como gerente y muestra cómo se descuenta el stock de esa sucursal en tiempo real, mientras las demás sucursales conservan intacto su inventario.
4. **Flujo de Conciliación (Edición)**: Regresa al administrador, edita esa venta para reasignarla de sucursal, y enseña cómo el backend concilia automáticamente el inventario sumándolo de vuelta a la sucursal de origen y restándolo de la de destino.
