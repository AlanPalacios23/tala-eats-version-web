# TALA EATS · Restaurantes Web PWA + activación de comercios

**Versión en revisión**: branch `feat/restaurant-app-activation-20261026` de `AlanPalacios23/tala-eats-version-web`.

**Ámbito**: segunda entrada `Restaurantes` del selector público. Interfaz independiente de `Pedir comida`, que conserva sus pantallas. **No es el APK Flutter Restaurante**, que continúa siendo otra app. Esta PWA consume únicamente el backend Node LIVE ya existente, sin desplegar un nuevo backend.

## Flujos reales implementados

### A. Solicitar alta de un comercio nuevo
1. Abrir `/restaurante/acceso`, iniciar sesión o crear cuenta.
2. Crear cuenta utiliza el endpoint ordinario `POST /api/v1/auth/register`: **rol inicial Cliente**, no admin/merchant.
3. Abrir `/restaurante/alta` con una sesión de cliente. Enviar `POST /api/v1/onboarding` con `entity_type=restaurant`, nombre, RFC opcional y hasta tres documentos JPG/PNG/WEBP/PDF de hasta 5 MB vía `POST /api/v1/uploads/onboarding-document`. Los documentos son privados y solo visibles con autorización del backend. Se consulta el expediente desde `GET /api/v1/onboarding/mine`.
4. Un ADMIN real autenticado y con MFA abre `/admin/solicitudes-restaurantes`, consulta `GET /api/v1/admin/onboarding` y aprueba, rechaza o solicita información mediante `PATCH /api/v1/admin/onboarding/:id`. El backend registra la decisión; al aprobar verifica/crea el restaurante y promueve el usuario a `restaurant` en una transacción.
5. La sesión anterior queda invalidada al cambiar el rol. El propietario debe **volver a iniciar sesión**. El frontend no intenta tomar permisos desde el cliente.
6. El propietario ya autorizado entra a `/restaurante`, activa recogida y configura menú, precio, stock y apertura del comercio con `/owner/restaurant` y `/owner/menu`. El backend valida y rechaza apertura de comercios sin verificación administrativa.

### B. Habilitar Stripe Connect LIVE por comercio
1. Un administrador con MFA vincula una cuenta **propia del comercio** en `/admin/conectar-restaurante` (endpoint `POST /api/v1/admin/finance/connect-map`). El backend verifica Stripe Connect MX, propiedad/identidad email, y que no es la plataforma ni otro beneficiario.
2. El dueño entra a **Mi negocio → Confirmar mi titularidad**, mediante `POST /api/v1/owner/finance/connect/:rid/confirm`. Esto solo debe hacerse si reconoce la cuenta Stripe asociada como legítimamente suya. **No automatizar ni suplantar consentimiento.**
3. Si Stripe pide datos adicionales, el dueño obtiene link de onboarding mediante `POST /api/v1/owner/finance/connect/:rid/onboarding-link` y lo abre en dominio autorizado `https://connect.stripe.com`.
4. El frontend muestra pasos de configuración derivados de `GET /api/v1/owner/finance/connect/:rid/status` y `GET /api/v1/owner/restaurant`. Estos **no sustituyen** la verificación final que el backend hace al tomar cada pedido/crear PaymentIntent.
5. No se habilitan transferencias automáticas, Stripe TEST ni domicilio con esta aplicación.

### C. Operar pedidos pickup con tarjeta o efectivo
- Pestaña **Pedidos**: 20 s de actualización al estar visible, cuatro columnas (`received`, `confirmed`, `preparing`, `ready`) y últimos finalizados, sin inventar órdenes en UI.
- El backend `GET /api/v1/owner/orders` filtra tarjetas sin recibo confirmado; la UI además deshabilita acciones si una tarjeta no está pagada.
- Cambios de estado a través de `PATCH /api/v1/owner/orders/:id/status`; el servidor verifica propiedad, trabajador LIVE y recibo Stripe firmado.
- Recogida con PIN de exactamente 4 dígitos a través de `POST /api/v1/owner/orders/:id/complete`. Efectivo exige confirmación humana de que el comercio **lo recibió físicamente**; tarjeta exige `paid` conciliado. El backend valida PIN y realiza el asiento una sola vez. La UI no cambia el dinero ni la contabilidad por sí sola.
- **Finanzas**: `GET /api/v1/owner/finance`, información contable separada de pagos bancarios y efectivo. No se muestran supuestos payouts ejecutados.

## Piloto real que falta confirmar
El operador ya verificó el backend LIVE `09ee09c8364382597c8e9ab1573a5b417884d47e`, y la PWA Clientes `0967d6d0458621121031aaf5a22c475eff3392c2` está publicada. El restaurante #1, The Burger House, tiene Connect asociado pero **su dueño NO ha confirmado la titularidad**. Esto mantiene bloqueados los nuevos pedidos. La nueva app Restaurantes de este PR no está publicada hasta completar su QA y despliegue PWA.

Para un E2E auténtico, con usuarios autorizados:
1. El propietario reconoce la vinculación existente, confirma y verifica Connect.
2. Admin comprueba estado (sin reasignar la cuenta ya registrada). Mercado, apertura, inventario, recogida activos.
3. Cliente hace pickup en efectivo: cotización real → restaurante ve orden → acepta → prepara → listo → recibe PIN + efectivo → cierre `delivered` → asiento efectivo único.
4. Cliente hace pickup con tarjeta LIVE autorizada: acepta que **genera cobro real** → PaymentIntent exacto → webhook firmado → pago conciliado visible → preparación → listo → PIN → cierre sin efectivo inventado.
5. Reconciliar finanzas y evitar cobros/transiciones duplicadas, errores, atrasos del worker. No ejecutar cobros por medio de pruebas automatizadas en producción.

## Publicación
La rama es funcional pero el estado **QA PASS no equivale a deploy**. Hacer checkout por commit SHA inmutable en `/home/tala-node-stage/tala-eats-web-releases/<SHA>`, `npm install --no-audit --no-fund` (repositorio sin lockfile), `npm run check`, después usar `deploy/kali-update-existing-public.sh --plan <SHA>` y `--apply <SHA> I_APPROVE_PUBLIC_STATIC_18195_ONLY`. El script hace respaldo y no toca Stripe/PM2/Cloudflare/DB. Verificar `PUBLIC_PWA_DEPLOY=PASS` y la versión activa en `/srv/talaeats-pwa/current`.

**Advertencia**: no reutilizar el instalador CSP antiguo; el sitio público ya tiene Stripe.js permitido por encabezados GET, aunque existe una diferencia conocida entre configuración de Nginx en disco y política activa. Su persistencia tras reinicios se audita por separado.
