# Tala Eats · publicación de Restaurantes y Repartidor PWA (28 octubre 2026)

## Objetivo
Terminar las dos superficies operativas sin sustituir ni degradar Clientes en `https://web-talaeats.alan-palacios-dev.com/`.

- `/clientes` — Clientes existente; no modificar su checkout ni su estado financiero.
- `/restaurante` — nueva experiencia premium derivada de Flutter, incluida en la rama base de RC9.6; además existe build separado `dist-restaurantes/` para el hostname independiente.
- `/repartidor` — PWA en el portal principal, con cabecera y contenidos exclusivos del conductor, GPS y rol server-backed; no mostrar carrito ni navegación de Clientes.
- Solo hay un backend LIVE: Node en `127.0.0.1:18190`. Los portales públicos usan API por proxy same-origin. NO crear base de datos, backend o integración financiera distinta.

**Estado de esta rama:** cambio en GitHub, no despliegue. Los resultados de CI deberán ser SUCCESS en el SHA exacto tras este cambio. El portal web externo no se pudo consultar desde el entorno de revisión. Verificar host, DNS, Cloudflare, servicios y versión activa en Kali.

## Reglas previas
1. No lanzar Stripe LIVE domicilio ni aceptar entregas LIVE por activar la PWA: el backend RC9.6 PR #166 sigue HOLD hasta TEST firmado, conciliación, GPS y pruebas de tres roles. `VITE_DRIVER_ACTIONS_ENABLED` debe permanecer **sin definir** en build LIVE.
2. Mantener habilitados solo métodos y operaciones que devuelva la API. No inferir permiso por la UI.
3. Preservar `18195` (Clientes y Repartidor), `18197` (Restaurantes independiente, si está instalado), `18190` (API), DB, PM2, Stripe y túnel Cloudflare.
4. Revisar tres workflows SUCCESS para el **mismo HEAD**: Tala Eats PWA CI, Restaurantes Web QA visual y Usuarios Web capturas. No tomar como PASS un run `cancelled`.
5. Preparar respaldo/rollback y comprobar el estado del servicio antes de aplicar cualquier release.

## A. Diagnóstico de Kali (solo lectura)

```bash
printf '=== PWA principal ===\n'
systemctl is-active talaeats-web-pwa.service || true
readlink -f /srv/talaeats-pwa/current || true
curl -fsSI --max-time 8 -H 'Host: web-talaeats.alan-palacios-dev.com' http://127.0.0.1:18195/clientes | head
printf '=== PWA restaurante ===\n'
systemctl is-active talaeats-restaurantes-pwa.service || true
readlink -f /srv/talaeats-restaurantes-pwa/current || true
curl -sS -o /dev/null -w '%{http_code}\n' --max-time 8 -H 'Host: restaurantes-talaeats.alan-palacios-dev.com' http://127.0.0.1:18197/restaurante || true
printf '=== Backend LIVE ===\n'
curl -fsS --max-time 8 http://127.0.0.1:18190/api/v1/health
```

Verificar el dominio público del restaurante de forma independiente. Si su hostname existe pero apunta a otra versión, **no** asumir que `18197` es su origen: revisar Cloudflare antes de publicar. El frontend debe conservar cookies seguras host-only por origen; autenticarse por separado en cada PWA.

## B. Build inmutable desde GitHub sin tocar LIVE

Seleccionar el SHA de **esta rama** después de CI verde. Pasar `SHA` y `BRANCH` reales; nunca ejecutar un script sin validar el checkout. El siguiente bloque compila ambas PWAs y ejecuta pruebas **sin aplicar** una release.

```bash
BRANCH='feat/rc97-role-portals-kali-release-20261028'
SHA='<SHA_DE_40_CARACTERES_CON_3_CI_SUCCESS>'
sudo -H -u tala-node-stage bash -s -- "$BRANCH" "$SHA" <<'BUILD'
set -euo pipefail
export PATH="$HOME/.local/node24/bin:$HOME/.local/bin:$PATH"
BRANCH="$1"; SHA="$2"
[[ "$SHA" =~ ^[a-f0-9]{40}$ ]]
DEST="$HOME/tala-eats-web-releases/$SHA"
test ! -e "$DEST"
mkdir -p "$HOME/tala-eats-web-releases"
git clone --depth 1 --branch "$BRANCH" \
  https://github.com/AlanPalacios23/tala-eats-version-web.git "$DEST"
test "$(git -C "$DEST" rev-parse HEAD)" = "$SHA"
cd "$DEST"
unset VITE_PREVIEW_READONLY VITE_DRIVER_ACTIONS_ENABLED VITE_RESTAURANT_APP_URL
npm install --no-package-lock --no-audit --no-fund
npm run check
test -s dist/index.html
test -s dist-restaurantes/restaurantes.html
bash -n deploy/kali-update-existing-public.sh
bash -n deploy/kali-install-restaurantes-isolated.sh
bash -n deploy/kali-update-restaurantes-isolated.sh
echo "TALA_EATS_TWO_PWA_BUILDS=PASS"
BUILD
```

La compilación principal incluye el selector, Clientes, Restaurantes en ruta y Repartidor. La compilación separada incluye exclusivamente Restaurantes. Que un build compile no certifica un despliegue.

## C. Publicar PRIMERO Restaurantes aislado

Usar `--plan` de la **instalación** si 18197 está vacío y el servicio aún no existe; usar `--plan` de **actualización** si ya hay una instalación válida. No correr instalación y actualización sobre el mismo destino.

```bash
SHA='<MISMO_SHA_APROBADO>'
SCRIPT="/home/tala-node-stage/tala-eats-web-releases/$SHA/deploy"
if [[ -L /srv/talaeats-restaurantes-pwa/current ]]; then
  sudo bash "$SCRIPT/kali-update-restaurantes-isolated.sh" --plan "$SHA"
else
  bash "$SCRIPT/kali-install-restaurantes-isolated.sh" --plan "$SHA"
fi
```

Solo tras `PLAN PASS`, backups, hostname verificado y autorización de la operación: ejecutar el `--apply` correspondiente usando la aprobación exacta que exija el script. No cambiar Cloudflare a ciegas. La instalación aislada no actualiza Clientes `18195` ni Node `18190`.

Comprobar: `/restaurante`, `/restaurante/acceso`, `/restaurante/alta`, propietario autenticado, pedido, menú, KDS, Wallet, MFA ADMIN y Stripe Connect informativo. El botón de retiro bancario debe seguir bloqueado sin backend acreditado. Comprobar el manifiesto y `sw-restaurante.js` por mismo origen.

## D. Publicar DESPUÉS la PWA principal (Repartidor y selector)

Después de validar Restaurantes y los test de Clientes, ejecutar plan read-only del despliegue público:

```bash
SHA='<MISMO_SHA_APROBADO>'
sudo bash "/home/tala-node-stage/tala-eats-web-releases/$SHA/deploy/kali-update-existing-public.sh" --plan "$SHA"
```

La acción `--apply` requiere aprobación **separada** porque conmuta `/srv/talaeats-pwa/current` en 18195; nunca se debe activar en este paso una bandera de dispatch/pago de domicilio.

Pruebas en navegador HTTPS móvil y escritorio:
- Selector raíz con tres accesos; `/clientes` y `/iniciar` conservan pantalla y carrito de usuarios.
- `/restaurante` abre diseño moderno o, **solo si el dominio independiente está comprobado**, redirige mediante `VITE_RESTAURANT_APP_URL` a `https://restaurantes-talaeats.alan-palacios-dev.com/restaurante`. No configurar la variable antes de verificar HTTPS de ese host.
- `/repartidor` enseña UI sin menú, footer o carrito de cliente; manifest `manifest-repartidor.webmanifest` y rol driver; GPS HTTPS + presencia online real sin desbloquear dispatch LIVE.
- Login/cookies de roles, 401/403 y ausencia de rutas de datos privadas a otros roles.
- Service Worker no cachea API ni tokens; recursos de Clientes regresan 200 y los pagos pickup existentes permanecen intactos.
- Verificar fallback SPA y que la URL pública realmente sirve el SHA esperado; reiniciar pestañas/forzar actualización del Service Worker solo si es necesario.

## E. Revertir si hay regresión

Cada script mantiene release previo y permite `--rollback` con un token explícito y solo para su namespace:
- Restaurantes: `kali-update-restaurantes-isolated.sh --rollback I_APPROVE_RESTAURANTES_STATIC_ROLLBACK_ONLY`.
- Público: `kali-update-existing-public.sh --rollback I_APPROVE_PUBLIC_STATIC_ROLLBACK_ONLY`.

Ante fallos de auth, cobros, cocina, manifest, GPS o routing, revertir **solo la PWA afectada** y examinar logs; no cambiar Stripe, Redis ni base de datos para maquillar un frontend.

**Gate futuro de negocio:** el envío con pago Stripe LIVE, asignación, entrega PIN y liquidación sigue siendo trabajo independiente en backend/staging y nunca se habilita por una actualización de estos estáticos.
