# RC155 — Sesiones aisladas y control de acceso a incidencias

## Alcance implementado
- La PWA de Repartidores monta su jornada con una clave ligada al usuario autenticado. Al cambiar de cuenta, React desmonta la instancia previa y reinicia PIN, declaraciones de efectivo, ofertas, GPS, estados de entrega, mapa, dashboard y soporte.
- Las respuestas asíncronas de polling de una instancia ya desmontada no actualizan la nueva jornada (montaje y versión de petición verificados).
- El backend mantiene RBAC de RC153–RC154, idempotencia transaccional y un límite de reportes por conductor; RC155 amplía la matriz de pruebas con comprador, comercio, ADMIN y dos repartidores.

## Pendientes obligatorios para habilitar en LIVE
1. Comprobar la versión exacta instalada en Kali antes de fusionar ramas (RC144 → RC155).
2. E2E real en staging, con base y Redis aislados y dos cuentas de repartidor: el A puede registrar un ticket del pedido asignado; el B recibe 404 al intentar ese mismo ID; el cambio de asignación invalida la autorización.
3. Dos solicitudes POST concurrentes con cuerpo idéntico deben recibir el mismo ID de ticket (201/200) y existir una única fila. Variar mensaje, categoría y pedido debe producir un nuevo ticket solo dentro de cuota.
4. Con DRIVER_ORDER_SUPPORT_ENABLED=false comprobar 403 para soporte con y sin order_id; con VITE_DRIVER_SUPPORT_ENABLED=false la PWA no muestra un formulario activo.
5. Prueba de sesión A → B en la misma PWA: ningún PIN, checkbox de efectivo, oferta, billetera, foto, ticket, mapa ni valor de GPS debe permanecer.
6. Revisión de accesibilidad 320/360/390/430 px, UI PWA de los tres portales, red intermitente y reanudación foreground.
7. Preparar respaldo y rollback atómico solo del backend / portal correspondiente. No activar Stripe LIVE ni modificar saldos o conciliación.

### Evidencia frente a alcance
- La matriz de pruebas RC155 es determinista sobre las funciones de autorización y barreras del código fuente. NO sustituye el E2E HTTP/DB de dos cuentas reales de staging.
- El flujo staging de entrega ya existente en GitHub Actions verifica pedidos, pero no equivale a una prueba completa de concurrencia de tickets. La activación requiere ambas.
- No se ha realizado publicación a Kali en esta versión.