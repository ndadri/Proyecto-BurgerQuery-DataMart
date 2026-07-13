-- ==========================================
-- ESTRUCTURA DE LA BASE DE DATOS POSTGRESQL
-- Data Mart OLAP: BurgerQuery_DataMart
-- ==========================================

-- Nota: Si es necesario crear la base de datos ejecute:
-- CREATE DATABASE "BurgerQuery_DataMart";

-- Dimensiones con nombres exactos y comillas dobles para capitalización
CREATE TABLE "Dim_Producto" (
    "ProductoKey" SERIAL PRIMARY KEY,
    "ProductoID" INT NOT NULL,
    "Nombre" VARCHAR(100) NOT NULL,
    "Categoria" VARCHAR(50),
    "PrecioUnitario" NUMERIC(10, 2) NOT NULL,
    "Stock" INT NOT NULL
);

CREATE TABLE "Dim_Cliente" (
    "ClienteKey" SERIAL PRIMARY KEY,
    "ClienteID" INT NOT NULL,
    "NombreCompleto" VARCHAR(150) NOT NULL,
    "TipoCliente" VARCHAR(50)
);

CREATE TABLE "Dim_Tiempo" (
    "TiempoKey" INT PRIMARY KEY, -- Formato YYYYMMDD
    "Fecha" DATE NOT NULL UNIQUE,
    "Dia" INT NOT NULL,
    "Mes" INT NOT NULL,
    "NombreMes" VARCHAR(20) NOT NULL,
    "Anio" INT NOT NULL,
    "Trimestre" INT NOT NULL
);

CREATE TABLE "Dim_Sucursal" (
    "SucursalKey" SERIAL PRIMARY KEY,
    "SucursalID" INT NOT NULL,
    "NombreSucursal" VARCHAR(100) NOT NULL,
    "Ciudad" VARCHAR(100)
);

CREATE TABLE "Stock_Sucursal" (
    "SucursalKey" INT REFERENCES "Dim_Sucursal"("SucursalKey"),
    "ProductoKey" INT REFERENCES "Dim_Producto"("ProductoKey"),
    "Lote" VARCHAR(50) NOT NULL,
    "FechaCaducidad" DATE,
    "Stock" INT NOT NULL,
    "DescuentoPorcentaje" INT DEFAULT 0,
    PRIMARY KEY ("SucursalKey", "ProductoKey", "Lote")
);

CREATE TABLE "Dim_Personal" (
    "PersonalKey" SERIAL PRIMARY KEY,
    "Nombre" VARCHAR(100) NOT NULL,
    "Apellido" VARCHAR(100) NOT NULL,
    "Usuario" VARCHAR(50) UNIQUE NOT NULL,
    "Contrasena" VARCHAR(100) NOT NULL,
    "SucursalKey" INT NOT NULL REFERENCES "Dim_Sucursal"("SucursalKey")
);

-- Tabla de Hechos
CREATE TABLE "Fact_Ventas" (
    "VentaID" SERIAL PRIMARY KEY,
    "TiempoKey" INT NOT NULL REFERENCES "Dim_Tiempo"("TiempoKey"),
    "ProductoKey" INT NOT NULL REFERENCES "Dim_Producto"("ProductoKey"),
    "ClienteKey" INT NOT NULL REFERENCES "Dim_Cliente"("ClienteKey"),
    "SucursalKey" INT NOT NULL REFERENCES "Dim_Sucursal"("SucursalKey"),
    "Cantidad" INT NOT NULL,
    "PrecioAplicado" NUMERIC(10, 2) NOT NULL,
    "MontoTotal" NUMERIC(10, 2) NOT NULL,
    "Descuento" NUMERIC(10, 2) DEFAULT 0.00,
    "Hora" INT NOT NULL DEFAULT 12
);

-- Función del Trigger para actualizar stock automáticamente usando FEFO (First Expired, First Out)
CREATE OR REPLACE FUNCTION actualizar_stock_por_venta()
RETURNS TRIGGER AS $$
DECLARE
    cant_a_descontar INT := NEW."Cantidad";
    r RECORD;
BEGIN
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
            UPDATE "Stock_Sucursal"
            SET "Stock" = "Stock" - cant_a_descontar
            WHERE "SucursalKey" = r."SucursalKey" AND "ProductoKey" = r."ProductoKey" AND "Lote" = r."Lote";
            cant_a_descontar := 0;
        ELSE
            cant_a_descontar := cant_a_descontar - r."Stock";
            UPDATE "Stock_Sucursal"
            SET "Stock" = 0
            WHERE "SucursalKey" = r."SucursalKey" AND "ProductoKey" = r."ProductoKey" AND "Lote" = r."Lote";
        END IF;
    END LOOP;

    -- Si aún queda cantidad por descontar, descontar del primer lote (para permitir stock negativo si no hay suficiente)
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

-- Crear Trigger
CREATE TRIGGER trg_descontar_stock
AFTER INSERT ON "Fact_Ventas"
FOR EACH ROW
EXECUTE FUNCTION actualizar_stock_por_venta();

-- ==========================================
-- DATOS SEMILLA PARA LAS DIMENSIONES
-- ==========================================

INSERT INTO "Dim_Producto" ("ProductoID", "Nombre", "Categoria", "PrecioUnitario", "Stock") VALUES
(101, 'Hamburguesa Doble Queso', 'Hamburguesas', 5.99, 150),
(102, 'Hamburguesa de Pollo Crispy', 'Hamburguesas', 6.49, 120),
(103, 'Papas Fritas Medianas', 'Acompañamientos', 2.49, 300),
(104, 'Nuggets de Pollo (10 unidades)', 'Acompañamientos', 4.99, 200),
(105, 'Refresco de Cola Grande', 'Bebidas', 1.99, 500),
(106, 'Malteada de Vainilla', 'Postres', 3.49, 80);

INSERT INTO "Dim_Cliente" ("ClienteID", "NombreCompleto", "TipoCliente") VALUES
(201, 'Juan Pérez', 'Frecuente'),
(202, 'María Rodríguez', 'VIP'),
(203, 'Carlos Mendoza', 'Regular'),
(204, 'Ana Gómez', 'Regular'),
(205, 'Consumidor Final', 'General');

INSERT INTO "Dim_Sucursal" ("SucursalID", "NombreSucursal", "Ciudad") VALUES
(301, 'Sucursal La Basílica', 'Quito'),
(302, 'Sucursal Cumbayá', 'Quito'),
(303, 'Sucursal La Carolina', 'Quito'),
(304, 'Sucursal Solanda', 'Quito');

INSERT INTO "Dim_Tiempo" ("TiempoKey", "Fecha", "Dia", "Mes", "NombreMes", "Anio", "Trimestre") VALUES
(20260115, '2026-01-15', 15, 1, 'Enero', 2026, 1),
(20260215, '2026-02-15', 15, 2, 'Febrero', 2026, 1),
(20260315, '2026-03-15', 15, 3, 'Marzo', 2026, 1),
(20260415, '2026-04-15', 15, 4, 'Abril', 2026, 2),
(20260515, '2026-05-15', 15, 5, 'Mayo', 2026, 2),
(20260615, '2026-06-15', 15, 6, 'Junio', 2026, 2),
(20260701, '2026-07-01', 1, 7, 'Julio', 2026, 3),
(20260702, '2026-07-02', 2, 7, 'Julio', 2026, 3),
(20260703, '2026-07-03', 3, 7, 'Julio', 2026, 3),
(20260704, '2026-07-04', 4, 7, 'Julio', 2026, 3),
(20260705, '2026-07-05', 5, 7, 'Julio', 2026, 3),
(20260706, '2026-07-06', 6, 7, 'Julio', 2026, 3),
(20260707, '2026-07-07', 7, 7, 'Julio', 2026, 3),
(20260708, '2026-07-08', 8, 7, 'Julio', 2026, 3);

INSERT INTO "Fact_Ventas" ("TiempoKey", "ProductoKey", "ClienteKey", "SucursalKey", "Cantidad", "PrecioAplicado", "MontoTotal", "Descuento", "Hora") VALUES
-- Enero 2026
(20260115, 1, 1, 1, 10, 5.99, 59.90, 0.00, 12),
(20260115, 3, 2, 2, 15, 2.49, 37.35, 0.00, 13),
(20260115, 5, 3, 3, 20, 1.99, 39.80, 0.00, 14),
-- Febrero 2026
(20260215, 2, 4, 2, 12, 6.49, 77.88, 0.00, 12),
(20260215, 4, 5, 4, 8, 4.99, 39.92, 0.00, 13),
(20260215, 5, 1, 1, 15, 1.99, 29.85, 0.00, 15),
(20260215, 6, 2, 3, 5, 3.49, 17.45, 0.00, 16),
-- Marzo 2026
(20260315, 1, 3, 3, 20, 5.99, 119.80, 0.00, 12),
(20260315, 3, 4, 1, 25, 2.49, 62.25, 0.00, 13),
(20260315, 5, 5, 2, 30, 1.99, 59.70, 0.00, 14),
(20260315, 6, 1, 4, 10, 3.49, 34.90, 0.00, 17),
-- Abril 2026
(20260415, 2, 2, 4, 18, 6.49, 116.82, 0.00, 12),
(20260415, 3, 3, 3, 20, 2.49, 49.80, 0.00, 13),
(20260415, 4, 4, 2, 12, 4.99, 59.88, 0.00, 15),
(20260415, 5, 5, 1, 25, 1.99, 49.75, 0.00, 16),
-- Mayo 2026
(20260515, 1, 1, 1, 25, 5.99, 149.75, 0.00, 12),
(20260515, 2, 2, 2, 15, 6.49, 97.35, 0.00, 13),
(20260515, 3, 3, 3, 30, 2.49, 74.70, 0.00, 14),
(20260515, 5, 4, 4, 40, 1.99, 79.60, 0.00, 15),
(20260515, 6, 5, 1, 15, 3.49, 52.35, 0.00, 16),
-- Junio 2026
(20260615, 1, 2, 3, 35, 5.99, 209.65, 0.00, 12),
(20260615, 2, 3, 2, 25, 6.49, 162.25, 0.00, 13),
(20260615, 3, 4, 1, 40, 2.49, 99.60, 0.00, 14),
(20260615, 4, 5, 4, 15, 4.99, 74.85, 0.00, 16),
(20260615, 5, 1, 2, 50, 1.99, 99.50, 0.00, 17),
(20260615, 6, 2, 3, 20, 3.49, 69.80, 0.00, 18),
-- Julio 2026 (existentes)
(20260706, 1, 1, 1, 2, 5.99, 11.98, 0.00, 12),
(20260706, 3, 2, 1, 1, 2.49, 2.49, 0.00, 13),
(20260706, 5, 3, 2, 2, 1.99, 3.98, 0.00, 13),
(20260706, 2, 4, 3, 1, 6.49, 6.49, 0.00, 20),
(20260707, 1, 5, 2, 1, 5.99, 5.99, 0.00, 12),
(20260707, 4, 1, 1, 2, 4.99, 9.98, 0.00, 19),
(20260707, 6, 2, 4, 1, 3.49, 3.49, 0.00, 20),
(20260708, 2, 3, 2, 2, 6.49, 12.98, 0.00, 13),
(20260708, 3, 4, 3, 1, 2.49, 2.49, 0.00, 14),
(20260708, 1, 5, 1, 1, 5.99, 4.99, 1.00, 21),
(20260702, 1, 2, 3, 3, 5.99, 17.97, 0.00, 13),
(20260702, 5, 3, 4, 2, 1.99, 3.98, 0.00, 19),
(20260702, 2, 1, 1, 1, 6.49, 6.49, 0.00, 21),
(20260703, 1, 4, 1, 4, 5.99, 23.96, 0.00, 13),
(20260703, 3, 5, 2, 3, 2.49, 7.47, 0.00, 13),
(20260703, 2, 1, 3, 2, 6.49, 12.98, 0.00, 18),
(20260703, 5, 2, 4, 5, 1.99, 9.95, 0.00, 20),
(20260703, 1, 3, 2, 2, 5.99, 11.98, 0.00, 21),
(20260703, 4, 4, 1, 2, 4.99, 9.98, 0.00, 22),
(20260704, 1, 5, 1, 3, 5.99, 17.97, 0.00, 12),
(20260704, 2, 1, 2, 4, 6.49, 25.96, 0.00, 13),
(20260704, 3, 2, 3, 5, 2.49, 12.45, 0.00, 13),
(20260704, 5, 3, 4, 4, 1.99, 7.96, 0.00, 14),
(20260704, 4, 4, 1, 2, 4.99, 9.98, 0.00, 19),
(20260704, 1, 5, 2, 5, 5.99, 29.95, 0.00, 20),
(20260704, 2, 1, 3, 3, 6.49, 19.47, 0.00, 20),
(20260704, 6, 2, 4, 2, 3.49, 6.98, 0.00, 21),
(20260704, 3, 3, 1, 3, 2.49, 7.47, 0.00, 22),
(20260705, 1, 4, 2, 2, 5.99, 11.98, 0.00, 12),
(20260705, 2, 5, 3, 3, 6.49, 19.47, 0.00, 13),
(20260705, 4, 1, 4, 2, 4.99, 9.98, 0.00, 13),
(20260705, 5, 2, 1, 4, 1.99, 7.96, 0.00, 19),
(20260705, 1, 3, 2, 4, 5.99, 23.96, 0.00, 20),
(20260705, 6, 4, 3, 3, 3.49, 10.47, 0.00, 20),
(20260705, 3, 5, 4, 2, 2.49, 4.98, 0.00, 21);


-- ==========================================
-- DATOS SEMILLA PARA STOCK POR SUCURSAL
-- ==========================================

INSERT INTO "Stock_Sucursal" ("SucursalKey", "ProductoKey", "Lote", "FechaCaducidad", "Stock", "DescuentoPorcentaje") VALUES
-- Producto 1 (Hamburguesa Doble Queso)
(1, 1, 'L-H101', '2026-07-25', 40, 0),
(1, 1, 'L-H102', '2026-09-15', 20, 0),
(2, 1, 'L-H101', '2026-07-25', 30, 0),
(2, 1, 'L-H102', '2026-09-15', 15, 0),
(3, 1, 'L-H101', '2026-07-25', 20, 0),
(3, 1, 'L-H102', '2026-09-15', 10, 0),
(4, 1, 'L-H101', '2026-07-25', 10, 0),
(4, 1, 'L-H102', '2026-09-15', 5, 0),

-- Producto 2 (Hamburguesa de Pollo Crispy)
(1, 2, 'L-P201', '2026-07-20', 30, 20), -- Lote próximo a caducar con 20% de descuento
(1, 2, 'L-P202', '2026-10-01', 18, 0),
(2, 2, 'L-P201', '2026-07-20', 20, 0),
(2, 2, 'L-P202', '2026-10-01', 16, 0),
(3, 2, 'L-P201', '2026-07-20', 14, 0),
(3, 2, 'L-P202', '2026-10-01', 10, 0),
(4, 2, 'L-P201', '2026-07-20', 8, 0),
(4, 2, 'L-P202', '2026-10-01', 4, 0),

-- Producto 3 (Papas Fritas Medianas)
(1, 3, 'L-PF301', '2026-08-05', 80, 0),
(1, 3, 'L-PF302', '2026-11-15', 40, 0),
(2, 3, 'L-PF301', '2026-08-05', 60, 0),
(2, 3, 'L-PF302', '2026-11-15', 30, 0),
(3, 3, 'L-PF301', '2026-08-05', 40, 0),
(3, 3, 'L-PF302', '2026-11-15', 20, 0),
(4, 3, 'L-PF301', '2026-08-05', 20, 0),
(4, 3, 'L-PF302', '2026-11-15', 10, 0),

-- Producto 4 (Nuggets de Pollo)
(1, 4, 'L-N401', '2026-07-28', 50, 0),
(1, 4, 'L-N402', '2026-10-10', 30, 0),
(2, 4, 'L-N401', '2026-07-28', 40, 0),
(2, 4, 'L-N402', '2026-10-10', 20, 0),
(3, 4, 'L-N401', '2026-07-28', 25, 0),
(3, 4, 'L-N402', '2026-10-10', 15, 0),
(4, 4, 'L-N401', '2026-07-28', 12, 0),
(4, 4, 'L-N402', '2026-10-10', 8, 0),

-- Producto 5 (Refresco de Cola Grande)
(1, 5, 'L-R501', '2026-12-31', 200, 0),
(2, 5, 'L-R501', '2026-12-31', 150, 0),
(3, 5, 'L-R501', '2026-12-31', 100, 0),
(4, 5, 'L-R501', '2026-12-31', 50, 0),

-- Producto 6 (Malteada de Vainilla)
(1, 6, 'L-M601', '2026-07-22', 20, 0),
(1, 6, 'L-M602', '2026-09-01', 12, 0),
(2, 6, 'L-M601', '2026-07-22', 15, 0),
(2, 6, 'L-M602', '2026-09-01', 9, 0),
(3, 6, 'L-M601', '2026-07-22', 10, 0),
(3, 6, 'L-M602', '2026-09-01', 6, 0),
(4, 6, 'L-M601', '2026-07-22', 5, 0),
(4, 6, 'L-M602', '2026-09-01', 3, 0);


-- ==========================================
-- DATOS SEMILLA PARA PERSONAL DE VENTAS
-- ==========================================

INSERT INTO "Dim_Personal" ("Nombre", "Apellido", "Usuario", "Contrasena", "SucursalKey") VALUES
('Adrian', 'Falcones', 'adrian_basilica', '1234', 1),
('Anderson', 'Soto', 'anderson_cumbaya', '1234', 2),
('Martin', 'Rodriguez', 'martin_carolina', '1234', 3),
('Andres', 'Ortiz', 'andres_solanda', '1234', 4);

