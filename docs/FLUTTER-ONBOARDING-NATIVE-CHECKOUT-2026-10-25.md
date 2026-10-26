# Web Usuarios: secuencia Flutter + desglose + scroll nativo (25 oct 2026)

Fuente de verdad: Mobile PR #67 (`f247bf3996a41b1af2e0384c787e6fd2f4fe9d5d`), no mobile/main.
Última release pública previamente confirmada: `85480704c443d6998ad1bbb0c172ebb248534329` en `web-talaeats.alan-palacios-dev.com` (18195). Estos cambios viven en PR #3 hasta que Kali compile/instale un SHA nuevo.

## Cambios
1. CTA “Pedir comida” del portal público ya no abre `/clientes` directamente. Entra a `/iniciar` y muestra, para visitante: **5 s de splash → Welcome → métodos con botón de correo → formulario por pasos**. La sesión válida sí permite entrada directa a Inicio, igual que Flutter.
2. `CustomerEntry` replica estructuras/títulos oficiales: Welcome, métodos, back, 5 segundos de carga, CTA `Continuar con tu correo`; `CustomerStepAuth` separa correo y contraseña para login; registro con nombre/apellido/correo/password, contraseña fuerte y confirmación explícita. Nunca mostrar Google/OTP por teléfono sin backend. Los assets `food_tala.webp`, `food_fiesta.webp` y wordmark PNG se mencionan en Flutter **pero no están versionados en la rama móvil**; Web utiliza color/lettering sustituto, NO puede llamarse pixel-parity.
3. `CustomerGate` exige sesión validada para entrar al catálogo de Usuarios. Un invitado que abre `/clientes` o `/cuenta` vuelve al onboarding; ninguna pantalla privada queda como “entra a mi cuenta” en medio del shell. Logout y login conservan comprobaciones previas.
4. `checkout-preview.ts` usa exclusivamente GET de `/orders/payment-methods`: `commercial_pricing_version` 1.5.2/1.6.2, `service_fee_rate`, `delivery_base_fee` y, para 1.6.2, límites/cap. **No escribe pedidos ni confirma pagos**. Cuando cotización POST `/orders/quote` del backend está habilitada, el resultado validado tiene prioridad. Si entrega está desactivada y no hay cotización, muestra una base de envío y estimado **solo si la política comercial fue declarada**. Ejemplo de test `260 + 18.20 + 39 + 20 = 337.20`, rotulado referencia; NO permite confirmar delivery.
5. CSS `customer-shell`: `100svh`, solo `main` desplaza con overscroll contenido, sin efecto de salto de la página completa, sin smooth scrolling; body sin bounce; checkout CTA fijo con contenido scrollable detrás. La barra de direcciones de Chrome **no puede eliminarse dentro de una pestaña normal**; instalación PWA modo standalone la oculta.
6. Prueba Playwright en backend sintético cubre click `Pedir comida`, splash, bienvenida, métodos, correo, contraseña, login y logout; no muta producción.

## Foto real: bloqueo del backend
Web `CustomerPhoto` ya no rompe layout al fallar URLs, pero las capturas reales siguen mostrando imágenes no disponibles. Para identificar la causa sin escribir nada, ejecutar en Kali:
```bash
SHA="<SHA_VERIFICADO>"
sudo bash "/home/tala-node-stage/tala-eats-web-releases/$SHA/deploy/diagnosticar-fotos-reales.sh"
```
Este script consulta **solo el catálogo público** y los ficheros de imagen del mismo origen; reporta `NO_IMAGE_UPLOADED`, `CROSS_ORIGIN_OR_UNSAFE_URL`, `UNEXPECTED_PUBLIC_MEDIA_PATH`, `HTTP 403` o `HTTP 404`. No restaura imágenes ni toca DB, pagos o PM2. Corregir mapeo/almacenamiento real de imágenes **en el backend Node** o recargar desde la app Restaurante, con backups, sin generar fotografías ficticias ni hacer un cambio peligroso a LIVE sin diagnóstico.

## No afirmar completo
- Backend Node LIVE sigue autoritario: pagos Stripe, distancia GPS, reparto y ledger sin E2E verificado. No desbloquear UI con flags falsos.
- El formulario de recuperación de contraseña y lectura completa de textos legales aún requieren flujo propio Web respaldado por endpoints y contenido auténticos.
- Hay diferencias de imagen, layout fino y transiciones que necesitan assets Flutter reales y golden diff.
- Validar scroll móvil con Android real además de Playwright.
- Actualizar dominio original solo mediante `deploy/kali-update-existing-public.sh`, preflight y copia de release. No usar 18196 ni hacer merge.
