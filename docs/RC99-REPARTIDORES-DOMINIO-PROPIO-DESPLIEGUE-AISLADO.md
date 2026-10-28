# Tala Eats Repartidores · Dominio y PWA Flutter aislados (RC9.9)

**Estado:** código en PR #10, SIN DESPLEGAR. Instalar en Kali requiere autorización explícita posterior. **No tocar** Clientes 18195, Restaurantes 18197, Node LIVE/PM2 18190, Stripe, Postgres, Redis ni el túnel Cloudflare existente.

## Arquitectura final

| Aplicación | Host HTTPS | Origen de túnel (solo loopback) | Release |
| --- | --- | --- | --- |
| Clientes / portal | web-talaeats.alan-palacios-dev.com | 127.0.0.1:18195 | /srv/talaeats-pwa |
| Restaurantes | restaurantes-talaeats.alan-palacios-dev.com | 127.0.0.1:18197 | /srv/talaeats-restaurantes-pwa |
| **Repartidores (nuevo)** | **repartidores-talaeats.alan-palacios-dev.com** | **127.0.0.1:18199** | **/srv/talaeats-repartidores-pwa** |
| Backend LIVE compartido | API existente | 127.0.0.1:18190 | PM2 NO ALTERADO |

La app Repartidor tiene `repartidores.html`, `src/main-repartidores.tsx`, `src/DriverStandalone.tsx`, `vite.repartidor.config.ts`, `dist-repartidores/`, `manifest-repartidor.webmanifest`, `sw-repartidor.js`, su propio Nginx y unidad systemd. El código de su entrada no importa `App.tsx` (Clientes), `RestaurantWorkspace` ni `CustomerCheckout`. Usar la API real **same-origin** bajo `/api/v1` y autenticación por rol verificada en el servidor.

### Imagen e identidad oficial Flutter
El logo **PNG 418 px**, launcher **1024 px** e ícono Android **192 px** se copiaron byte por byte de `AlanPalacios23/tala-eats-mobile/main/tala-eats-repartidor/app/assets/branding`. Los valores de `theme.dart` coinciden en los tokens de colores, tamaño 28 dp del encabezado, botón principal 56 dp, navegación 70 dp, espacios de 18 dp y radios de 14/20 dp. La comparación **pixel a pixel** con capturas doradas Flutter del mismo dispositivo/estado todavía requiere generar y contrastar dichas capturas; no se certifica 100% por el mero hecho de compilar.

## 1. Primero, comprobar CI exacto del commit

GitHub PR #10: `https://github.com/AlanPalacios23/tala-eats-version-web/pull/10`
La rama sigue en draft hasta que estén SUCCESS al mismo HEAD: PWA CI, Repartidores Chromium, Clientes Chromium y Restaurantes Chromium. El QA web de Repartidor prueba `vite.repartidor.config.ts` con respuestas sintéticas exclusivamente (no pagos/entregas LIVE), 320/360/390/430 dp, registro, login, logotipo, CTA, gráfica, perfil, sin desbordamiento ni contenido Cliente.

## 2. Confirmar que el puerto nuevo está libre

```bash
sudo ss -lntp | grep -E ':(18190|18195|18197|18199)\b' || true
systemctl is-active talaeats-web-pwa.service
systemctl is-active talaeats-restaurantes-pwa.service
test ! -e /etc/talaeats-repartidores-pwa && echo DRIVER_CONFIG_FREE=YES
test ! -e /srv/talaeats-repartidores-pwa/current && echo DRIVER_RELEASE_FREE=YES
```

Si 18199 existe o hay una unidad previa de Repartidores, NO ejecutar el instalador de primera vez. Investigar el estado y preferir `kali-update-repartidores-isolated.sh` solo cuando esté configurado correctamente.

## 3. Obtener release anclada y compilar las 3 aplicaciones

Sustituir el SHA solo por HEAD que haya superado CI; no usar un SHA de otro PR.

```bash
SHA="<SHA_DE_40_HEX_CONFIRMADO_CON_CI>"
BRANCH="feat/rc98-driver-flutter-parity-registration-20261028"
sudo -H -u tala-node-stage bash -s -- "$SHA" "$BRANCH" <<'BUILD'
set -euo pipefail
export PATH="$HOME/.local/node24/bin:$HOME/.local/bin:$PATH"
SHA="$1"; BRANCH="$2"; DEST="$HOME/tala-eats-web-releases/$SHA"
test ! -e "$DEST"
mkdir -p "$HOME/tala-eats-web-releases"
git clone --depth 1 --branch "$BRANCH" https://github.com/AlanPalacios23/tala-eats-version-web.git "$DEST"
cd "$DEST"
test "$(git rev-parse HEAD)" = "$SHA"
unset VITE_PREVIEW_READONLY VITE_DRIVER_ACTIONS_ENABLED VITE_DRIVER_APP_URL
npm install --no-package-lock --no-audit --no-fund
npm run check
test -s dist/index.html
test -s dist-restaurantes/restaurantes.html
test -s dist-repartidores/repartidores.html
test -s dist-repartidores/sw-repartidor.js
test ! -e dist-repartidores/index.html
echo RC99_THREE_BUILDS_PASS=YES
BUILD
```

`VITE_DRIVER_ACTIONS_ENABLED` **SIEMPRE DESACTIVADA EN LIVE**, aunque la presencia RC95 esté activa. No habilitar pagos LIVE de domicilio, despacho ni retiros bancarios por el cambio de UI.

## 4. Plan READ-ONLY, y únicamente después aprobación de instalación

```bash
SCRIPT="/home/tala-node-stage/tala-eats-web-releases/$SHA/deploy/kali-install-repartidores-isolated.sh"
sudo bash "$SCRIPT" --plan "$SHA"
# Requiere REPARTIDORES_INSTALL_PLAN=PASS_READ_ONLY
```

El plan valida Git SHA, archivos estáticos, servicios existentes, puertos, backend LIVE y ausencia de recursos previos. **No modifica ninguna configuración.**

Solo si aprueba y el operador confirma instalación de servidor independiente:

```bash
sudo bash "$SCRIPT" --apply "$SHA" I_APPROVE_NEW_REPARTIDORES_NGINX_18199_ONLY
# Requiere REPARTIDORES_INSTALL=PASS_LOCAL_ONLY
```

El instalador agrega únicamente:
- `/srv/talaeats-repartidores-pwa/{releases,current}`
- `/etc/talaeats-repartidores-pwa/{nginx.conf,server.conf}`
- `/etc/systemd/system/talaeats-repartidores-pwa.service`
- Nginx exclusivo escuchando en **127.0.0.1:18199**.
Su recuperación ante fallos SOLO revierte recursos nuevos; los servicios y releases 18195/18197 no se alteran.

## 5. Vincular hostname por Cloudflare **sin reemplazar rutas actuales**

En el túnel Cloudflare **ya existente** usado para Tala Eats: añadir un **Public Hostname**:
- Subdomain: `repartidores-talaeats`
- Domain: `alan-palacios-dev.com`
- Type: `HTTP`
- URL: `127.0.0.1:18199`

No editar `web-talaeats`, `restaurantes-talaeats` ni sus reglas. Cloudflare crea o gestiona el DNS para la nueva ruta; no asignar DNS antes de comprobar el origen local. HTTPS público obligatorio para GPS y PWA.

```bash
HOST="repartidores-talaeats.alan-palacios-dev.com"
LOCAL="http://127.0.0.1:18199"
curl -fsS -H "Host: $HOST" "$LOCAL/repartidor" | grep -F '<div id="root">'
for PATH_APP in / /repartidor /repartidor/acceso /repartidor/registro /manifest-repartidor.webmanifest /sw-repartidor.js; do
  curl -sS -o /dev/null -w "$PATH_APP HTTP=%{http_code}\n" -H "Host: $HOST" "$LOCAL$PATH_APP"
done
curl -fsS -H "Host: $HOST" "$LOCAL/api/v1/health"
curl -sS -o /dev/null -w 'CUSTOMERS_NOT_SERVABLE=%{http_code}\n' -H "Host: $HOST" "$LOCAL/clientes"
curl -sS -o /dev/null -w 'RESTAURANTS_NOT_SERVABLE=%{http_code}\n' -H "Host: $HOST" "$LOCAL/restaurante"
curl -sS -o /dev/null -w 'ADMIN_NOT_SERVABLE=%{http_code}\n' -H "Host: $HOST" "$LOCAL/admin"
curl -sSI "https://$HOST/repartidor"
```

Después, **en navegador real**: login repartidor con rol driver aprobado, cookie host-only independiente, /auth/me, GPS HTTPS y disponibilidad; alta muestra estado inhabilitado hasta backend PR #167 validado; no 2FA/pagos simulados. Una sesión del dominio Clientes no se comparte automáticamente con el de Repartidores.

## 6. Conectar la opción "Repartidores" en el portal principal (segunda release)

`src/lib/driver-host.ts` valida exactamente `https://repartidores-talaeats.alan-palacios-dev.com/repartidor`. De forma predeterminada el enlace del selector **permanece en** `/repartidor`, no rompe LIVE.

SOLO después de HTTPS/roles/JS/SPA comprobados, compilar una release posterior del portal existente con:

```bash
export VITE_DRIVER_APP_URL=https://repartidores-talaeats.alan-palacios-dev.com/repartidor
# build de Clientes con control de PR, env y nuevo SHA; ejecutar
# deploy/kali-update-existing-public.sh --plan SHA
# y luego --apply SHA I_APPROVE_PUBLIC_STATIC_18195_ONLY
```

NO ejecutar estos pasos automáticamente con este PR ni modificar 18195 durante la primera instalación. Se puede mantener el enlace antiguo como fallback si la nueva ruta HTTPS no queda disponible.

## 7. Actualizaciones/rollback después de instalar

- `sudo bash deploy/kali-update-repartidores-isolated.sh --plan SHA`
- `sudo bash deploy/kali-update-repartidores-isolated.sh --apply SHA I_APPROVE_REPARTIDORES_STATIC_18199_ONLY`
- `sudo bash deploy/kali-update-repartidores-isolated.sh --rollback I_APPROVE_REPARTIDORES_STATIC_ROLLBACK_ONLY`

No compartir sesión ni secretos con ninguna captura. No apagar PM2, Stripe, PostgreSQL, Clientes ni Restaurantes. Sin CI/HTTPS/QA de cookies, **NO-GO para producción**.
