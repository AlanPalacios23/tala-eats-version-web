# RC170 · Módulo 1 — Pedidos (Restaurantes PWA)

## Base y alcance
- Parte de la rama **feat/restaurante-pwa-premium-ops-rc157** (PR #46 / RC169), no de `main`, que todavía no incorpora la PWA avanzada.
- Cambia exclusivamente el frontend del módulo **Pedidos** y sus pruebas. No modifica el backend, la base de datos, Stripe ni la PWA de clientes/repartidores.
- Ningún commit de este módulo implica despliegue a Kali. El PR debe revisarse y superar CI antes de promover un SHA de release.

## Primer corte implementado
1. **Acciones con fuente de verdad del servidor:** se conserva la secuencia `received → confirmed → preparing → ready`. La aceptación sigue bloqueada para Stripe sin pago `paid` y para efectivo marcado como fallido, cancelado o reembolsado.
2. **Pérdida de respuesta en PATCH:** cuando la respuesta falta o llega incompatible, se ejecuta **solo un GET** de `/api/v1/owner/orders` para reconciliar. Nunca se reintenta el PATCH automáticamente.
3. **Reconciliación visible:**
   - Estado solicitado encontrado en GET: se confirma al comerciante.
   - Estado previo encontrado: se comunica que sigue sin cambiar y se permite decidir manualmente qué hacer.
   - Estado cambiado por otro proceso: se muestra el estado del servidor y no se atribuye la acción al operador.
   - GET inválido/no disponible/pedido fuera de la lista: se invalida la frescura y se deshabilitan acciones hasta una nueva sincronización.
4. **Asignación automática tras preparar domicilio:** una respuesta `ready → assigned` (o etapa posterior de reparto) no se trata como fallo si el pedido era a domicilio. Para pickup no se inventa una transición a reparto.
5. **Sin consultas manuales superpuestas** mientras está en curso una mutación de pedido. Se mantienen los GET automáticos condicionados a visibilidad/conectividad y las barreras de frescura anteriores.

## Gate de QA antes del despliegue

- `npm run check` en CI (Vitest, TypeScript y dos builds, incluyendo `dist-restaurantes`).
- Laboratorio aislado con permisos de comercio: recibir un pedido pickup en efectivo, aceptar, preparar y marcar listo; verificar el estado final desde backend.
- Laboratorio con Stripe TEST (NO LIVE): tarjeta pagada y tarjeta pendiente/rechazada; las últimas no habilitan cocina.
- Simular pérdida de conexión después de aceptar: verificar que la pantalla consulta de nuevo y **no envía un segundo PATCH** por su cuenta.
- Domicilio con asignación automática: confirmar que el backend puede devolver `assigned` tras `ready`; el tablero debe mostrar el estado actualizado sin sugerir repetir la acción.
- Refrescar durante mutación / navegar y volver en Android e iOS; validar ausencia de dobles acciones.
- Confirmar que cancelaciones/reembolsos y finalización PIN permanecen sujetos a rutas y permisos backend; **no habilitarlos** a ciegas desde frontend.

## Próximo corte del Módulo 1
Validar en el backend Node realmente instalado la paginación y el filtro de pedidos activos, los eventos de notificaciones y las rutas de rechazo/cancelación seguras (especialmente Stripe pagado). Solo después añadir las acciones que falten y cubrir E2E Usuarios → Restaurantes → Repartidores → entrega con PIN. No prometer estas capacidades antes de verificarlas.

**Estado:** cambios propuestos en rama de feature; despliegue Kali = NO REALIZADO. Pruebas E2E comerciales = PENDIENTES.
