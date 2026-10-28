# Tala Eats Restaurantes Web — Preproducción y Stripe Connect

**27 de octubre de 2026 · candidato PR #7 (rama `feat/restaurantes-premium-clean-20261027`) · NO DESPLEGADO.**

## Arquitectura que se conserva

- Una sola API Node LIVE existente detrás de `/api/v1`: el servidor de comercios NO se sustituye.
- Paquete de Restaurantes independiente: `npm run build:restaurante` → `dist-restaurantes/`, servicio Nginx aislado en `127.0.0.1:18197`; Clientes sigue en `18195`.
- El dominio propuesto `restaurantes-talaeats.alan-palacios-dev.com` **no se considera publicado** hasta auditar Nginx, Cloudflare y el túnel.
- Finanzas y Stripe: **la web jamás guarda claves secretas, cuentas bancarias ni PaymentIntents propios**. El servidor determina quién puede cobrar; los retiros/transferencias automáticos siguen deshabilitados.

## Flujo real para conectar un restaurante a Stripe Connect

1. **ADMIN autorizado + MFA** verifica comercio, propietario y cuenta real `acct_...` del propio comercio. Solo si no está mapeada, usa `/admin/conectar-restaurante` → `POST /admin/finance/connect-map`. No reutilizar el identificador Stripe de la plataforma y **no repetir un mapeo existente**.
2. **Propietario con sesión restaurante** entra a *Más → Activación de pagos*. La app consulta `GET /owner/finance/connect/:restaurantId/status` y valida el formato y la correspondencia de identidad del negocio cuando el servidor envía `restaurant_id`.
3. Si hay una vinculación real aún sin consentimiento, el dueño **verifica por un canal confiable con ADMIN** que la cuenta mapeada es la suya, marca explícitamente el consentimiento y confirma. Se usa `POST /owner/finance/connect/:id/confirm`; la UI exige `owner_confirmed=true` antes de reportar éxito. **No saltar consentimiento ni auto-confirmar.**
4. Después, el dueño pulsa *Continuar de forma segura en Stripe*: el servidor emite `POST /owner/finance/connect/:id/onboarding-link`. La web comprueba `https://connect.stripe.com` exacto, credenciales URL vacías, puerto ordinario y `expires_at` Unix futuro. Enlace **de un solo uso**: no guardarlo, no imprimirlo en logs, no reutilizarlo; si caduca se solicita otro manualmente.
5. A la vuelta, el dueño abre *Activación* y pulsa *Verificar estado de nuevo*. Se muestra **Verificado** solo si el backend informa `ready=true` y se completaron los pasos registrados. Si `ready` no está presente, se mantiene **Validación pendiente**: no inferir autorización de cobro a partir de capacidades aisladas.
6. El backend LIVE debe seguir verificando permisos del comerciante, pagos y ledger por pedido. Esta PWA **no habilita Stripe LIVE global, payouts ni workers**, y no crea ninguna transacción financiera en el onboarding.

## Gates previos al lanzamiento

| Bloqueo | Evidencia requerida |
|---|---|
| Código | CI del **mismo SHA**: todas las suites, TypeScript, cliente y compilación Restaurantes en SUCCESS |
| Diseño | QA de Restaurantes `320/360/390/430/768/1280` y build merchant-only, sin overflow, controles de móvil táctiles y navegación correcta |
| Regresión | Capturas de Usuarios Web SUCCESS en **el mismo SHA** |
| Aislamiento | Host 18197 solo rutas de Restaurantes; sin tocar 18195, PostgreSQL, Cloudflare, Redis, Stripe, PM2 ni 18190 |
| Identidad | Auth usuario restaurante, role/2FA, HTTP-only session, `GET owner/restaurant` y `GET owner/orders` autorizados; fallos aislados |
| Stripe Connect | Lectura real de status + consentimiento voluntario + enlace Stripe vigente + vuelta/refresh; no registrar secreto/enlace |
| Finanzas | `owner/finance` y earnings del restaurante autorizado; saldo retirable no demostrado, retiro deshabilitado |
| Operación | Activación solo con consentimiento y un comercio legítimo; pedido pickup efectivo/tarjeta, PIN, ledger, webhooks y cierre **con participantes que acepten el cargo real**, no en CI |
| Reversión | Backup de artefactos, SHA pinneado, `--plan` sin efectos, autorización explícita del `--apply`, prueba de rollback |

## Preparación de despliegue en Kali (solo lectura primero)

1. Leer `docs/RESTAURANTES-DOMINIO-KALI-18197.md` y comprobar por lectura el puerto/host, permisos de usuario de servicio y la versión del backend.
2. Verificar que los tres workflows de GitHub del mismo **SHA exacto** terminaron en SUCCESS.
3. Inspeccionar `deploy/kali-install-restaurantes-isolated.sh --plan <SHA>` para primera instalación del host aislado; o `deploy/kali-update-restaurantes-isolated.sh --plan <SHA>` si ya está instalado. **No ejecutar un `--apply` en esta fase**.
4. Revisar la configuración Nginx CSP/MIME y servir localmente `/fonts/restaurante/Figtree-VF.ttf`, `BricolageGrotesque-VF.ttf`, sus licencias OFL y `/manifest-restaurante.webmanifest`. Verificar SW de Restaurantes sin caché de pedidos/finanzas.
5. Conservar la opción de rollback, solicitar aprobación explícita para instalación y solo después configurar túnel/dominio y probar login seguro. No se da por hecho que el dominio ya exista.
6. Repetir pruebas E2E reales con el comerciante piloto **sin cargos simulados en Stripe LIVE** y verificar que no exista un mapeo Connect repetido.

## Advertencias de producto

- **Paridad de UI no es paridad bancaria**: Wallet muestra información contable y movimientos del backend, pero no hay endpoint POST LIVE verificado para retirar ganancias; el botón explica esta limitación.
- Los datos del servidor pueden requerir documentación o validación adicional aunque la app muestre los pasos completos.
- No inferir que las transferencias automáticas están activadas porque `transfers_active` o `payouts_enabled` sea verdadero: son capacidades de la cuenta, no liquidaciones de Tala Eats.
- Las capturas sintéticas ayudan a probar tamaños y navegación, pero la equivalencia 100% píxel a píxel con Flutter requiere comparar golden screenshots nativos equivalentes, aún no disponibles en el repositorio.
