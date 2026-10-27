# Tala Eats Restaurantes — dominio propio / publicación en Kali

**Estado:** preparado en código y scripts; **NO desplegado** en Kali desde este PR. Esta guía no altera Stripe ni cuentas de comercios. Actualizado: 27/oct/2026 (réplica visual Flutter Restaurante, PR #7).

## Arquitectura aprobable

| Aplicación | Dominio/puerto local | Nota |
| --- | --- | --- |
| Pedir comida y selector central | `web-talaeats.alan-palacios-dev.com` → `127.0.0.1:18195` | Se mantiene intacto durante la instalación |
| Restaurantes (NUEVO; dominio propuesto) | `restaurantes-talaeats.alan-palacios-dev.com` → `127.0.0.1:18197` | Nginx y archivos estáticos totalmente aislados |
| Backend Node.js LIVE ÚNICO | `127.0.0.1:18190/api/v1` | Mismo backend, cookies host-only y proxy HTTPS same-origin |
| Repartidores | En la PWA existente `/repartidor` | Fuera del despliegue de Restaurantes |

El dominio `restaurantes-talaeats.alan-palacios-dev.com` es **propuesta pendiente de DNS/Cloudflare**. No afirmar que existe ni que responde hasta verificarlo.

`/restaurante` abre bienvenida empresarial o el panel si el rol es restaurante; `/restaurante/acceso` inicio de sesión; `/restaurante/alta` alta; `/admin/solicitudes-restaurantes` autorización ADMIN protegida. El build de Restaurantes es **independiente** (`restaurantes.html`, `src/main-restaurantes.tsx`, `dist-restaurantes/`, `sw-restaurante.js`), por lo que no importa el onboarding ni el carrito de Clientes. Nginx del dominio específico redirige `/` a `/restaurante`, responde 404 a `/clientes` y solo ofrece recursos estáticos de la PWA y `/api/v1`. El manifiesto predeterminado redirige al manifiesto de Restaurantes.

## I. Preparación del build inmutable (sin escrituras a LIVE)

1. Antes de elegir el SHA, exigir **SUCCESS** en los tres workflows del mismo commit: Tala Eats PWA CI, Restaurantes Web QA visual y Usuarios Web capturas; un run `cancelled` o `in_progress` no equivale a PASS.
2. Consultar el **SHA completo del último commit de la rama** `feat/restaurantes-premium-clean-20261027` que pasó los workflows PWA CI, Restaurantes QA visual y Capturas Clientes.
3. En Kali, usando el usuario existente `tala-node-stage` y el SHA aprobado (sustituir el marcador en el siguiente bloque):

```bash
SHA='<SHA_COMPLETO_40_HEX_APROBADO>'
sudo -H -u tala-node-stage bash -s -- "$SHA" <<'BUILD'
set -euo pipefail
export PATH="$HOME/.local/node24/bin:$HOME/.local/bin:$PATH"
SHA="$1"
BRANCH='feat/restaurantes-premium-clean-20261027'
DEST="$HOME/tala-eats-web-releases/$SHA"
test ! -e "$DEST"
mkdir -p "$HOME/tala-eats-web-releases"
git clone --depth 1 --branch "$BRANCH" \
  https://github.com/AlanPalacios23/tala-eats-version-web.git "$DEST"
test "$(git -C "$DEST" rev-parse HEAD)" = "$SHA"
cd "$DEST"
unset VITE_PREVIEW_READONLY VITE_RESTAURANT_APP_URL
npm install --no-package-lock --no-audit --no-fund
npm run check # tests + Clientes dist/ + Restaurantes dist-restaurantes/
test -s dist-restaurantes/restaurantes.html
bash -n deploy/kali-install-restaurantes-isolated.sh
bash -n deploy/kali-update-restaurantes-isolated.sh
bash deploy/kali-install-restaurantes-isolated.sh --plan "$SHA"
BUILD
```

Si `--plan` no entrega **`RESTAURANTES_INSTALL_PLAN=PASS_READ_ONLY`**, **NO aplicar**. La revisión requiere la PWA Clientes existente saludable, backend LIVE `production=true`, puerto 18197 libre, y no archivos existentes dentro del namespace nuevo.

## II. Instalar solo el nuevo servidor de Restaurantes (aprobación explícita)

```bash
SHA='<MISMO_SHA_COMPLETO_40_HEX>'
sudo bash "/home/tala-node-stage/tala-eats-web-releases/$SHA/deploy/kali-install-restaurantes-isolated.sh" \
  --apply "$SHA" I_APPROVE_NEW_RESTAURANTES_NGINX_18197_ONLY
```

Resultado requerido: `RESTAURANTES_INSTALL=PASS_LOCAL_ONLY`. Copia solo `dist-restaurantes/`, no `dist/` de Clientes. Crea **únicamente**:
- `/srv/talaeats-restaurantes-pwa/releases/$SHA`, `current`.
- `/etc/talaeats-restaurantes-pwa/nginx.conf`, `server.conf`.
- `/etc/systemd/system/talaeats-restaurantes-pwa.service`.

Arranca un Nginx propio bajo `www-data` y prueba rutas/local API. Falla si hay colisión, puerto ocupado o backend inapropiado. Intenta rollback de estos recursos nuevos en caso de fallo. **No reinicia el Nginx de Clientes, Node, PM2, Redis, Postgres, Stripe ni Cloudflared**.

## Diagnóstico de primer arranque: directorio PID de Nginx

Si `nginx -t` informa `open() "/run/talaeats-restaurantes-pwa/nginx.pid" failed (2: No such file or directory)`,
la sintaxis de Nginx puede ser correcta, pero systemd **todavía no creó** `RuntimeDirectory=`
porque el servicio no ha iniciado. El instalador corregido crea este directorio exclusivo
con propietario `www-data` **después del modo --plan y antes de `nginx -t`**;
si la instalación falla, limpia ese directorio únicamente cuando el propio instalador lo creó.

Para un checkout inmutable **anterior** a la corrección, SIN editar el script ni ensuciar el SHA:

```bash
sudo install -d -o www-data -g www-data -m 0755 /run/talaeats-restaurantes-pwa
# Repetir el comando --apply aprobado para el mismo SHA ya compilado.
```

Esto no reinicia Clientes `18195` ni backend `18190`. `/run` es almacenamiento
volátil; systemd administra el directorio en arranques posteriores. No publicar Cloudflare
hasta `RESTAURANTES_INSTALL=PASS_LOCAL_ONLY` y smoke checks GET aprobados.

## III. Darle un dominio real en Cloudflare

**Solo después de que la instalación local pase:** crear un nuevo hostname del mismo túnel:

```yaml
# Agregar ANTES del catch-all del túnel existente (NO sustituir el archivo).
- hostname: restaurantes-talaeats.alan-palacios-dev.com
  service: http://127.0.0.1:18197
```

Si el túnel está gestionado remotamente, agregar el hostname en Zero Trust Dashboard; no modificar el YAML local. Configurar DNS y certificado TLS desde Cloudflare. El hostname `web-talaeats.alan-palacios-dev.com` debe conservar `18195`; `talaeats.alan-palacios-dev.com` mantiene su API propia. **Nunca reemplazar el catch-all ni duplicar el hostname de Clientes.**

Verificar externamente (solo GET):

```bash
BASE='https://restaurantes-talaeats.alan-palacios-dev.com'
curl -fsSI --max-time 12 "$BASE/" | grep -Ei 'HTTP/|location:'
curl -fsS  --max-time 12 "$BASE/restaurante" | grep -F '<div id="root">'
curl -fsS  --max-time 12 "$BASE/manifest-restaurante.webmanifest"
curl -fsS  --max-time 12 "$BASE/api/v1/health"
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/clientes" # debe ser 404
```

Comprobar manualmente en navegador el login empresarial, cookie `Secure; HttpOnly; SameSite`, onboarding, rol restaurante real y acceso ADMIN según MFA. Un GET 200 del frontend **no certifica** pagos ni recogidas comerciales.

## IV. Habilitar enlace desde el selector sin arriesgar Clientes

En el portal original, el enlace **Restaurantes** solo dirige al nuevo dominio si su build incorpora esta variable permitida:

```bash
VITE_RESTAURANT_APP_URL='https://restaurantes-talaeats.alan-palacios-dev.com/restaurante'
```

La variable está validada por allowlist; sin ella el enlace sigue abriendo `/restaurante` en el dominio principal. **Solo después de comprobar HTTPS y login** hay que volver a compilar el build fuente con esta variable, correr `npm run check` y usar el deploy estático existente y controlado de `18195` (`deploy/kali-update-existing-public.sh --plan SHA`, luego `--apply SHA I_APPROVE_PUBLIC_STATIC_18195_ONLY`). Esto sí reemplaza **el frontend existente** de Clientes, por lo que exige revisión separada, backup y plan PASS; no hacerlo automáticamente como consecuencia de instalar la app de Restaurantes.

## V. Futuras actualizaciones, con rollback

`deploy/kali-update-restaurantes-isolated.sh` actualiza solamente los archivos estáticos del **nuevo** origen y conserva el release anterior:

```bash
sudo bash "/home/tala-node-stage/tala-eats-web-releases/$SHA/deploy/kali-update-restaurantes-isolated.sh" --plan "$SHA"
sudo bash "/home/tala-node-stage/tala-eats-web-releases/$SHA/deploy/kali-update-restaurantes-isolated.sh" --apply "$SHA" I_APPROVE_RESTAURANTES_STATIC_18197_ONLY
# Solo si es necesario revertir el último reemplazo estático:
sudo bash "/home/tala-node-stage/tala-eats-web-releases/$SHA/deploy/kali-update-restaurantes-isolated.sh" --rollback I_APPROVE_RESTAURANTES_STATIC_ROLLBACK_ONLY
```

No se hace `nginx reload`, y el cambio de `/srv/talaeats-restaurantes-pwa/current` es atómico.

## VI. Gate comercial que continúa pendiente

- Backend Node: confirmar transición confirmada por servidor (tarjeta conciliada o efectivo autorizado) → confirmado → preparando → listo → pickup PIN **real** y ledger inmutable. En la auditoría anterior algunos controladores conservaban nomenclatura `Stage`; una etiqueta no prueba por sí sola que LIVE esté deshabilitado ni habilitado.
- Verificar que alta ADMIN con MFA, confirmación propietaria de Stripe Connect, personal y fotos funcione en el NUEVO origin HTTPS.
- Domicilio/repartidor LIVE y transferencias bancarias automáticas no se habilitan mediante esta publicación estática.
- Probar doble toque, conexión intermitente, fallos 401, stock y devoluciones 409 sin generar cobros de prueba en LIVE.

La app de Restaurantes toma como referencia `tala-eats-mobile/main/tala-eats-restaurante/app`: Inicio, Pedidos, Menú, Wallet y Más, además de Cocina dedicada. Wallet muestra datos verificados y consulta de retiro, pero **no** ejecuta payouts ni transferencias, aunque Stripe Connect figure aprobado. El cambio de interfaz nunca debe simular dinero disponible.

El criterio para publicar es **SHA exacto + CI verde + Nginx local PASS + Cloudflare HTTPS PASS + QA de sesión real con consentimiento del comercio**. No declarar despliegue realizado hasta ejecutar estos pasos en Kali.
