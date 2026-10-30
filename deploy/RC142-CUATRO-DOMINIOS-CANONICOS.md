# Tala Eats — cuatro dominios públicos canónicos (PLAN, SIN CAMBIOS LIVE)
Fecha de revisión: 2026-10-29. Repositorio web candidato: rama `feat/rc141-driver-native-ux-resilience-20261029`; backend desplegado RC13.8.

## Única arquitectura destino
| Rol | Hostname | Origen interno |
|---|---|---|
| Web/clientes | `web-talaeats.alan-palacios-dev.com` | Nginx `127.0.0.1:18195` |
| Repartidores | `repartidores-talaeats.alan-palacios-dev.com` | Nginx `127.0.0.1:18199` |
| Restaurantes | `restaurantes-talaeats.alan-palacios-dev.com` | Nginx `127.0.0.1:18197` |
| Tienda/comercio | `tienda-talaeats.alan-palacios-dev.com` | PWA y puerto nuevo POR DEFINIR; **NO existe el despliegue** |

Backend único Node.js LIVE `127.0.0.1:18190`; PostgreSQL y Redis compartidos.
El API público será **mismo origen** `/api/v1/*` detrás de los cuatro hostnames, no un quinto dominio API permanente.
Las funciones administrativas deben mantener autorización servidor+MFA en ruta `/admin` de una aplicación autorizada, sin dominio ADMIN nuevo.

## ¡No eliminar todavía el dominio antiguo del backend!
`talaeats.alan-palacios-dev.com` actualmente es dependencia crítica:
- Aplicaciones Flutter **Clientes, Restaurante, Repartidor** (rama `main` de `tala-eats-mobile`) tienen URL predeterminada `https://talaeats.alan-palacios-dev.com/api/v1`.
- Backend RC13.8 contiene URLs de regreso/refresh de Stripe Connect con ese host en tres módulos.
- Backend contiene recuperación de contraseña con ese host.
- Web Vite dev proxy apunta al host antiguo.
- Webhooks Stripe LIVE apuntan a la ruta productiva acordada: la dirección exacta en Dashboard debe verificarse ANTES de cambiar el hostname. Una simple respuesta 200 no acredita firma Stripe.
- Puede haber instalaciones móviles existentes que no se actualicen al mismo tiempo.

Eliminar DNS/cloudflared de dicho hostname sin migración provocaría caída parcial, pagos sin registrar o errores de recuperación. **No ejecutar borrados/redirects sobre POST de Stripe a ciegas.**

## Secuencia segura

1. **Auditar, no mutar**. En Kali ejecutar `bash deploy/rc142-auditar-dominios-solo-lectura.sh` desde un checkout de esta rama, o copiar el script al servidor y ejecutarlo sin sudo. Revisar aparte Public Hostnames en Zero Trust si Cloudflared se administra remotamente. El inventario sólo imprime hostnames y códigos HTTP; no credenciales.
2. **Congelar nombres**. Mantener únicamente tres PWA ya desplegadas y añadir la cuarta de Tienda cuando tenga implementación real. No crear API, base o dominio nuevos por cada versión, función, checkout, worker o prueba.
3. **Migrar fuentes**. Sustituir URLs absolutas antiguas en PWA, apps Flutter y backend con configuración controlada. Para PWAs, consumir exclusivamente `/api/v1/*` en el mismo origen. Para apps nativas, definir como host canónico de API uno de los cuatro existentes con proxy seguro (p.ej. `web-talaeats.../api/v1`) y distribuir nuevas versiones antes de apagar el anterior. Ajustar Stripe Connect callbacks y recuperación.
4. **Migrar proveedores**. Validar y registrar nuevo destino Stripe webhook (carga cruda, firma, idempotencia, sin eventos perdidos), completar prueba Stripe TEST y seguimiento LIVE cuidadosamente aprobado. Configurar URLs autorizadas de los proveedores externos. Mantener origen anterior durante cutover y verificar ausencia de eventos duplicados.
5. **Revisar los accesos**. Comprobar `/api/v1/health` para cuatro hosts, API protegidas como 401/403 anónimo, rutas e iconos PWA, manifest, service worker, subida de documentos, autenticación por cookies, correos, Stripe Connect y la app nativa. Confirmar que la PWA de Tienda no falsifica identidad de restaurante.
6. **Retirar LEGACY por etapas**. Una vez constatadas versiones móviles, callbacks, webhooks, enlaces, correo y logs sin tráfico legítimo, retirar `talaeats...` y otros hostnames históricos de Cloudflare, no del backend interno. Documentar reversión del DNS/ingress. No eliminar túneles de otras aplicaciones ajenas a Tala Eats.

## Fuera del alcance de este PR
- No se modifica Cloudflare DNS, tunnel config, Nginx productivo, PM2, base de datos, Stripe o dinero.
- No se crea ni anuncia una PWA de Tienda inexistente.
- No se deja de servir el viejo API mientras haya dependencias.
- `api-stage-talaeats...` y preview son **candidatos** a retirar de exposición pública, no se supone que estén actualmente activos.

**Gate comercial:** cuatro dominios visibles, API consistente, login y callbacks probados; nada de inventar tiendas o habilitar cash/delivery/payouts durante la limpieza.

## Diagnóstico real de Kali del 29 de octubre (segunda auditoría)

| Hostname | GET / | GET /api/v1/health |
|---|---:|---:|
| web-talaeats | 200 | 200 |
| repartidores-talaeats | 302 | 200 |
| restaurantes-talaeats | 302 | 200 |
| tienda-talaeats | 000 | 000 |
| talaeats (API legado) | 404 | 200 |
| api-stage-talaeats | 404 | 200 |
| preview-talaeats | 000 | 000 |

También: `TALAEATS_CLOUDFLARED_READABLE_CONFIG_COUNT=1`; un config remoto no legible para `alan`, sin hostname de Tala Eats expuesto por los archivos legibles; dos `server_name` localizados (restaurantes y repartidores); uno de Nginx no legible. Ningún archivo / contenido privado fue mostrado. **NO se verificó el mapeo completo de Cloudflare**.

Acciones seguras:
1. Consultar únicamente campos `version/status/production/environment` del `/api/v1/health` en `web`, `talaeats`, `api-stage`; nunca imprimir tokens del backend ni confiar sólo en códigos HTTP para identificar un entorno.
2. Auditor de mapeos host=>servicio desde cuentas con permisos adecuados, limitando impresión a hostnames Tala Eats y puertos locales. Si cloudflared es remoto, inventario manual desde Zero Trust.
3. Determinar si `api-stage` y API legado apuntan a servicios diferentes de 18190. Mantener ambos hasta que llamadas móviles, callbacks/Stripe/webhook y acceso antiguo se migren de forma supervisada.
4. Antes de retirar un hostname de staging, verificar que no sea destino necesario para integraciones de prueba: retirar publicidad del host puede ser admisible; borrar su backend/BD no lo es.

**NO-GO:** este inventario no autoriza borrado de hostnames, ni redirecciones de webhook Stripe por HTTP 302.
