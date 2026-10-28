# Tala Eats RC9.6 — PWA pedido completo (cliente → restaurante → repartidor → PIN)

Fecha: 2026-10-28
Frontend PR #8, base: PWA Restaurantes premium.
Backend dependiente: PR #166 sobre RC9.5, **todavía DRAFT y LIVE DELIVERY OFF**.

## Qué existe y qué NO está verificado

- Cliente: catálogo real, carrito por restaurante, cantidades y variantes, dirección GPS, cotización del servidor, referencia idempotente en sesión, Stripe.js y verificación de pago por estado/ledger del backend. El cliente NO confirma 'pagado' a partir del SDK.
- Restaurante: PWA de cocina y flujo `received → confirmed → preparing → ready` mediante backend.
- Repartidor: PWA `/repartidor`, presencia aprobada por ADMIN, GPS fresco, heartbeat 45 segundos, disponibilidad confirmada por servidor, `ready → assigned → picked_up → on_the_way → delivered` con PIN.
- Usuario: `/pedidos/:id` hace polling autorizado cada 12 segundos; lista hace polling cada 15 segundos solo mientras está visible.
- Tests frontend: contrato **sintético** de toda la cadena. NO sustituye prueba de PostgreSQL/Redis, proveedor real ni Android.
- Kali RC9.5: una cuenta conductor aprobada, conexión/GPS LIVE habilitados por operador, y Stripe LIVE de **pickup** funcionando. No hay evidencia de la primera conexión GPS en navegador.
- **NO habilitado:** nuevos pedidos de DELIVERY en LIVE, PaymentIntent de entrega LIVE, cash delivery LIVE, dispatch/pickup/PIN LIVE, Stripe Connect payouts.

## Prueba E2E obligatoria en STAGING AISLADO (no usar claves LIVE ni pedidos reales)

1. Confirmar URL y entorno en navegador con `/api/v1/ready` y `/api/v1/orders/payment-methods`: debe declararse STAGING, driver + delivery_cash + delivery_quote habilitados; no confundir con `ready=true` financiero.
2. Tres sesiones separadas con roles Customer, Merchant y Driver aprobados por ADMIN. Verificar que la PWA no comparte cookies de usuario entre pestañas del mismo dominio; usar perfiles independientes.
3. DRIVER: iniciar sesión en `/repartidor`, aceptar permiso de GPS HTTPS. Activar conexión. Comprobar `/driver/presence-readiness` (autenticado) con `admin_verified=true`, `online=true`, `fresh_gps=true`. Permanecer inmóvil más de 2 minutos y confirmar que el heartbeat sigue vigente mientras la pestaña esté visible.
4. CUSTOMER: seleccionar comercio abierto y producto con stock. Crear dirección real con lat/lng verificadas. Seleccionar domicilio, comprobar quote y desglose servidor. Efectivo en STAGING primero; enviar **una única** orden con `client_reference`, guardar id.
5. Reintentar la misma referencia tras timeout para demostrar que el backend no crea un segundo pedido. La UI jamás hace POST duplicado automáticamente.
6. MERCHANT: abrir el pedido en la PWA Restaurante y transicionar confirmado → preparando → listo. Cada cambio debe aparecer al cliente mediante estado del servidor, con control estricto de rol.
7. DRIVER: comprobar pedido asignado mediante worker o el endpoint de ofertas, sin consultar datos personales antes de asignación. Dos repartidores concurrentes nunca deben tomar el mismo pedido.
8. DRIVER: recogido → en camino → PIN incorrecto rechazado → PIN correcto → entregado. Conservar auditoría y verificar una sola prueba de entrega, una sola ganancia y ledger idempotente. Evitar exponer el PIN al conductor antes de la entrega.
9. CUSTOMER: pedido aparece 'entregado' desde backend, sin falsificar pagos. Restaurante ve salida del KDS.
10. Reiniciar worker con orden READY y conductor desconectado; verificar reintento tras GPS vigente. Falla de Redis y GPS vencido debe bloquear nueva asignación sin perder el pedido.

## Después: Stripe TEST real, no recibos sintéticos

- Habilitar únicamente claves y webhook secretos de Stripe TEST en entorno staging separado.
- Usar tarjeta de prueba, PaymentIntent externo real y evento webhook firmado recibido/contabilizado; exigir matching exacto de pedido, monto MXN, proveedor, idempotencia y no disputas/reembolsos.
- Probar pago fallido, intento duplicado, webhook repetido, disputa, devolución, timeout e intento de aceptar pedido sin captura. Todos deben fallar con seguridad sin marcarlo 'pagado' o 'entregado'.
- Volver a ejecutar el flujo de tres PWA con pago TEST, siguiendo los mismos pasos para cada rol.

## Go / No-Go LIVE

**NO-GO actual:** Sin Stripe TEST externo firmado y reintentos/conciliación demostrados, sin driver GPS real, sin validación de los tres portales sobre stage; el backend RC9.6 tiene el hard lock `RC96_LIVE_DELIVERY_NOT_RELEASED_STRIPE_TEST_REQUIRED`. No liberar cambiando variables de entorno. No fusionar PR #8 o #166 como autorización financiera.

Después de pruebas completas, liberar un canario limitado a Tala con un comercio, un repartidor aprobado, límites de pedidos y control de reembolsos y disputa. Mantener pickup LIVE existente y Wallet/retiros Stripe Connect bloqueados. Exigir rollback de API/worker PWA y soporte de órdenes en curso.

## Implementación/release

PWA PR #8 se construye con `npm test && npm run build && npm run build:restaurante` en CI, sin escribir en servidor LIVE. Tras obtener GO del backend, desplegar mediante los scripts Kali **existentes**, en una release exacta y aislada, con pruebas de URL/CDN/nginx, no cambiando a ciegas el symlink actual. Auditar que `/repartidor` está en el dominio enrutado y usa cookies del mismo origen que `/api/v1`. No inferir que una compilación en GitHub ya aparece en el dominio público.
