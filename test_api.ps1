# ==========================================
# SCRIPT DE PRUEBA DE LA API - BURGERQUERY
# ==========================================

$baseUrl = "http://localhost:5000"

Write-Host "1. Verificando estado del servidor..." -ForegroundColor Cyan
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get
    Write-Host "Backend en línea: $($health.message)" -ForegroundColor Green
} catch {
    Write-Host "El backend no está respondiendo. Inícielo con 'python app.py' en la carpeta backend." -ForegroundColor Red
    exit
}

Write-Host "`n2. Inicializando Base de Datos (Creando tablas)..." -ForegroundColor Cyan
try {
    $init = Invoke-RestMethod -Uri "$baseUrl/api/db-init" -Method Post
    Write-Host "Inicialización: $($init.message)" -ForegroundColor Green
} catch {
    Write-Host "Error al inicializar la base de datos. Verifique que PostgreSQL esté corriendo y las credenciales en config.py sean correctas." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit
}

Write-Host "`n3. Consultando Dimensiones cargadas..." -ForegroundColor Cyan
try {
    $productos = Invoke-RestMethod -Uri "$baseUrl/api/dimensiones/productos" -Method Get
    Write-Host "Productos encontrados: $($productos.Count)" -ForegroundColor Green
    foreach ($p in $productos | Select-Object -First 3) {
        Write-Host " - ID: $($p.ProductoID) | $($p.Nombre) | Stock: $($p.Stock) | Precio: $($p.PrecioUnitario)" -ForegroundColor Yellow
    }
    
    $clientes = Invoke-RestMethod -Uri "$baseUrl/api/dimensiones/clientes" -Method Get
    Write-Host "Clientes encontrados: $($clientes.Count)" -ForegroundColor Green
    
    $sucursales = Invoke-RestMethod -Uri "$baseUrl/api/dimensiones/sucursales" -Method Get
    Write-Host "Sucursales encontradas: $($sucursales.Count)" -ForegroundColor Green
} catch {
    Write-Host "Error al obtener dimensiones." -ForegroundColor Red
    Write-Host $_.Exception.Message
}

Write-Host "`n4. Intentando registrar una venta en Fact_Ventas..." -ForegroundColor Cyan
# Tomar el primer producto, primer cliente y primer sucursal
if ($productos.Count -gt 0 -and $clientes.Count -gt 0 -and $sucursales.Count -gt 0) {
    $prodKey = $productos[0].ProductoKey
    $cliKey = $clientes[0].ClienteKey
    $sucKey = $sucursales[0].SucursalKey
    
    $body = @{
        ProductoKey = $prodKey
        ClienteKey = $cliKey
        SucursalKey = $sucKey
        Cantidad = 2
        Descuento = 1.50
        Fecha = (Get-Date).ToString("yyyy-MM-dd")
    } | ConvertTo-Json

    try {
        $ventaResult = Invoke-RestMethod -Uri "$baseUrl/api/ventas" -Method Post -Body $body -ContentType "application/json"
        Write-Host "Venta registrada con éxito: $($ventaResult.message)" -ForegroundColor Green
        Write-Host "Monto Total de Venta: $($ventaResult.venta.MontoTotal)" -ForegroundColor Yellow
        
        # Verificar que el stock haya bajado (gracias al trigger de base de datos)
        $productosActualizados = Invoke-RestMethod -Uri "$baseUrl/api/dimensiones/productos" -Method Get
        $prodOriginal = $productos[0]
        $prodActualizado = $productosActualizados | Where-Object { $_.ProductoKey -eq $prodKey }
        Write-Host "Verificación de Trigger de Stock:" -ForegroundColor Cyan
        Write-Host " - Stock original: $($prodOriginal.Stock)" -ForegroundColor Yellow
        Write-Host " - Stock actual: $($prodActualizado.Stock) (Debería ser $($prodOriginal.Stock - 2))" -ForegroundColor Green
    } catch {
        Write-Host "Error al registrar la venta." -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message -ForegroundColor Red }
    }
} else {
    Write-Host "No hay suficientes datos semilla cargados en las dimensiones para registrar una venta." -ForegroundColor Red
}

Write-Host "`n5. Obteniendo Reporte Analítico OLAP..." -ForegroundColor Cyan
try {
    $reporte = Invoke-RestMethod -Uri "$baseUrl/api/ventas/reporte" -Method Get
    Write-Host "Métricas KPI del Data Mart:" -ForegroundColor Green
    Write-Host " - Total Facturado: `$ $($reporte.kpis.total_ventas)" -ForegroundColor Yellow
    Write-Host " - Transacciones Totales: $($reporte.kpis.transacciones)" -ForegroundColor Yellow
    Write-Host " - Unidades Vendidas: $($reporte.kpis.unidades_vendidas)" -ForegroundColor Yellow
    Write-Host " - Ventas Mensuales: $($reporte.ventas_mensuales.Count) meses" -ForegroundColor Yellow
    Write-Host " - Ventas por Categoría: $($reporte.ventas_categoria.Count) categorías" -ForegroundColor Yellow
} catch {
    Write-Host "Error al obtener reporte OLAP." -ForegroundColor Red
}
