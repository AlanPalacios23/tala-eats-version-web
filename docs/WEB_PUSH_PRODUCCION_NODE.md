# Tala Eats Web Push real — contrato backend Node.js y puerta de producción

Estado: frontend preparado; **no declarar entrega push real** hasta completar verificación Node + worker + dispositivo. Ninguna clave VAPID privada debe publicarse en GitHub, HTML ni JavaScript.

## Contrato existente comprobado en backend Python anterior
Se implementó Web Push (NO FCM nativo) en el backend Python anterior:
- `GET /api/v1/v11/push/config` público: `{enabled: boolean, public_key: string | null}`.
- `POST /api/v1/v11/push/subscriptions` autenticado: JSON `{endpoint, p256dh, auth, platform:"web", device_label:"Tala Eats PWA"}`; debe responder 201 con `{id, active:true}`. Solo entonces la PWA declara activación.
- `DELETE /api/v1/v11/push/subscriptions/:id` autenticado para desactivar la suscripción propiedad del usuario: respuesta 204.
- Worker genera Web Push VAPID para notificaciones persistidas por el backend y registra los intentos sin duplicar envíos.
- Cuerpo del mensaje: `{"title":"...","body":"...","url":"/notificaciones"}`, también admite `/pedidos/<id>` autorizado por el servidor; Service Worker descarta URLs externas.
- Suscripciones reasignadas por endpoint deben **desactivar registros anteriores** de otras cuentas en un dispositivo compartido.
- Promociones requieren consentimiento de marketing independiente. La activación de notificaciones operativas no lo concede.

## Gate del backend Node.js de Kali
No asumir que los endpoints antiguos de Python se replicaron. Primero comprobar sus rutas reales y que el worker Node consume el outbox y despacha push:
1. Configurar claves VAPID públicas/privadas en el entorno **solo del servidor**, y verificar que Node expone exactamente `GET /api/v1/v11/push/config` por el mismo dominio PWA.
2. Implementar y probar registro, desactivación, autenticación, ownership, cifrado/protección de credenciales push, revocación de endpoint compartido, rotación de claves, expiración HTTP 404/410 y deduplicación idempotente.
3. Vincular creación de notificaciones de pedido/estado/pago/entrega a la cola persistente; el worker debe usar VAPID y confirmar resultado por proveedor, reintentos acotados y sin duplicar envíos.
4. Validar terminal real: abrir `/notificaciones` → Activar → permiso del navegador → ID persistido en backend → generar un evento legítimo de prueba de una cuenta controlada → confirmar recepción con app cerrada → toque abre PWA y pedido autenticado.
5. Validar Android Chrome y iOS PWA instalada y permitida en Ajustes. iOS Safari sin instalación puede no soportar el mismo flujo.

## Seguridad
- Nunca solicitar permiso desde el primer aviso de instalación ni sin toque del usuario.
- Nunca enviar push de pago confirmado sin estado confirmado por el backend.
- No usar notificaciones simuladas ni intervalos locales para falsificar eventos.
- El service worker NO intercepta/cachea los endpoints `/api/` ni pagos.
- En cierre de sesión, intentar baja del endpoint y revocación local para evitar exposiciones en dispositivos compartidos.
- El instalador de Kali por defecto se detiene si `push/config` no confirma VAPID; `--frontend-only` instala únicamente los cambios de interfaz, dejando el botón deshabilitado hasta que el backend sea compatible.

## Comprobación en Kali (sin modificaciones)
```bash
curl -fsSL https://raw.githubusercontent.com/AlanPalacios23/tala-eats-version-web/feat/mobile-parity-v1046-navigation/deploy/INSTALAR_WEB_PUSH_TALA_EATS_KALI.sh -o "$HOME/INSTALAR_WEB_PUSH_TALA_EATS_KALI.sh"
bash "$HOME/INSTALAR_WEB_PUSH_TALA_EATS_KALI.sh" --check
```
Un `WEB_PUSH_NODE_VAPID_CONFIG=PASS` prueba **solo la configuración pública**; **NO** prueba el worker, los registros autenticados ni la entrega al dispositivo.
