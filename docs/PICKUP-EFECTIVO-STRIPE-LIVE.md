# Tala Eats — Primer pedido real para recoger (efectivo + Stripe LIVE)

**Alcance**: PWA Clientes y Restaurante, reutilizando un solo Node LIVE
(`127.0.0.1:18190`). Sin activar domicilio, payout automático, ni transacciones de prueba LIVE.

## Estado al 26/10/2026
- Backend LIVE `10f28bcaf63efd3e0ab9dc0366440219da261916`, financiero, Web Push y worker sanos según despliegue operador.
- Auditoría financiera LIVE **PASS**, pero `SELLER_OWNER_APPROVED_MAPPINGS=0`.
- La PWA pública previa `401aa91c8cc0eedba2f178ef5f0bfe1f812a9ddc` aún mostraba **Stripe TEST**; esta PR lo integra por modo explícito.
- No crear pedidos reales hasta que exista **al menos un** comercio legítimo, verificado, abierto, con inventario real y su propio Connect autorizado. Ese es un bloqueo comercial, no un error técnico a esquivar.

## 1. Alta de un comercio auténtico
1. Admin verifica propiedad del comercio y que su usuario realmente sea el dueño.
2. Registrar **su cuenta Stripe Connect real**, distinta de la plataforma, con
   `POST /api/v1/admin/finance/connect-map`: JSON
   `{"restaurant_id": <ID_REAL>, "stripe_account_id": "acct_..."}`.
   Hacerlo mediante sesión autenticada de administrador y MFA, NO tokens en bash, logs ni URL.
3. El **propietario** entra a la sección "Mi negocio" de la PWA.
   La aplicación consulta `GET /api/v1/owner/finance/connect/:rid/status`.
   El propietario pulsa "**Confirmar titularidad**" para autorizar la relación;
   esta acción invoca `POST /api/v1/owner/finance/connect/:rid/confirm`.
4. Completar el proceso propio de Stripe vía
   `POST /api/v1/owner/finance/connect/:rid/onboarding-link`.
   Confirmar `owner_approved=true`, `details_submitted=true`,
   `transfers_active=true`, `payouts_enabled=true` desde servidor.
5. El comercio activa recogida, menú/precios/stock verificados y horario abierto.
   No cambiar rutas financieras para saltar el requisito de Connect, ni siquiera
   para cash: el servidor LIVE deliberadamente exige un comerciante listo en ambos casos.

## 2. Contratos del checkout

- `GET /api/v1/orders/payment-methods` requiere sesión; `cash.enabled=true`
  y `stripe.enabled=true` solo cuando el backend y sus flags lo permiten.
  El flag efectivo `STAGE_PICKUP_CASH_CHECKOUT_ENABLED=true` también se
  utiliza en LIVE; verificar su valor por lectura privada SIN imprimir secretos.
- `GET /api/v1/payments/stripe/config` entrega
  `environment=production`, `mode=live-pickup-only`,
  `enabled=true`, `checkout_ready=true`,
  `financial_writes_enabled=true`, `pk_live_...` (pública).
  La UI rechaza TEST en LIVE, o LIVE en staging.
- `POST /api/v1/orders/quote` recalcula el total **sin reservar inventario**.
- `POST /api/v1/orders` requiere sesión cliente, cuenta del comercio Connect
  verificada, precio y stock reales, referencia de idempotencia única.
- Para Stripe, el cliente crea PaymentIntent vía
  `POST /api/v1/payments/stripe/orders/:id/payment-intent`,
  valida importe exacto, id y modo `live`, y confirma solo con Stripe.js.
- **Nunca** tomar confirmación SDK o redirección como "pagado":
  `GET /api/v1/payments/stripe/orders/:id/status` debe confirmar
  `confirmed_by_server=true`, asiento financiero firmado e importe exacto.
  Hasta entonces restaurante no prepara ese pedido.

## 3. Restaurante: preparar y cerrar con PIN
El portal lee `GET /api/v1/owner/orders` y muestra pedidos en efectivo
o tarjetas con recibo confiable. Las transiciones siguen:

`received → confirmed → preparing → ready → delivered`

- `PATCH /api/v1/owner/orders/:id/status` para aceptar, preparando, listo;
  server exige propiedad real, orden válido y Stripe LIVE conciliado.
- El cliente ve PIN de 4 dígitos en Detalle de pedido.
- `POST /api/v1/owner/orders/:id/complete` con PIN correcto.
  Para efectivo, el comercio debe marcar **"Confirmo que recibí el efectivo"**;
  se acredita un recibo de **efectivo físico en el comercio**, no en Stripe.
  Para tarjeta, necesita `paid` más ledger firmado, sin registrar dinero efectivo.
- Solo una vez se marca `delivered` y se registra contabilidad e historial;
  ninguna llamada mueve fondos a comercios automáticamente.

## 4. Primer E2E real, con comercio y cliente consentidores

**Efectivo**: cotización del servidor → confirmar → pedido en Restaurante →
aceptar → preparar → listo → comprador entrega PIN y efectivo →
comercio confirma recepción real → `delivered` → asiento cash una sola vez.

**Stripe LIVE**: cotización del servidor → pedido `awaiting_payment` →
PaymentIntent LIVE del importe exacto → tarjeta del comprador autorizado →
webhook Stripe firmado → asiento conciliado / `paid` → Restaurante ve pedido →
preparar → listo → PIN → `delivered`; asegurar que no exista duplicación.

Revisar importes de **15% comisión comercio + 7% tarifa cliente**
según la política comercial activa y la cotización del backend.
La propina, si aplica, va íntegra al destinatario; pickup no tiene envío.

## 5. Publicación independiente de PWA y CSP

La compilación de esta PR **no publica** producción automáticamente.
Compilar/revisar el SHA exacto de la PR en la cuenta de servicio. Usar el
instalador probado `deploy/kali-update-existing-public.sh --plan SHA` y
`--apply SHA I_APPROVE_PUBLIC_STATIC_18195_ONLY` solo después del PASS.
No modificar el API LIVE, PM2 ni el túnel.

El frontend de pago requiere **Stripe.js**. El Nginx público instalado en
`/etc/talaeats-web-pwa/server.conf` puede bloquear `https://js.stripe.com`.
Usar `deploy/ENABLE_STRIPE_LIVE_PWA_CSP_KALI.sh --plan`, comprobar diff,
y después `sudo bash ... --apply I_APPROVE_PWA_18195_CSP_ONLY`.
El script solo configura la CSP de la PWA aislada en `18195`,
con respaldo y rollback; nunca recarga Nginx global.

## 6. No-Go automático
- 0 comerciantes Connect aprobados, o merchant distinto al propietario.
- Stripe TEST referenciado en pantalla LIVE.
- `cash.enabled` o `stripe.enabled` falsos.
- Falta de webhook firmado / de libro mayor conciliado.
- Cliente/restaurant no reconocidos, stock insuficiente, cantidades alteradas,
  doble clic, orden pendiente incierta o PIN incorrecto.
- Cobro en efectivo no recibido físicamente (no marcar entregado).
- Cualquier auditoría financiera, backup, CSP o CI fallido.

**No hay que desactivar validaciones para forzar el primer pedido.**
