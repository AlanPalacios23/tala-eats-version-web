# TALA EATS — Kali / portada + 3 PWAs con UNA API RC8.13

El portal de entrada **/** y las tres apps instalables **/clientes**, **/restaurante**, **/repartidor** tienen **manifiestos distintos** y un código React compartido. No hay 4 backends ni 4 bases de datos.

- Sitio PWA local: Nginx nuevo exclusivamente en `127.0.0.1:18195`.
- API existente: `127.0.0.1:18190/api/v1` (RC8.13 LIVE, PM2/Stripe sin reiniciar).
- Dominio público deseado: `https://web-talaeats.alan-palacios-dev.com`.
- Portada web: `/`; apps: `/clientes`, `/restaurante` y `/repartidor`.
- El reparto real sigue BLOQUEADO por el backend en LIVE; crear esta PWA
  **no habilita** driver GPS/aceptación/entrega ni liquidaciones.
- La última auditoría financiera informó 0 comercios aprobados en Stripe
  Connect: no fingir que el checkout comercial está listo.

## 1. Preparar frontend SIN tocar el servicio LIVE

Con el usuario existente **tala-node-stage** (ya tiene Node 24), usar
**SHA exacto** del último commit de `main` que haya pasado GitHub Actions.

```bash
(
set -euo pipefail
export PATH="$HOME/.local/node24/bin:$HOME/.local/bin:$PATH"
SHA="<SHA_DE_LA_VERSION_WEB_40_HEX>"
ROOT="$HOME/tala-eats-web-releases/$SHA"

test "$(id -un)" = "tala-node-stage"
mkdir -p "$HOME/tala-eats-web-releases"
test ! -e "$ROOT"

git clone --depth 1 --branch main \
  https://github.com/AlanPalacios23/tala-eats-version-web.git "$ROOT"
test "$(git -C "$ROOT" rev-parse HEAD)" = "$SHA"
cd "$ROOT"

node --version
npm install --no-audit --no-fund
npm run check

bash deploy/kali-install-pwa.sh --plan "$SHA"
)
```

Al ser una primera versión sin `package-lock.json` confirmado en `main`,
`npm install` fija las dependencias y luego `npm run check` ejecuta
pruebas + compilación. **Versionar el lockfile después de validarlo** y
pasar a `npm ci` para despliegues posteriores. El instalador prohíbe
archivos de secretos dentro de `dist/`.

**PASS esperado:** `PWA_INSTALL_PLAN=PASS_READ_ONLY`. Si retorna HOLD,
revisar el motivo y no usar --apply.

## 2. Primera publicación local (requiere sudo de alan)

**Desde la cuenta `alan` con sudo**, ejecuta el script del mismo SHA
creado bajo `/home/tala-node-stage`:

```bash
SHA="<SHA_DE_LA_VERSION_WEB_40_HEX>"
sudo bash "/home/tala-node-stage/tala-eats-web-releases/$SHA/deploy/kali-install-pwa.sh" \
 --apply "$SHA" I_APPROVE_NEW_PWA_NGINX_SITE_ONLY
```

Crea **solo** `/srv/talaeats-pwa/releases/$SHA`, su symlink
`/srv/talaeats-pwa/current` y el nuevo sitio Nginx
`/etc/nginx/sites-available/tala-eats-web-pwa.conf`. Aborta si esas rutas
ya existen, si el puerto 18195 está ocupado, si no encuentra Nginx, si el
backend no dice RC8.13 LIVE o si `nginx -t` falla; intenta revertir el nuevo
sitio ante un error. No modifica procesos PM2 ni Cloudflared, DB, Redis,
Stripe o sitios Nginx existentes.

**PASS esperado:** `PWA_KALI_NGINX_LOCAL_DEPLOY=PASS`.

## 3. Exponer el portal por HTTPS, sin tocar el dominio API

El hostname **nuevo** debe apuntar al mismo túnel Cloudflare (panel de
Cloudflare Zero Trust, Public Hostnames / Routes o archivo cloudflared
existente, según cómo se instaló). El origen esperado es:

```text
web-talaeats.alan-palacios-dev.com -> http://127.0.0.1:18195
```

**No sustituir** el hostname ya operativo
`talaeats.alan-palacios-dev.com -> 127.0.0.1:18190`.
No hacer `cloudflared service uninstall`, `tunnel delete`, ni
sobrescribir `/etc/cloudflared/config.yml` con un ejemplo genérico.

Si cloudflared usa YAML local, editar de forma aditiva previa copia
verificada (apuntando a su configuración concreta), mantener el catch-all
al final, validar sintaxis/rutas y recargar únicamente cloudflared.
Si usa túnel de administración remota, agregar Public Hostname desde
Cloudflare Dashboard sin modificar archivos locales.

## 4. Verificaciones sin generar compras ni cuentas de prueba

```bash
BASE="https://web-talaeats.alan-palacios-dev.com"
for path in / /clientes /restaurante /repartidor \
 /manifest.webmanifest /manifest-clientes.webmanifest \
 /manifest-restaurante.webmanifest /manifest-repartidor.webmanifest \
 /sw.js /api/v1/health;do
  curl -s -o /dev/null -w '%{http_code} %{url_effective}\n' \
   --max-time 12 "$BASE$path"
done
curl -fsS --max-time 10 "$BASE/api/v1/health"
```

Expected: HTTP 200 en todas las rutas, y health informa
`rc8.13-unified-live`, `production:true`. Luego abrir manualmente la
portada desde teléfono Android/iPhone, instalar las áreas desde cada
`start_url` y probar login por HTTPS. La compatibilidad con múltiples
instalaciones separadas por manifiestos del mismo origen depende del
navegador/SO; la navegación por los cuatro accesos siempre funciona.

Verificar respuestas con `Set-Cookie` HttpOnly, Secure y SameSite=Lax
sin imprimir tokens. El JS no almacena credenciales en localStorage; el
service worker no cachea respuestas API ni pedidos.

## Prioridad funcional después de publicar

1. Ingresar como Cliente (catálogo y consulta real).
2. Ingresar como Restaurante autorizado (menú, pedidos y cocina).
3. Ingresar como Repartidor (perfil e historial; **despacho LIVE bloqueado**).
4. Habilitar primer comercio real con autorización Stripe Connect, y
   después validar checkout de efectivo/Stripe e2e y reparto en entorno
   aislado antes de habilitar operaciones comerciales.

Nunca publicar credenciales en GitHub, logs o chat.
