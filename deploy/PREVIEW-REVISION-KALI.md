# Tala Eats Web Usuarios · Despliegue de revisión en Kali (SIN sustituir producción)
Versión objetivo: rama `feat/mobile-parity-v1046-navigation`, PR #3, con fuente Flutter Usuarios `1.0.46+57`.

**Objetivo:** ver en el navegador la nueva PWA para detectar cambios visuales, **sin cambiar** `web-talaeats` / puerto 18195, el backend 18190, PM2, PostgreSQL, Redis, Stripe, Cloudflared ni Nginx global. El nuevo entorno se publica sólo en **127.0.0.1:18196** y es de **solo lectura** (salvo login/logout de cuentas existentes).

### 1. Kali, obtener versión exacta y construir como usuario sin privilegios

Ejecutar desde la terminal Kali iniciada como `alan`:

```bash
sudo -iu tala-node-stage bash <<'BUILD'
set -euo pipefail
export PATH="$HOME/.local/node24/bin:$HOME/.local/bin:$PATH"
REPO="https://github.com/AlanPalacios23/tala-eats-version-web.git"
BRANCH="feat/mobile-parity-v1046-navigation"
SHA="$(git ls-remote "$REPO" "refs/heads/$BRANCH" | awk '{print $1}')"
[[ "$SHA" =~ ^[a-f0-9]{40}$ ]] || { echo "PREVIEW_ABORT=SHA_MISSING"; exit 1; }
ROOT="$HOME/tala-eats-web-releases/$SHA"
mkdir -p "$HOME/tala-eats-web-releases"
[[ ! -e "$ROOT" ]] || { echo "PREVIEW_ABORT=RELEASE_ALREADY_PRESENT_USE_FRESH_SHA"; exit 1; }
git clone --depth 1 --branch "$BRANCH" "$REPO" "$ROOT"
[[ "$(git -C "$ROOT" rev-parse HEAD)" == "$SHA" ]] || { echo "PREVIEW_ABORT=BRANCH_MOVED"; exit 1; }
cd "$ROOT"
node --version
npm install --no-audit --no-fund
npm run check
VITE_PREVIEW_READONLY=true npm run build
grep -Fq '<meta name="tala-preview-mode" content="read-only" />' dist/index.html
bash deploy/kali-review-preview.sh --plan "$SHA"
printf '\nPREVIEW_SHA=%s\n' "$SHA"
BUILD
```

**No copiar contraseñas, variables secretas ni claves Stripe.** `--plan` verifica el backend existente con un GET a `18190/api/v1/health`, comprueba que no haya conflictos con el puerto preview y que el build incluya el bloqueo de escritura. Si retorna HOLD/ABORT, no ejecutar el siguiente paso. El checkout web usa el backend existente solo para **lecturas** en revisión.

### 2. Instalación independiente y con rollback

Copiar el SHA completo de `PREVIEW_SHA` que apareció arriba. Desde `alan`:

```bash
SHA="<PREVIEW_SHA_DE_40_CARACTERES>"
sudo bash "/home/tala-node-stage/tala-eats-web-releases/$SHA/deploy/kali-review-preview.sh" \
  --apply "$SHA" I_APPROVE_READONLY_PREVIEW_ONLY
```

PASS esperado: `PREVIEW_APPLY=PASS`. Creará **exclusivamente** `/srv/talaeats-web-preview/releases/$SHA`, su puntero `current`, el servicio aislado `talaeats-web-preview.service` y su configuración en `/etc/talaeats-web-preview`. No toca 18195, la API 18190, cloudflared, nginx.service ni el frontend público.

### 3. Abrir la revisión

Desde Kali mismo:

- `http://127.0.0.1:18196/clientes` (Usuarios)
- `http://127.0.0.1:18196/buscar`
- `http://127.0.0.1:18196/comercio/ID_REAL`
- `http://127.0.0.1:18196/pedidos` (login existente)
- `http://127.0.0.1:18196/editar-perfil` (sólo vista, guardado bloqueado)

Si quieres abrir desde Windows, usa un **túnel SSH**, sin exponer la nueva app a Internet:

```powershell
ssh -N -L 18196:127.0.0.1:18196 alan@IP_REAL_DE_KALI
```

Mantén esa terminal abierta y visita **http://localhost:18196/clientes** en el navegador de Windows. Sustituye el texto `IP_REAL_DE_KALI` por la IP actual del servidor, no lo pegues literalmente. HTTPS con hostname nuevo y Cloudflare Access solo se configura después de autorizarlo.

### 4. Comprobación y diagnóstico en Kali

```bash
curl -fsS http://127.0.0.1:18196/__preview_health
curl -s -o /dev/null -w 'Clientes HTTP %{http_code}\n' http://127.0.0.1:18196/clientes
curl -s -o /dev/null -w 'API health HTTP %{http_code}\n' http://127.0.0.1:18196/api/v1/health
sudo systemctl status talaeats-web-preview.service --no-pager
```

Todos los endpoints anteriores son **GET**, no crean compras. La respuesta health debe ser `TALA_EATS_PREVIEW_READ_ONLY`. El backend sigue siendo el existente: un login válido puede crear una sesión, pero el proxy Nginx bloquea todos los demás métodos de escritura al backend; el cliente React añade otro bloqueo. Por eso **no** se pueden hacer pedidos, registrar restaurantes, editar perfil o cobrar con Stripe en esta vista.

### 5. Siguientes versiones y vuelta atrás

Para revisar una versión posterior, repetir el paso 1 sobre su SHA nuevo y el paso 2. El script cambia sólo el enlace `current` de forma atómica y conserva el SHA anterior en `previous`. Después de una actualización puedes volver a la versión de preview anterior con:

```bash
sudo bash "/home/tala-node-stage/tala-eats-web-releases/$(readlink -f /srv/talaeats-web-preview/current | sed 's@.*/@@')/deploy/kali-review-preview.sh" \
  --rollback I_APPROVE_PREVIEW_ROLLBACK_ONLY
```

Ese rollback solo modifica la vista previa en `18196` y se niega a actuar si no hay una versión anterior. Si un comando falla, **no cambies** a mano los symlinks de producción.

## Cómo validar sin afectar dinero real
- Capturar Inicio/Buscar/Detalle/Carrito/Cuenta a 320/360/390/430 px; comparar con Flutter.
- Abrir sesión de prueba ya existente y recorrer cuenta/órdenes (lectura).
- Ver cómo muestra el backend los bloqueos de cotización/Stripe LIVE.
- Las pruebas financieras, chat, propinas, pagos, ledger y entrega deben ejecutarse luego contra **un backend staging aislado con pagos TEST**. El entorno 18196 no las ejercita y no puede demostrar E2E.
