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

-- Función del Trigger para actualizar stock automáticamente
CREATE OR REPLACE FUNCTION actualizar_stock_por_venta()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE "Dim_Producto"
    SET "Stock" = "Stock" - NEW."Cantidad"
    WHERE "ProductoKey" = NEW."ProductoKey";
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
(301, 'Sucursal Centro', 'San José'),
(302, 'Sucursal Plaza Este', 'San José'),
(303, 'Sucursal Norte', 'Alajuela'),
(304, 'Sucursal Playas', 'Puntarenas');

INSERT INTO "Dim_Tiempo" ("TiempoKey", "Fecha", "Dia", "Mes", "NombreMes", "Anio", "Trimestre") VALUES
(20260701, '2026-07-01', 1, 7, 'Julio', 2026, 3),
(20260702, '2026-07-02', 2, 7, 'Julio', 2026, 3),
(20260703, '2026-07-03', 3, 7, 'Julio', 2026, 3),
(20260704, '2026-07-04', 4, 7, 'Julio', 2026, 3),
(20260705, '2026-07-05', 5, 7, 'Julio', 2026, 3),
(20260706, '2026-07-06', 6, 7, 'Julio', 2026, 3),
(20260707, '2026-07-07', 7, 7, 'Julio', 2026, 3),
(20260708, '2026-07-08', 8, 7, 'Julio', 2026, 3);

INSERT INTO "Fact_Ventas" ("TiempoKey", "ProductoKey", "ClienteKey", "SucursalKey", "Cantidad", "PrecioAplicado", "MontoTotal", "Descuento", "Hora") VALUES
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

