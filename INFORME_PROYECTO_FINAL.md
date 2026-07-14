# INSTITUTO SUPERIOR TECNOLÓGICO QUITO (ITQ)
## TECNOLOGÍA SUPERIOR EN DESARROLLO DE SOFTWARE

---

### PROYECTO FINAL DE ASIGNATURA

* **Asignatura:** Base de Datos II / Sistemas de Información Analíticos (OLAP)
* **Docente:** Ing. Coordinador de Proyecto
* **Estudiante:** Adrian Falcones
* **Periodo Académico:** Abril 2026 – Agosto 2026

---

# ACTIVIDAD PRÁCTICO EXPERIMENTAL EN EL ENTORNO ACADÉMICO

## TEMA: IMPLEMENTACIÓN DE DATA MART ANALÍTICO Y GESTIÓN DE STOCK POR LOTES CON DEDUCCIÓN FEFO Y DESCUENTOS EXCLUSIVOS DE ADMINISTRADOR

### 1. Objetivos
* **Objetivo General:**
  * Implementar un Data Mart interactivo que permita realizar análisis multidimensionales de ventas e inventarios para la cadena BurgerQuery, incorporando un sistema de control de stock por lotes y caducidades con lógica de despacho FEFO (First Expired, First Out) y permisos restringidos de administración de descuentos.
* **Objetivos Específicos:**
  * Rediseñar el esquema físico relacional de la base de datos (PostgreSQL) para dotar de trazabilidad a la bodega mediante códigos de lote y fechas de vencimiento.
  * Programar un disparador (trigger) en PL/pgSQL que automatice el descuento del stock de forma inteligente, priorizando los lotes más próximos a vencer (política FEFO).
  * Desarrollar APIs seguras en el servidor (Flask / Python) que expongan los datos consolidados de inventario y restrinjan la modificación de descuentos únicamente a cuentas con rol de Administrador.
  * Rediseñar la interfaz web (Angular) para agrupar el stock por sucursales y anidarlo por productos, garantizando una visualización clara y libre de redundancias.
  * Automatizar la aplicación de descuentos en el punto de facturación rápida si el lote próximo a caducar cuenta con una rebaja activa.

---

### 2. Antecedentes/Escenario
BurgerQuery es un restaurante de hamburguesas en expansión con sucursales ubicadas en Quito (La Basílica, Cumbayá, La Carolina, Solanda). La toma de decisiones financieras y logísticas requiere de un análisis inmediato del volumen de facturación a través de un Data Mart. 

Sin embargo, uno de los desafíos más críticos radica en la administración de insumos perecederos (carnes, pan, vegetales). La falta de una política clara de rotación de inventarios y de un sistema centralizado de control provoca mermas y desperdicios de materia prima. Para mitigar esta pérdida, el sistema debe alertar al personal sobre lotes cercanos a caducar y permitir que la gerencia comercial (Administrador) aplique descuentos rápidos sobre esos lotes, motivando su venta inmediata. Los gerentes de sucursal deben estar restringidos de configurar estos porcentajes para evitar fraudes o manejos discrecionales, pero el punto de facturación debe aplicar los descuentos de forma automática al cajero.

---

### 3. Recursos Necesarios
* Computadora personal con sistema operativo Windows / Linux.
* Motor de base de datos relacional **PostgreSQL 15+**.
* Entorno de ejecución de backend **Python 3.10+** y framework **Flask** con soporte para ORM SQLAlchemy.
* Entorno de desarrollo frontend **Node.js** y framework **Angular 18 (Standalone Components)**.
* Repositorio de control de versiones **Git** para sincronización de cambios.
* Editor de código (VS Code o IDE compatible).

---

### 4. Planteamiento del Problema
Actualmente, las bases de datos transaccionales tradicionales registran las ventas de forma lineal, pero no ofrecen facilidades de consulta analítica ni de agregación temporal (OLAP). En el ámbito de inventarios, la tabla `Stock_Sucursal` se manejaba como una relación simple de `SucursalKey` y `ProductoKey` con una cantidad estática de stock total. Esto impedía:
1. Conocer qué lote específico y qué fecha de caducidad tiene el insumo físico en la bodega de una sucursal determinada.
2. Garantizar que el stock consumido en una venta corresponda físicamente al insumo que caducará primero (FEFO), lo que genera pérdida de producto por vencimiento.
3. Configurar ofertas temporales basadas en la proximidad de la fecha de caducidad de forma controlada y segura desde el rol administrativo.

Para solucionar esto, se propone una reestructuración de la base de datos, agregando claves primarias compuestas y lógica procedimental autoejecutable (Triggers), soportada por servicios web del lado del servidor e interfaces enriquecidas en el cliente.

---

### 5. Pasos por Realizar
* **Paso 1:** Reestructuración de la tabla `Stock_Sucursal` en el esquema relacional (`db/schema.sql`), incorporando el campo de Lote en la clave primaria y agregando campos de fecha de vencimiento y descuento.
* **Paso 2:** Programación de la función trigger `actualizar_stock_por_venta` en PL/pgSQL para recorrer los lotes disponibles de un producto en orden ascendente de vencimiento (FEFO) y restar cantidades.
* **Paso 3:** Actualización del modelo ORM de base de datos en `models.py` en Flask para representar la nueva estructura de clave compuesta triple.
* **Paso 4:** Desarrollo de endpoints del servidor en `dimensions.py` para consultar stock, reabastecer por lotes y establecer descuentos con verificación de rol `'admin'`.
* **Paso 5:** Modificación del servicio frontend `api.service.ts` en Angular para consumir las nuevas APIs de despacho y descuentos.
* **Paso 6:** Rediseño del componente de Proveedor en Angular (`proveedor.component.ts/.html`) para estructurar los stocks agrupados por sucursal y sub-agrupados por producto con tablas limpias de lotes.
* **Paso 7:** Adición de campos para Lote y Fecha de Vencimiento en el formulario de abastecimiento del proveedor.
* **Paso 8:** Implementación del panel de control de caducidades en el Dashboard del administrador, aplicando filtros para mostrar exclusivamente lotes que vencen en 30 días o menos.
* **Paso 9:** Integración en la Facturación Rápida para pre-cargar descuentos calculados de manera automática en base a lotes en oferta.

---

### 6. Desarrollo

#### Paso 1: Diseño y Modificación del Esquema Físico (SQL)
En `db/schema.sql`, se modificó la estructura de la tabla de inventarios. La columna `"Lote"` pasa a formar parte de la clave primaria para permitir tener múltiples lotes de un mismo producto en una misma sucursal.

```sql
CREATE TABLE "Stock_Sucursal" (
    "SucursalKey" INT REFERENCES "Dim_Sucursal"("SucursalKey"),
    "ProductoKey" INT REFERENCES "Dim_Producto"("ProductoKey"),
    "Lote" VARCHAR(50) NOT NULL,
    "FechaCaducidad" DATE,
    "Stock" INT NOT NULL,
    "DescuentoPorcentaje" INT DEFAULT 0,
    PRIMARY KEY ("SucursalKey", "ProductoKey", "Lote")
);
```

#### Paso 2: Programación de Lógica FEFO mediante Triggers (PL/pgSQL)
Para asegurar que se consuman primero los lotes con la fecha de caducidad más próxima (First Expired, First Out), se redefinió la función disparada por el trigger `trg_descontar_stock`:

```sql
CREATE OR REPLACE FUNCTION actualizar_stock_por_venta()
RETURNS TRIGGER AS $$
DECLARE
    cant_a_descontar INT := NEW."Cantidad";
    r RECORD;
BEGIN
    -- Iterar por los lotes del producto en la sucursal ordenados por fecha de caducidad ascendente
    FOR r IN 
        SELECT "SucursalKey", "ProductoKey", "Lote", "Stock"
        FROM "Stock_Sucursal"
        WHERE "SucursalKey" = NEW."SucursalKey" AND "ProductoKey" = NEW."ProductoKey"
        ORDER BY "FechaCaducidad" ASC NULLS LAST, "Lote" ASC
        FOR UPDATE
    LOOP
        IF cant_a_descontar <= 0 THEN
            EXIT;
        END IF;

        IF r."Stock" >= cant_a_descontar THEN
            -- El lote actual cubre toda la cantidad
            UPDATE "Stock_Sucursal"
            SET "Stock" = "Stock" - cant_a_descontar
            WHERE "SucursalKey" = r."SucursalKey" AND "ProductoKey" = r."ProductoKey" AND "Lote" = r."Lote";
            cant_a_descontar := 0;
        ELSE
            -- El lote actual no abastece el total, se deja en 0 y se continúa con el siguiente lote
            cant_a_descontar := cant_a_descontar - r."Stock";
            UPDATE "Stock_Sucursal"
            SET "Stock" = 0
            WHERE "SucursalKey" = r."SucursalKey" AND "ProductoKey" = r."ProductoKey" AND "Lote" = r."Lote";
        END IF;
    END LOOP;

    -- Si por alguna razón la cantidad supera el stock físico de todos los lotes,
    -- descontar del primer lote (permitiendo stock negativo en el registro)
    IF cant_a_descontar > 0 THEN
        UPDATE "Stock_Sucursal"
        SET "Stock" = "Stock" - cant_a_descontar
        WHERE "SucursalKey" = NEW."SucursalKey" 
          AND "ProductoKey" = NEW."ProductoKey" 
          AND "Lote" = (
              SELECT "Lote" 
              FROM "Stock_Sucursal" 
              WHERE "SucursalKey" = NEW."SucursalKey" AND "ProductoKey" = NEW."ProductoKey"
              ORDER BY "FechaCaducidad" ASC NULLS LAST, "Lote" ASC
              LIMIT 1
          );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### Paso 3: Mapeo ORM en el Servidor (Python / Flask)
En `backend/models.py`, se actualizó el modelo `StockSucursal` para declarar los nuevos atributos relacionales:

```python
class StockSucursal(db.Model):
    __tablename__ = 'Stock_Sucursal'
    
    SucursalKey = db.Column('SucursalKey', db.Integer, db.ForeignKey('Dim_Sucursal.SucursalKey'), primary_key=True)
    ProductoKey = db.Column('ProductoKey', db.Integer, db.ForeignKey('Dim_Producto.ProductoKey'), primary_key=True)
    Lote = db.Column('Lote', db.String(50), primary_key=True)
    FechaCaducidad = db.Column('FechaCaducidad', db.Date, nullable=True)
    Stock = db.Column('Stock', db.Integer, nullable=False)
    DescuentoPorcentaje = db.Column('DescuentoPorcentaje', db.Integer, default=0)
    
    sucursal = db.relationship('DimSucursal', backref='stocks')
    producto = db.relationship('DimProducto', backref='stocks')
    
    def to_dict(self):
        return {
            'SucursalKey': self.SucursalKey,
            'ProductoKey': self.ProductoKey,
            'Lote': self.Lote,
            'FechaCaducidad': self.FechaCaducidad.isoformat() if self.FechaCaducidad else None,
            'Stock': self.Stock,
            'DescuentoPorcentaje': self.DescuentoPorcentaje,
            'Producto': self.producto.to_dict() if self.producto else None,
            'Sucursal': self.sucursal.to_dict() if self.sucursal else None
        }
```

#### Paso 4: APIs Backend de Consulta, Despacho y Descuentos
En `backend/routes/dimensions.py`, se implementaron las siguientes rutas críticas:

* **Agregación de Stock y Selección de Lote para Ventas (`/productos`):**
  Suma el stock de todos los lotes de un producto y extrae la información del lote que caducará primero para aplicar promociones en la factura:

```python
@dimensions_bp.route('/productos', methods=['GET'])
def get_productos():
    try:
        sucursal_key = request.args.get('sucursalKey', type=int)
        productos = DimProducto.query.all()
        result = []
        for p in productos:
            d = p.to_dict()
            if sucursal_key:
                # Sumatoria del stock de todos los lotes
                total_stock = db.session.query(func.sum(StockSucursal.Stock)).filter_by(SucursalKey=sucursal_key, ProductoKey=p.ProductoKey).scalar()
                d['Stock'] = int(total_stock) if total_stock is not None else 0
                
                # Obtener el lote más próximo a caducar que tenga stock
                next_batch = StockSucursal.query.filter(
                    StockSucursal.SucursalKey == sucursal_key,
                    StockSucursal.ProductoKey == p.ProductoKey,
                    StockSucursal.Stock > 0
                ).order_by(StockSucursal.FechaCaducidad.asc()).first()
                
                if next_batch:
                    d['DescuentoPorcentaje'] = next_batch.DescuentoPorcentaje
                    d['LoteProximaCaducidad'] = next_batch.Lote
                    d['FechaCaducidadProxima'] = next_batch.FechaCaducidad.isoformat() if next_batch.FechaCaducidad else None
                else:
                    d['DescuentoPorcentaje'] = 0
                    d['LoteProximaCaducidad'] = None
                    d['FechaCaducidadProxima'] = None
            else:
                total_stock = db.session.query(func.sum(StockSucursal.Stock)).filter_by(ProductoKey=p.ProductoKey).scalar()
                d['Stock'] = int(total_stock) if total_stock is not None else 0
                d['DescuentoPorcentaje'] = 0
                d['LoteProximaCaducidad'] = None
                d['FechaCaducidadProxima'] = None
            result.append(d)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': 'Error al obtener productos', 'message': str(e)}), 500
```

* **Control de Acceso y Aplicación de Descuentos (`/stock/discount`):**
  Ruta protegida que valida que el rol del solicitante sea `'admin'` antes de persistir una rebaja en base de datos.

```python
@dimensions_bp.route('/stock/discount', methods=['POST'])
def set_stock_discount():
    try:
        data = request.get_json() or {}
        sucursal_key = data.get('sucursalKey')
        producto_key = data.get('productoKey')
        lote = data.get('lote')
        descuento = data.get('descuentoPorcentaje', 0)
        role = data.get('role')

        # Restricción de seguridad
        if role != 'admin':
            return jsonify({'error': 'No autorizado', 'message': 'Solo el Administrador puede aplicar descuentos.'}), 403

        stock_entry = StockSucursal.query.filter_by(
            SucursalKey=sucursal_key,
            ProductoKey=producto_key,
            Lote=lote
        ).first()

        if not stock_entry:
            return jsonify({'error': 'No encontrado', 'message': 'No se encontró el lote especificado.'}), 404

        stock_entry.DescuentoPorcentaje = int(descuento)
        db.session.commit()
        return jsonify({'message': f'Descuento del {descuento}% aplicado con éxito al lote {lote}.'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Error al configurar descuento', 'message': str(e)}), 500
```

#### Paso 5: Consumo en la Capa Angular (Frontend)
En `frontend/src/app/services/api.service.ts`, se mapearon las peticiones AJAX en Angular:

```typescript
  supplyStock(sucursalKey: number, productoKey: number, cantidad: number, lote?: string, fechaCaducidad?: string): Observable<{ message: string; stock: number }> {
    return this.http.post<{ message: string; stock: number }>(`${this.baseUrl}/dimensiones/stock/supply`, {
      sucursalKey,
      productoKey,
      cantidad,
      lote,
      fechaCaducidad
    });
  }

  applyStockDiscount(sucursalKey: number, productoKey: number, lote: string, descuentoPorcentaje: number, role: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/dimensiones/stock/discount`, {
      sucursalKey,
      productoKey,
      lote,
      descuentoPorcentaje,
      role
    });
  }
```

#### Paso 6: Agrupación y Visualización por Sucursal y Producto
En `proveedor.component.ts`, se diseñó el getter agrupador multidimensional:

```typescript
  get stocksPorSucursal() {
    const grouped: { 
      [key: string]: { 
        nombre: string; 
        productos: {
          nombre: string;
          categoria: string;
          totalStock: number;
          lotes: any[];
        }[];
      } 
    } = {};
    
    this.stocks.forEach(item => {
      const sucKey = item.nombreSucursal;
      if (!grouped[sucKey]) {
        grouped[sucKey] = { nombre: item.nombreSucursal, productos: [] };
      }
      
      let prodGroup = grouped[sucKey].productos.find(p => p.nombre === item.nombreProducto);
      if (!prodGroup) {
        prodGroup = {
          nombre: item.nombreProducto,
          categoria: item.categoria,
          totalStock: 0,
          lotes: []
        };
        grouped[sucKey].productos.push(prodGroup);
      }
      
      prodGroup.totalStock += item.stock;
      prodGroup.lotes.push({
        lote: item.lote,
        fechaCaducidad: item.fechaCaducidad,
        stock: item.stock,
        descuentoPorcentaje: item.descuentoPorcentaje
      });
    });
    
    // Filtrar por sucursal según el selector dropdown de la vista
    let filtered = Object.values(grouped);
    if (this.sucursalFiltro !== 'all') {
      filtered = filtered.filter(suc => suc.nombre === this.sucursalFiltro);
    }
    
    return filtered;
  }
```

La interfaz gráfica `proveedor.component.html` renderiza de la siguiente forma estructurada:
* Una barra superior de filtros que permite alternar la vista entre una sucursal individual o todas ellas.
* Tarjetas para cada producto con el acumulado de unidades físicas.
* Una subtabla con el detalle de cada lote.

#### Paso 7: Filtrado Dinámico de Lotes Próximos a Caducar en Dashboard
En `dashboard.component.ts`, el sistema lee la fecha actual de la máquina y restringe la lista del panel a aquellos lotes cuyo vencimiento esté dentro de los próximos 30 días:

```typescript
  cargarCaducidades(): void {
    this.apiService.getAllStocks().subscribe({
      next: (data) => {
        const hoy = new Date();
        this.stocksExpiring = data
          .filter(item => {
            if (!item.fechaCaducidad || item.stock <= 0) return false;
            const expDate = new Date(item.fechaCaducidad);
            const diffTime = expDate.getTime() - hoy.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays <= 30; // Filtra de forma automática (30 días o menos)
          })
          .sort((a, b) => new Date(a.fechaCaducidad).getTime() - new Date(b.fechaCaducidad).getTime());
      },
      error: (err) => console.error('Error al obtener stock para caducidad:', err)
    });
  }
```

---

### 7. Observaciones y Conclusiones

* **Rotación Eficiente mediante FEFO:**
  La lógica de bases de datos implementada a nivel de trigger permite garantizar que el sistema siempre despache del lote con menor expectativa de vida en bodega. Esto elimina la necesidad de intervención manual por parte de los operarios de caja al registrar ventas.
* **Seguridad de Operaciones Críticas (Control de Roles):**
  La separación física de interfaces y la validación en backend del rol del usuario garantizan que los gerentes locales (`gerente`) no puedan manipular la rentabilidad de los productos aplicando rebajas discrecionales, centralizando esta facultad en el Administrador General (`admin`).
* **Calidad de Diseño y Visualización de Datos:**
  La división de inventarios en tarjetas anidadas por producto, complementada con el selector de sucursal individual, eliminó por completo la polución de datos y duplicidad de textos, logrando una interfaz intuitiva y apta para operaciones en tiempo real en la cadena de restaurantes BurgerQuery.

