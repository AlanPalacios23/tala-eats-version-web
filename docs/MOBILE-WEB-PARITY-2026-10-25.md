# Paridad Mobile → Web (25 octubre 2026)

## Fuente verificada
- Mobile main: `39fa0ac6608eb1dca5e6a97d1f95bf3c6433888f` (Usuarios 1.0.30+41).
- Mobile PR #67 (draft): `feat/usuarios-v1046-rc810-stripe-test-delivery-20261024`, SHA `f247bf3996a41b1af2e0384c787e6fd2f4fe9d5d`, Usuarios 1.0.46+57.
- Importante: #67 depende de PRs encadenados. No es equivalente a `main` y no implica funcionalidad desplegada.

## Implementado en esta rama web
- Portada de exploración centrada en catálogo real, sin ilustraciones ni bloques promocionales ajenos al Mobile.
- Acceso visible a búsqueda y navegación cliente Inicio / Buscar / Pedidos / Cuenta; dock móvil responsive.
- Respeta la carga de comercios reales y estados loading/error/empty existentes.
- No modifica los endpoints financieros ni activa Stripe LIVE.

## Pendiente para declarar equivalencia
- Login/registro, soporte y wallet según el contrato de Mobile.
- Checkout pickup con cotización y recotización (PR #64) y domicilio efectivo (PR #65).
- Stripe domicilio TEST con feature flag y validación servidor (PR #67), nunca asumir pago confirmado por cliente.
- Estados de pedido, actualización/entrega repartidor y finanzas restaurante.
- UI visual contra capturas móviles reales (320, 360, 390, 430px), accesibilidad y PWA.
- CI PASS de web y contrato backend antes de desplegar en Kali; no auto-deploy de cambios en borrador.

## Política de lanzamiento
Nunca habilitar pedidos/cobros en vivo basándose sólo en UI. Consultar flags del backend, precio autorizado, idempotencia, estado financiero y garantías de la cadena completa antes de habilitar checkout. No se ha desplegado esta rama.
