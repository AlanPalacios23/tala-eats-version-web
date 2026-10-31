# RC156 · Repartidores PWA — Plan, publicación y control posterior SIN cambios financieros

## Estado de esta versión
Candidata de despliegue **no publicada**. Incluye RC144–RC155 solo en la cadena de ramas, que deberá revisarse al consolidarse en main.
La comprobación del backend es parte de la rama Node complementaria RC156; aprobar la PWA no implica que el backend LIVE soporte las rutas RC153–RC155.

## Identificar release y flags (no mutar)
1. En Kali identificar SHA de la versión realmente servida por `/srv/talaeats-repartidores-pwa/current` y comprobar que es un enlace simbólico a una release conocida. Revisar `previous` para rollback.
2. La ruta de staging con el código compilado previsto debe ser `/home/tala-node-stage/tala-eats-web-releases/<SHA>` y debe corresponder a ese mismo SHA, con tree limpio.
3. `VITE_DRIVER_SUPPORT_ENABLED` debe estar DESACTIVADO y `DRIVER_ORDER_SUPPORT_ENABLED` debe estar desactivado en Node. No asumir flags por tener botones compilados.
4. Antes de compilar: `npm run check` (tres bundles). Comprobar manifests, service workers y que no haya meta `tala-preview-mode` en los artefactos productivos.

## Puerta de despliegue de solo lectura (sin aplicar)
Tras preparar manualmente la release y su build exacto en Kali:
```bash
SHA="<SHA_REAL_40_HEX>"
SCRIPT="/home/tala-node-stage/tala-eats-web-releases/$SHA/deploy/kali-update-repartidores-isolated.sh"
bash "$SCRIPT" --plan "$SHA"
```
`--plan` valida la release y el site existente sin publicar; la ruta y el SHA deben existir REALMENTE en Kali. **No utilizar un SHA de esta guía**, ni reaplicar RC136 o su despliegue de tres PWAs para un cambio exclusivo de Repartidores.

## Confirmaciones previas al apply (manual)
- Backup verificado, `previous` apunta a release válida, symlink `current` dentro de `/srv/talaeats-repartidores-pwa/releases/`, Nginx aislado solo puerto 18199 y túnel correcto.
- QA móvil 320/360/390/430 dp: inicio, menú, avisos, GPS real y no disponible, pedidos, PIN, cambio A→B, wallet y soporte DESACTIVADO.
- El backend Node en producción debe estar identificado y autorizado; contratos `/driver`, `/platform/support/capabilities`, avatar y respuesta de tickets deben comprobarse en staging.
- El apply está fuera de esta PR. Requiere aprobación operativa explícita, script aislado y rollback probado, nunca confundir preflight con publicación.

## Posdespliegue (GET de solo lectura)
En la release Node RC156 confiable y sin cookies:
```bash
cd node-backend
node scripts/rc156-postdeploy-readonly.mjs --mode=live --with-pwas
```
El script visita API `health`, `ready`, exige 401 sin sesión en las rutas de soporte y verifica el HTML de las tres PWAs. **No envía pedidos, PIN, imágenes ni pagos**. Una validación PASS no verifica SHA de despliegue ni pruebas de sesión: corroborar ambos manualmente en Kali.

## Validación visual y funcional después de la publicación
1. Abrir `https://repartidores-talaeats.alan-palacios-dev.com/repartidor/acceso` en ventana limpia y dispositivo Android/iOS.
2. Confirmar PWA standalone, ruta original, login, identidad del usuario correcto, actualización de SW sin perder assets de sesiones anteriores y ausencia de pantalla blanca.
3. Sesión A→B: ofertas, PIN, importes/confirmaciones de efectivo, GPS, avatar, tickets y wallet de A no deben verse en B.
4. Sin red: bloquear aceptación, estado/pago y tickets; al volver, solo el servidor permite reintentar.
5. No activar botón de soporte con flag ON hasta que las pruebas del backend con **dos repartidores y pedidos reales de staging** demuestren aislamiento y deduplicación.
6. Verificar integridad de Usuarios/Restaurantes, dominios y mensajes PWA, sin tocar su contenido con un update Repartidores.

## Rollback
El script existente `deploy/kali-update-repartidores-isolated.sh` tiene modo `--rollback` con confirmación, pero **solo ejecutar** después de verificar manualmente `previous` y el procedimiento de operación autorizado. No intercambiar symlinks a mano sin respaldo; repetir smoke read-only después.
Si falla seguridad de sesión, autenticación, GPS, transiciones o contabilidad, detener el lanzamiento aunque el frontend conteste HTTP 200.

## Límites
RC156 no publica en Kali ni hace transferencias Stripe. El gate de backend RC156 revisa disponibilidad y acceso sin credenciales; pruebas E2E de tickets bajo autorización quedan pendientes en staging, no son simuladas en este script.
