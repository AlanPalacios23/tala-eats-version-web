# RC153 · Soporte de pedidos para repartidores — doble autorización

### Estado de integración
- Frontend parte de RC152; backend Node compañero: `feat/rc153-driver-support-order-authorization-20261030`, PR #209.
- Ambas capacidades están preparadas en ramas, pero no están en LIVE ni integradas con el backend actualmente desplegado.
- **NO** activar `VITE_DRIVER_SUPPORT_ENABLED=true` ni `DRIVER_ORDER_SUPPORT_ENABLED=true` en producción sin E2E, revisión de roles, rate limits y respaldo/rollback.

### Contrato
- `GET /api/v1/platform/support/capabilities` requiere sesión autenticada y devuelve `driver_ticket_enabled` y `driver_order_link_supported` booleanos. Solo `(true, true)` permite el formulario.
- El cliente no almacena permisos; si el endpoint falta, falla, regresa datos parciales o el usuario está desconectado, no envía tickets.
- `POST /api/v1/platform/support` envía `order_id` únicamente cuando existe un pedido activo con ID entero positivo y se autorizó el soporte. El backend valida `driver_id` y `order_type` de la orden; no confía en la app.
- Respuesta exitosa requiere `id`, `user_id` igual a la sesión y `order_id` idéntico al solicitado. No se anuncia un ticket vinculado sin esas verificaciones.
- El historial consulta `GET /platform/support` pero solo muestra tickets con `user_id` igual a la cuenta autenticada.

### Cobertura de las siete áreas de Repartidores
1. Ofertas: opt-in visual/vibración foreground, selección de oferta autorizada. Push real pendiente.
2. Navegación: Google Maps/Apple Maps por estado real, sin ETA inventados. Rutas internas pendientes.
3. Entrega: estado asignado-recogido-en camino-PIN, restricciones backend conservadas.
4. Soporte: RC153 vinculación segura por asignación; permanece apagada hasta validación.
5. Wallet: lectura con cuenta vinculada; depósitos/retiros no se habilitan.
6. Seguridad: categoría de incidencia; sin prometer despacho SOS ni respuesta inmediata.
7. Estadísticas: actividad real en dashboard; no se crean números simulados.

### Gates para activación
1. Integrar ramas RC144–RC153 en una rama de liberación sin sobrescribir PWA Usuarios/Restaurantes.
2. Integrar backend PR #209 sobre el commit Node que realmente esté activo en Kali; comparar schema, migrations y rutas antes de merge.
3. QA Node con PostgreSQL/Redis de staging, pruebas negativas de IDOR con 2 repartidores, usuario, comercio, ADMIN con MFA, pedido asignado/no asignado y ticket duplicado.
4. Pruebas PWA Android/iOS con conectividad, cambio de cuenta, 320/360/390/430 dp, permisos y estados del backend.
5. Solo después habilitar flags por separado, respaldar, publicar por versión con rollback y comprobar que soporte no toca pagos, Stripe, PIN ni ledger.