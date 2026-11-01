# RC169 — Restaurantes en Kali, publicación aislada de RC168

Este documento prepara el despliegue; no afirma que se haya ejecutado. Se requiere el SHA exacto de una versión con GitHub Actions PASS. El PR #46 sigue siendo draft.

**NO ejecutar rc136-kali-promote-three-pwa.sh**, ya que publica también Usuarios y Repartidores. RC168 requiere su propio paquete y no coincide con la versión anterior de ese instalador.

## Entorno que se conserva

- Restaurantes: restaurantes-talaeats.alan-palacios-dev.com, 127.0.0.1:18197.
- Source: /home/tala-node-stage/tala-eats-web-releases/SHA
- Compilación: dist-restaurantes/restaurantes.html y sw-restaurante.js
- Servidos desde: /srv/talaeats-restaurantes-pwa/releases/SHA
- Links: /srv/talaeats-restaurantes-pwa/current y previous.
- Servicio existente: talaeats-restaurantes-pwa.service
- Backend LIVE existente: 127.0.0.1:18190 (solo lectura de health).
- No modificar Usuarios 18195, Repartidores 18199, PostgreSQL, PM2, Stripe, Nginx ni Cloudflared.

## PASO 1. Construcción y plan de solo lectura

Sustituye SHA por el commit con Actions PASS. Ejecutar como alan con sudo en Kali:

~~~bash
SHA="<SHA_DE_GITHUB_40_CARACTERES>"
sudo -H -u tala-node-stage bash -s -- "$SHA" <<'PREPARE_RESTAURANTES'
set -Eeuo pipefail
SHA="$1"
[[ "$SHA" =~ ^[a-f0-9]{40}$ ]] || { echo 'RC169_STAGE=HOLD_INVALID_SHA';exit 2; }
export PATH="$HOME/.local/node24/bin:$HOME/.local/bin:$PATH"
ROOT="$HOME/tala-eats-web-releases/$SHA"
REPO="https://github.com/AlanPalacios23/tala-eats-version-web.git"
if [[ ! -d "$ROOT" ]];then
  mkdir -p "$HOME/tala-eats-web-releases"
  git clone --no-checkout "$REPO" "$ROOT"
  git -C "$ROOT" fetch origin "$SHA"
  git -C "$ROOT" checkout --detach "$SHA"
fi
[[ ! -L "$ROOT" && "$(git -C "$ROOT" rev-parse HEAD)" == "$SHA" ]] || {
 echo 'RC169_STAGE=HOLD_SOURCE_MISMATCH';exit 2;
}
cd "$ROOT"
node --version
npm install --no-audit --no-fund --no-package-lock
npm run check
test -s dist-restaurantes/restaurantes.html
test -s dist-restaurantes/sw-restaurante.js
test -s dist-restaurantes/release.json
echo "RC169_STAGE=PASS_SHA:$SHA"
PREPARE_RESTAURANTES
sudo bash "/home/tala-node-stage/tala-eats-web-releases/$SHA/deploy/rc169-kali-restaurantes-static.sh" --plan "$SHA"
~~~

Si no termina con RC169_STAGE=PASS_SHA:... y RC169_RESTAURANTES_PLAN=PASS_READ_ONLY, no publicar.

## PASO 2. Promoción aprobada de solo 18197

~~~bash
sudo bash "/home/tala-node-stage/tala-eats-web-releases/$SHA/deploy/rc169-kali-restaurantes-static.sh" \
 --apply "$SHA" I_APPROVE_RC169_RESTAURANTES_STATIC_18197_ONLY
~~~

La promoción realiza backup, symlink atómico y verificación HTTP local. Esperado: RC169_RESTAURANTES_DEPLOY=PASS.

## PASO 3. Smoke público solo GET

~~~bash
bash "/home/tala-node-stage/tala-eats-web-releases/$SHA/deploy/rc169-restaurantes-smoke.sh" \
 "$SHA" https://restaurantes-talaeats.alan-palacios-dev.com
~~~

Exige SHA servido en HTML, manifest, iconos, SW propio y que Clientes/Repartidores no estén expuestos en el dominio Restaurantes. Esperado: RC169_PUBLIC=PASS_READ_ONLY. No ejecutar aquí el viejo script de smoke RC166 del portal compartido.

## Reversión manual aislada

Solo si el symlink previous conserva una versión previa válida:

~~~bash
sudo bash "/home/tala-node-stage/tala-eats-web-releases/$SHA/deploy/rc169-kali-restaurantes-static.sh" \
 --rollback I_APPROVE_RESTAURANTES_STATIC_ROLLBACK_ONLY
~~~

Verificar después Restaurantes y salud de API. No reiniciar backend, Redis, Nginx, Stripe o PM2.

## Validaciones reales todavía necesarias

- Iniciar sesión en Android/iOS con usuario restaurante autorizado y OTP si corresponde; negar roles ajenos.
- Pedidos, estados, Stripe pending bloqueado, cocina, menú, borradores, stock, filtros y pantalla del pedido.
- Wallet exclusivamente lectura; cero retiros bancarios en esta versión.
- Instalar PWA Android/iOS, acceso directo, back, teclado y actualización manual del SW sin pérdidas de cambios.
- Confirmar Usuarios 18195, Repartidores 18199, Node LIVE 18190 sin alteraciones.

CI y HTTP PASS no son pruebas comerciales end-to-end ni pruebas en dispositivos físicos.
