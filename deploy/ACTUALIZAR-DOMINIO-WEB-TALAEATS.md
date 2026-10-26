# Actualizar el dominio público YA EXISTENTE `web-talaeats.alan-palacios-dev.com`

**Este es el destino solicitado:** `https://web-talaeats.alan-palacios-dev.com/clientes` → frontend estático `127.0.0.1:18195`. No es `18196`, que era una revisión independiente.

La actualización reemplaza los archivos de la **PWA pública existente** por el commit exacto de Web Usuarios basado en Flutter `1.0.46+57`. El backend Node LIVE permanece donde está (`127.0.0.1:18190`), sin cambios a PM2, PostgreSQL, Redis, Stripe, Cloudflared, rutas ni certificación HTTPS. No se hace merge de PR #3 a main.

## ÚNICO BLOQUE: compilar, preflight, instalar y comprobar
Usar el SHA publicado en el último commit del PR #3, siempre de 40 caracteres, después de las pruebas CI. Pegarlo desde Kali conectado como alan.

```bash
bash <<'DEPLOY'
set -euo pipefail
SHA="REEMPLAZAR_CON_SHA_EXACTO_DE_ESTA_RELEASE"
BRANCH="feat/mobile-parity-v1046-navigation"
REPO="https://github.com/AlanPalacios23/tala-eats-version-web.git"

sudo -iu tala-node-stage bash -s -- "$SHA" "$BRANCH" "$REPO" <<'BUILD'
set -euo pipefail
SHA="$1"; BRANCH="$2"; REPO="$3"
export PATH="$HOME/.local/node24/bin:$HOME/.local/bin:$PATH"
ROOT="$HOME/tala-eats-web-releases/$SHA"
mkdir -p "$HOME/tala-eats-web-releases"
test ! -e "$ROOT"
git clone --depth 1 --branch "$BRANCH" "$REPO" "$ROOT"
test "$(git -C "$ROOT" rev-parse HEAD)" = "$SHA"
cd "$ROOT"
npm install --no-audit --no-fund
npm run check
env -u VITE_PREVIEW_READONLY npm run build
! grep -Fq 'name="tala-preview-mode"' dist/index.html
echo "PUBLIC_BUILD=PASS"
BUILD

SCRIPT="/home/tala-node-stage/tala-eats-web-releases/$SHA/deploy/kali-update-existing-public.sh"
sudo bash "$SCRIPT" --plan "$SHA"
sudo bash "$SCRIPT" --apply "$SHA" I_APPROVE_PUBLIC_STATIC_18195_ONLY

curl -fsS --max-time 10 \
 -H 'Host: web-talaeats.alan-palacios-dev.com' \
 http://127.0.0.1:18195/clientes >/dev/null
curl -s -o /dev/null -w 'HTTP_PUBLICO=%{http_code}\n' \
 --max-time 20 'https://web-talaeats.alan-palacios-dev.com/clientes'
echo 'FIN_DE_VERIFICACION_LOCAL'
DEPLOY
```

El script exige `PUBLIC_PWA_PLAN=PASS_READ_ONLY` antes de tocar nada y `PUBLIC_PWA_DEPLOY=PASS` al publicar. Si el backend no soporta `market_code=TALA-JAL` o el sitio público no tiene la estructura esperada, **aborta sin reemplazar archivos**. No omitir los requisitos para forzar un deploy que dejaría el Home vacío.

## Verificar en navegador
Abrir el dominio original `https://web-talaeats.alan-palacios-dev.com/clientes`, usar `Ctrl + Shift + R` si conservaba HTML en caché y confirmar Inicio/Buscar/Comercio/Carrito/Cuenta. El script conserva assets con nombres hash de la versión antigua durante la transición de caché. Si el dominio no refleja el cambio, revisar Cloudflare cache/túnel (no crear otro hostname).

El navegador **sí** usa el backend existente, y puede solicitar acciones reales cuando el backend las autorice. Evitar pedidos/cobros de prueba contra LIVE; para pagos se usa el staging Stripe TEST aislado. El backend bloquea lo que no esté permitido; este cambio no habilita Stripe LIVE ni reparto.

## Volver inmediatamente a la PWA anterior

```bash
sudo bash /home/tala-node-stage/tala-eats-web-releases/REEMPLAZAR_CON_SHA_EXACTO_DE_ESTA_RELEASE/deploy/kali-update-existing-public.sh \
 --rollback I_APPROVE_PUBLIC_STATIC_ROLLBACK
```

La versión anterior continúa en `/srv/talaeats-pwa/releases`, se guarda otra copia bajo `/srv/talaeats-pwa/backups`, y su SHA queda en `/srv/talaeats-pwa/previous-public`. La reversión cambia solo `current`. No reinicia el backend ni Nginx.

## Retirar la vista de pruebas 18196 (opcional, solo después de verificar el dominio público)
```bash
sudo systemctl disable --now talaeats-web-preview.service
```
Esto detiene solo el proceso de revisión. Sus archivos pueden conservarse por si necesitas recuperar capturas o pruebas; no es necesario borrarlos.

### Control de compatibilidad y privacidad
La ruta `GET /api/v1/restaurants?market_code=TALA-JAL&limit=1&offset=0` debe retornar una lista y toda fila debe tener `market_code=TALA-JAL`. El backend debe decir `production=true`, `status=ok`. El validador de Nginx exige el dominio original, el puerto 18195 y el symlink `/srv/talaeats-pwa/current`. Los archivos de configuración y servicio no se sustituyen; solo se cambia la referencia estática a un nuevo release por SHA con comprobación HTTP real. `nginx.service`, `cloudflared.service`, Stripe, PM2 y DB quedan intactos.
