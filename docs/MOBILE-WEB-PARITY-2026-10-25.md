# Tala Eats Usuarios — Paridad Mobile → Web
Corte: 25 octubre 2026. PR web #3 (DRAFT, NO DEPLOY).

## Fuente de verdad
- [Mobile Usuarios PR #67](https://github.com/AlanPalacios23/tala-eats-mobile/pull/67) es DRAFT y apunta a `f247bf3996a41b1af2e0384c787e6fd2f4fe9d5d`, `1.0.46+57`.
- Mobile `main` tiene `1.0.30+41`, por lo que usar main **no es suficiente** para copiar v1.0.46.
- Referencias Flutter: `ui/discovery_screens.dart`, `ui/purchase_screens.dart`, `ui/order_screens.dart`, `ui/auth_screens.dart`, `ui/market_selector.dart`, `local_markets.dart`, `production_api.dart` y `ui/design_system.dart`.

## Implementado en PR web
- Home separado de Buscar; saludo, encabezado, tarjetas de restaurante 16:9, búsqueda por nombre y categoría, loaders, offline.
- Paleta, tipografía Roboto, esquinas/sombras y tiempos de animaciones 140/200/280/300/320/420 ms; reduce-motion.
- Login/registro con reflejos estáticos blancos y efecto Liquid Glass.
- Detalle restaurante: hero con gradiente, menú, categorías, estado cerrado, tarjetas de alimentos, ficha modal con preferencia/cantidad; floating "Ver carrito".
- Carrito: variante independiente por preferencia, cantidades y stock total del SKU, confirmación antes de reemplazar carrito de otro comercio, mensaje de nota.
- Checkout pickup/efectivo preexistente reforzado: quote, flags y recotización del backend antes de POST, comparación en centavos, referencia anti-duplicado y recuperación tras resultado incierto. El usuario no puede deducir de esto que Stripe Web ya funciona.
- Pedidos: agrupación En curso/Anteriores; timeline de 5 pasos (pickup) y 6 (delivery); detalle de estado y pago reales, error/reintento, conservación del historial anterior si GET falla.
- Favoritos: GET `/platform/favorites` y POST `/platform/favorites/{id}` autenticados, con rollback cuando el backend falla. Ya no se hacen pasar likes temporales por guardados.
- Mercados: Tala, Cuisillos, Ameca, Ahualulco, Tequila, Amatitán. Filtro paginado `market_code`, validación de identidad, IDs y región por cada fila; rechazar respuestas legacy sin filtro, tal como Flutter. Cambio de zona confirma descarte de carrito; nunca mezcla localidades.
- Pruebas automáticas para importes y recotización, variantes/stock, timeline y aislamiento de mercados.

## Brechas críticas que persisten antes de declarar "idéntica"
1. Flutter Search incluye resultados por platillo desde menú global: Web aún filtra solo comercios/categorías.
2. Dirección completa, GPS, selector de dirección, push, avisos y perfiles/avatar faltan.
3. Wallet, cupones, soporte, chat y cuenta/favoritos como subpantallas todavía no son equivalentes.
4. Checkout de domicilio efectivo/Stripe TEST, PaymentSheet web y todas sus feature gates requieren integración verificada del backend, no asumir Stripe LIVE.
5. Cart/Checkout aún comparten pantalla Web y requieren réplica de pantalla Checkout/Payment Status de Flutter.
6. Flujo completo de cancelaciones, seguimiento en vivo, chat, driver y notificaciones faltan.
7. Validación visual pixel-a-pixel contra capturas Android (320/360/390/430dp), teclado, lector de pantalla, PWA y pruebas E2E con datos del backend todavía pendiente.
8. Falta verificar release candidata junto a backend RC8.x y reconciliación antes de producción.

## Seguridad de despliegue
No hay merge a `main`, no AAB/Play, no pagos LIVE ni publicación a Kali en este PR. CI verde es necesario pero no demuestra paridad total, pruebas físicas ni equivalencia financiera. Desplegar sólo con backup, revisión, rollback y pruebas end-to-end de cadena cliente→restaurante→repartidor→entrega→ledger.
