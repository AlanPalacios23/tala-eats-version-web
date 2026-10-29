# Tala Eats Repartidores RC138 — Despliegue aislado y prueba comercial

**Objetivo:** actualizar solamente la PWA pública de Repartidores en
`repartidores-talaeats.alan-palacios-dev.com` (nginx `127.0.0.1:18199`),
manteniendo los procesos Node LIVE en 18190 y los portales Clientes 18195,
Restaurantes 18197, Stripe y PostgreSQL sin cambios.

**Estado:** paquete preparado en PR #21. **No se ha ejecutado en Kali**.
La rama de backend RC13.8 en GitHub NO prueba por sí sola que sea la versión
que PM2 está ejecutando. Nunca sustituir el SHA detectado en PM2 por un SHA
que simplemente exista en GitHub.

## GO 0 — GitHub

1. Verificar para el SHA final del PR #21 que CI general, compilación
   `build:repartidor` y QA visual 320/360/390/430 dp terminaron en PASS.
2. Verificar que el equipo acepta este SHA exacto. No usar una rama móvil
   como entrada directa de producción.
3. Para la operación siguiente establecer `WEB_SHA` manualmente con
   **40 caracteres** del commit aprobado en GitHub, nunca con un nombre
   de rama. **No pegar tokens, cookies ni el .env en un chat.**

## GO 1 — Kali: preparar build, sin despliegue

Desde la terminal de Kali:

```bash
sudo -iu tala-node-stage
export PATH="$HOME/.local/node24/bin:$HOME/.local/bin:$PATH"
WEB_SHA='PEGAR_AQUI_SHA_WEB_40_CARACTERES'
[[ "$WEB_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo 'SHA web inválido'; exit 2; }
TOOLS="$HOME/tala-eats-driver-tools-$WEB_SHA"
git clone --no-checkout https://github.com/AlanPalacios23/tala-eats-version-web.git "$TOOLS"
git -C "$TOOLS" fetch origin "$WEB_SHA"
git -C "$TOOLS" checkout --detach "$WEB_SHA"
test "$(git -C "$TOOLS" rev-parse HEAD)" = "$WEB_SHA"
bash "$TOOLS/deploy/rc138-kali-build-driver-only.sh" "$WEB_SHA"
```

`DRIVER_RC138_BUILD=PASS_NOT_DEPLOYED` significa que compiló la PWA del
repartidor desde ese commit. No significa que un pedido real esté validado.

## GO 2 — Detectar el backend LIVE REAL

Todavía como `tala-node-stage`:

```bash
GATE="$HOME/tala-eats-web-releases/$WEB_SHA/deploy/rc138-kali-driver-live-preflight.sh"
bash "$GATE" --detect-backend
```

El resultado **único** debe ser
`DRIVER_RC138_CURRENT_LIVE_BACKEND_SHA=<SHA40>`.
Escribir manualmente ese valor en `BACK_SHA`, por ejemplo:

```bash
BACK_SHA='PEGAR_AQUI_SHA_BACKEND_LIVE_40_CARACTERES'
[[ "$BACK_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo 'SHA backend inválido'; exit 2; }
DEPLOY="$HOME/tala-eats-web-releases/$WEB_SHA/deploy/rc138-kali-driver-deploy.sh"
bash "$DEPLOY" --plan "$WEB_SHA" "$BACK_SHA"
```

Debe aparecer `DRIVER_RC138_PLAN=PASS_EXACT_BACKEND_AND_STATIC_PRECHECK`
y `DRIVER_RC138_DEPLOY=NOT_STARTED_PLAN_ONLY`. Si indica HOLD, **no
aplicar ni forzar las flags**. El plan comprueba PM2 API y worker en el
mismo SHA, contratos actuales, endpoints privados (401/403), backend
`health`/`ready`, capacidades de registro, servicio aislado, build
fijado y configuración de entrega.

El plan imprime solo algunas banderas de valor booleano, nunca las claves
Stripe ni contraseñas. **Un valor en el archivo .env no demuestra por sí
solo que una transacción fue contabilizada o que el proceso haya recargado
esa configuración.**

## GO 3 — Cambio estático aislado (requiere aprobación del operador)

Confirmar ventana de operación y que no se va a interrumpir a un repartidor
con una entrega en curso. Ejecutar el comando siguiente solo después del GO 2:

```bash
sudo bash "$DEPLOY" --apply "$WEB_SHA" "$BACK_SHA" I_APPROVE_DRIVER_RC138_STATIC_ONLY
```

La operación ejecuta primero el mismo preflight, luego el actualizador
estático existente, que respalda el release previo, y finalmente el
postflight del SHA exacto. Si falla postflight intenta rollback del
frontend de Repartidores. **No reinicia PM2, ni modifica Stripe, ni toca
los otros dos portales**. Un error de rollback exige detenerse y revisar
el estado: no reintentar a ciegas.

Comprobar también desde móvil Android/iPhone que el inicio y el manifest
cargan desde el dominio de Repartidores, que la navegación queda dentro de
la PWA, que los botones no se tapan con teclado/safe area y que no hay
errores de autenticación o service worker obsoleto.

Para rollback manual autorizado, desde Kali:

```bash
sudo bash "$HOME/tala-eats-web-releases/$WEB_SHA/deploy/kali-update-repartidores-isolated.sh" \
  --rollback I_APPROVE_REPARTIDORES_STATIC_ROLLBACK_ONLY
```

## GO 4 — Prueba E2E **real** (NO se ejecuta por los scripts)

La presencia online por sí sola no habilita el despacho. Primero verificar
los modos financieros que **ya** están aprobados en el backend realmente
activo. Si alguno está HOLD, no crear pedidos para probar ese modo ni
activar banderas durante el despliegue PWA.

1. **Identidades reales:** un restaurante verificado, catálogo real y
   dueño activo; un conductor diferente, verificado por ADMIN y con su
   moto, placas y documentación real. Cliente comprador real distinto.
   No usar cuentas demo para sustituir esta prueba.
2. **Disponibilidad:** abrir la PWA del conductor en móvil con HTTPS,
   permitir ubicación precisa, pasar a "En línea" y comprobar el GPS
   reciente en la respuesta autenticada `/driver/presence-readiness`.
   La respuesta debe autorizar `ready_for_dispatch` para tomar nuevos
   pedidos; si es false no intentar forzar un claim.
3. **Compra consentida:** cliente escoge producto y dirección real;
   confirma expresamente el total y el medio de pago habilitado. Nunca
   ejecutar cobros Stripe LIVE automáticamente desde el diagnóstico.
4. **Restaurante:** acepta, prepara y cambia a LISTO. El repartidor
   recibe una asignación propia o acepta una oferta autorizada por el
   servidor, nunca por flags del navegador.
5. **Repartidor:** recoge `assigned → picked_up`, inicia recorrido
   `picked_up → on_the_way`, solicita el PIN al cliente, valida.
   En efectivo, **recibe físicamente y cuenta el total completo** antes
   de marcar el check de cobro. Si no hay dinero o PIN correcto, NO
   confirmar entrega.
6. **Finanzas:** pedido `delivered`, estado de pago legítimo según el
   medio, ledger idempotente, custodia del dinero por el conductor y
   recibo de traspaso al comercio según la versión aprobada de backend.
   No tratar efectivo recibido como "ganancias retirables". No hacer
   payout ni transferencia bancaria para completar esta prueba.
7. **Seguridad/resiliencia:** evitar doble confirmación; al reabrir la
   PWA el pedido debe seguir asignado al mismo conductor; usuario ajeno
   no puede ver dirección/PIN/ganancias ni completar el pedido; errores
   401/403 no se convierten en "En línea". Comprobar que cliente y
   comercio también muestran el mismo estado.

Registrar **solo**: SHAs, hora local, ID interno del pedido (sin PII),
medio de pago, estados de cada transición, estado contable y GO/HOLD.
Nunca adjuntar PIN, número de tarjeta, cuenta bancaria, teléfono,
dirección del cliente, cookies, token o secretos.

## STOP / HOLD obligatorio

- Backend API/worker con SHAs distintos o código de ruta ausente.
- Health/ready fallan, Redis/GPS no reciente, conductor no verificado.
- Entrega efectivo no autorizada por el backend, handoff de dinero
  no reconciliado o emisión financiera no soportada.
- Entrega bloqueada en una transición, duplicación de pedido,
  estado de cobro ambiguo o comprobante que no coincide.
- No existe respaldo anterior verificable, QA del SHA de PWA no está
  verde o la prueba real aún no se pudo ejecutar.

**Resultado de este runbook:** PWA preparada para un despliegue estático
acotado. El GO comercial se concede **después**, por evidencia real.
