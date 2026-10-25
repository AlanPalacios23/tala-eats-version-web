# Tala Eats Usuarios · Paridad Mobile → Web
Actualizado: 25 octubre 2026

## Referencia precisa
- Mobile Usuarios PR #67 (DRAFT): `feat/usuarios-v1046-rc810-stripe-test-delivery-20261024`, commit `f247bf3996a41b1af2e0384c787e6fd2f4fe9d5d`, version `1.0.46+57`.
- Fuente visual/UX: `ui/design_system.dart`, `ui/discovery_screens.dart`, `ui/auth_screens.dart` y `ui/purchase_screens.dart`.
- Mobile `main` sigue en `1.0.30+41`; PR #67 aún no está fusionado ni equivale a una release LIVE.
- Desarrollo Web en PR #3 (draft). NO se ha hecho merge ni despliegue a Kali.

## Implementado en Web (código real)
- Inicio Mobile Usuarios: encabezado de zona (Tala), saludo, título, búsqueda y listado sin banners ajenos.
- Pantalla Buscar separada con filtrado tolerante a acentos, estado vacío, error y reintento.
- Tarjetas comercio 16:9, fotografía real, cerrado, metadatos y favorito **temporal** (no se finge sincronía persistente).
- Navegación inferior Inicio/Buscar/Pedidos/Cuenta, pastilla seleccionada 280ms, sin aviso falso de pedido activo.
- Tokens reales Flutter: `#FF5A1F`, `#CE3C0A`, `#FAFAF9`, `#171717`, Roboto, radios, sombras y movimiento 140/200/300/320ms con reducción de movimiento.
- Login/registro con fondos claros y paneles liquid-glass, sin cambiar contrato de sesión.
- Carrito entre restaurantes: confirmación explícita antes de reemplazarlo.
- Pedido pickup/efectivo: feature gate, cotización del servidor, recarga de catálogo y medios de pago, validación monetaria en centavos, recotización **antes del POST**, rechazo si cambian importes y búsqueda por referencia tras resultado de red desconocido.
- Suite de regresión de tokens, búsqueda y cotizaciones; CI `npm run check`.

## No equivale todavía a la aplicación completa
- Dirección real y selector de mercado, notificaciones y avatar real de cuenta.
- Búsqueda de platillos en todos los menús (ahora filtra comercios y categorías disponibles).
- Persistencia sincronizada de favoritos, soporte, wallet y gestión de direcciones.
- Checkout delivery con ubicación GPS, confirmación de distancia y tarifa de backend RC8.7/RC8.10, Stripe TEST WEB con SDK y antifraude, pago LIVE.
- Estado de entrega, seguimiento detallado y efectos específicos de detalle/carrito/órdenes.
- Paridad pixel-a-pixel comprobada contra capturas Android 320/360/390/430dp + escalado 1.3.
- Pruebas reales de pago/entrega integradas con backend desplegado.

## Gates de salida (no saltar)
1. CI verde del último commit; QA visual en móvil/tablet/desktop, accesibilidad y PWA.
2. Contrato backend para cada método, guard de idempotencia, autorización y validación de total del servidor.
3. Stripe en TEST únicamente hasta comprobar webhooks, reconciliación, estados y Connect LIVE.
4. Prueba end-to-end cliente -> restaurante -> repartidor -> entrega -> ledger antes de declarar paridad funcional total.
5. Despliegue Kali controlado, backup y rollback, sólo con revisión explícita; el trabajo en draft no sustituye producción.
