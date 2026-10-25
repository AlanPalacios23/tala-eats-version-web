# TALA EATS WEB — Despliegue aislado en Kali

Este repositorio es **frontend PWA solamente**. No contiene API, PostgreSQL, Stripe
secreto, Redis ni backend alternativo. Depende del backend Node RC8.13 LIVE en
`127.0.0.1:18190` de Kali. **No exponer 18190 directamente a Internet.**

## Requisitos

- DNS y Cloudflared ya disponibles.
- Nginx o un equivalente que permita SPA fallback + proxy same-origin `/api/v1/`.
- Node 22+ para compilar. HTTPS obligatorio al entrar desde dispositivos.
- Rol de administración separado para habilitar restaurantes, vendedores y repartidores.

## Entorno recomendado

- Frontend web nuevo: `https://web-talaeats.alan-palacios-dev.com`.
- Nginx PWA local: `127.0.0.1:18195`, solo frontend estático.
- API LIVE **existente**: `127.0.0.1:18190`, conservando Stripe LIVE y su DB.
- Páginas legales existentes (`/privacidad` y `/eliminar-cuenta`): no tocar.
- No abrir el puerto 18192 temporal, ya retirado.

## Publicación manual

Desde un checkout de la PWA (NO dentro del backend de producción):

```bash
npm install
npm run check
```

Para la primera publicación, como administrador responsable de Nginx:

```bash
sudo mkdir -p /srv/talaeats-pwa/releases/v0.1.0
sudo cp -a dist/. /srv/talaeats-pwa/releases/v0.1.0/
sudo ln -sfn /srv/talaeats-pwa/releases/v0.1.0 /srv/talaeats-pwa/current
```

Esto solo prepara estáticos; la configuración del servidor y de Cloudflared
**requiere revisión y cambio independiente**. Probar `nginx -t` antes de recargar.
Copia el archivo `nginx-web-talaeats.conf` como un nuevo sitio de Nginx,
NO en la configuración de Tala Eats LIVE de la API. Si ya existe otro proxy
para el puerto 18195, no sobrescribirlo.

Una vez que Nginx valide, agregar la ruta de Cloudflared de forma que las rutas
específicas públicas existentes no cambien:

```yaml
# SOLO ejemplo de ingreso nuevo, no reemplazar configuración actual:
- hostname: web-talaeats.alan-palacios-dev.com
  service: http://127.0.0.1:18195
```

Después, probar desde navegador:

```text
https://web-talaeats.alan-palacios-dev.com/
https://web-talaeats.alan-palacios-dev.com/api/v1/health
https://web-talaeats.alan-palacios-dev.com/api/v1/payments/config
```

`/api/v1/health` debe seguir reportando `rc8.13-unified-live`; NO 0.1 stage.
No imprimir ni registrar credenciales. Requiere verificar `Set-Cookie`
HttpOnly Secure a través del nuevo dominio; el cliente usa exclusivamente
cookies secure same-origin, sin guardar token en localStorage.

## Notas operativas

- Usuarios: registro/login/catalogación/carrito/quote/checkout **en efectivo
  para recoger**, si está habilitado en `orders/payment-methods` y el vendedor
  está verificado y aprobado. El servidor puede devolver 409 si faltan mapeos
  Stripe Connect del vendedor: no forzar la aprobación ni capturar pedidos fuera
  del backend.
- Stripe LIVE con tarjeta: no disponible en la interfaz inicial. Crear un
  PaymentIntent requiere Bearer explícito; integrar Stripe.js + webhook firmado,
  reconciliación, confirmación y pruebas con cuentas autorizadas ANTES de
  habilitarlo. No usar pago ficticio, iframe improvisado ni pedir datos de
  tarjeta en formularios propios.
- Repartidores: modo consulta. `VITE_DRIVER_ACTIONS_ENABLED=false`; el LIVE
  no autoriza despacho de repartidor. Para activación: validar primero flujo
  comercial completo, ledger, GPS y entrega con PIN con backend certificado.
- PWAs instalables mediante Chrome Android o menú de Safari iOS; las
  notificaciones push no están desarrolladas todavía.
- El SW no cachea `/api/` ni órdenes, perfiles, tokens o pagos. Sin conexión
  solamente se muestra un aviso; **no se crean pedidos offline**.
- No habilitar Cache-Control público ni Service Worker sobre el proxy `/api/v1`.
- Desplegar versiones de la PWA con rollback mediante symlink sin tocar PM2
  ni Nginx de la API LIVE.
