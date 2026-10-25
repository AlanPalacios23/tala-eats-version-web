# Tala Eats · Mobile Usuarios 1.0.46+57 → Web
Corte del trabajo: 25 octubre 2026.

## Origen inmutable
Mobile PR #67 DRAFT, SHA `f247bf3996a41b1af2e0384c787e6fd2f4fe9d5d`, versión Usuarios `1.0.46+57`. Mobile `main` está en `1.0.30+41`. Web PR #3 DRAFT y su rama `feat/mobile-parity-v1046-navigation`; aún no se ha fusionado ni desplegado a Kali.

## Pantallas/funciones ya trasladadas
- Inicio, Buscar, hero de restaurante, FoodCard, modal de producto, navegación inferior animada.
- Colores/tipografía/espaciados/animaciones según Flutter (140/200/280/300/320/420 ms) y reducción de movimiento.
- Inicio muestra dirección predeterminada (validada desde `/platform/addresses`), acceso a notificaciones y cuenta.
- Mercados (los seis códigos exactos), con paginación y validación fail-closed de localidad; cambio de zona exige descartar el carrito.
- Favoritos persistentes vía GET/POST `/platform/favorites`, rollback de error.
- Carrito separado de checkout, opciones/variantes, cantidades y stock total por SKU.
- Checkout separado con tarjetas de Entrega/Pago/Resumen, cupón, propina y dirección GPS del servidor.
- Direcciones: GET, geocodificación server-side, alta, selección predeterminada, eliminación. Sin fingir coordenadas.
- Cotizaciones de pickup y delivery vía rutas Mobile (`/orders/quote`, `/orders/delivery-quote`). Efectivo en delivery sólo cuando **todas** las flags correspondientes están habilitadas. Stripe Web visible pero INHABILITADO hasta completar SDK/Web Payment Element verificado.
- Pre-POST financiero: refresh de opciones, revalidación de menú/stock/precios por SKU, cotización estricta de servidor (MXN, comercio, modalidad, pago, tarifas, inventario sin reservar), comparación de importes y distancia.
- Referencia cliente persistida en sessionStorage **antes** del POST; resultado incierto bloquea otros envíos y habilita sólo consulta read-only `/orders/by-reference`.
- Pedidos activos/anteriores, detalle, timeline y estatus reales del servidor.
- Cuenta, Tala Club (balance/puntos/movimientos fail-closed), canje 500 puntos sin doble intento ante resultado incierto, notificaciones y marcar leído, favoritos listados, ayuda/soporte con hilo y solicitud por ID de pedido.
- PWA cliente con manifest correcto en todas las rutas nuevas; roles de restaurante y repartidor permanecen separados.

## Pruebas automatizadas
- `tests/customer-checkout.test.ts`: flags, Stripe Web bloqueado, dirección precisa, fingerprint, quote estricta, recotización y stock.
- `tests/customer-mobile-parity.test.ts`: notas, cantidades, variantes, timeline.
- `tests/mobile-parity.test.ts`: centavos, política de pickup, búsquedas.
- `tests/markets.test.ts`: códigos y fail-closed del catálogo.
- CI `npm run check` y build PWA en GitHub Actions. CI verde **no prueba equivalencia pixel a pixel ni el pago real**.

## Pendiente para afirmar paridad real completa
1. Stripe Payment Element **TEST** para navegador, confirmación con webhook real, reconciliación, retorno, intent state; posteriormente habilitación LIVE separada.
2. Búsqueda global de platillos, no sólo nombre/categoría de restaurante.
3. Avatar editable, perfil y privacidad/seguridad completos; promociones y cupones con validaciones UX propias, chat de pedido y soporte en tiempo real.
4. Push Web/FCM con permiso explícito y opt-out; seguimiento en vivo y ETA reales.
5. Dirección con entrada GPS opt-in desde el dispositivo cuando geocoder no logra ubicar, edición de direcciones y comprobación de cobertura.
6. QA visual contra screenshots Flutter a 320/360/390/430 px, escala de texto 1.3, teclado, accesibilidad y gestos; e2e con backend LIVE/STAGING que demuestre pedido completo hasta ledger y payout.
7. Verificar todos los contratos RC8.x y flags financieros directamente contra backend desplegado. No asumir que un endpoint existe solo por figurar en la app Flutter.

## Política de release
No fusionar a main ni publicar en Kali hasta pruebas integradas, backend compatible, webhooks y proceso de rollback. No se habilitan cobros Stripe LIVE por esta rama. Los datos financieros únicamente son válidos cuando responde el backend; nunca inventar «éxito» o saldo cero si falló una petición.
