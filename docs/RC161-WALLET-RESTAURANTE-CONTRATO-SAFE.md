# RC161 — Wallet y liquidaciones del restaurante: contrato verificado y bloqueo seguro

## Alcance
Esta versión agrega **solo lecturas** en la PWA de Restaurante. No envía dinero, no solicita retiros, no crea cuentas Connect, no almacena números bancarios y no modifica la API, tablas ni Stripe.

### Separación obligatoria
1. `/api/v1/platform/wallet` del backend Python: **wallet de recompensas de clientes**; **NO** usar en Restaurante.
2. `GET /api/v1/owner/finance`: **contabilidad histórica de restaurante**, no saldo bancario. Sus `gross_food_sales`, `commission`, `net_payable` y `payouts` no prueban pago recibido.
3. `GET /api/v1/withdrawals/restaurant/{restaurant_id}/balance`: dinero que el servicio de retiros comprobó contra transferencias Connect reales y Stripe (si el endpoint está habilitado). Respuesta válida: `currency=MXN`, `source=delivered_paid_stripe_connect_transfers_only`, números en centavos y condiciones `bank`, `reconciling` y `server_allows_requests`.
4. `GET /api/v1/withdrawals/restaurant/{restaurant_id}/history`: historial de solicitudes al proveedor, no de todos los pedidos.
5. `GET /api/v1/withdrawals/restaurant/{restaurant_id}/connect/status`: estado de cuenta bancaria; un estado `verified` no autoriza por sí solo un payout.

## Situación entre repositorios
El contrato anterior se inspeccionó en el repo Python `AlanPalacios23/AlanPalacios23-tala-eats-backend` en `backend/app/routes/withdrawals.py` y `backend/app/routes/operations.py`.

**No se ha comprobado que el backend Node de producción en Kali publique los mismos endpoints o esquemas**. Este repositorio web no contiene su implementación Node. La PWA debe mostrar **No disponible** ante ruta ausente, 403, 409, 503, error de red o payload incompatible. No se deben estimar montos con los pedidos.

## Seguridad del frontend
- Todos los métodos agregados son GET sin cambios financieros.
- Las respuestas monetarias deben conservar centavos enteros seguros (sin `NaN`, Infinity, negativos, exponenciales ni cadenas no verificadas).
- La contabilidad se acepta únicamente si `restaurant_id` coincide con el restaurante autenticado consultado.
- El saldo Stripe se acepta solo en MXN, con la fuente esperada, si sus valores son íntegros y el importe resulta coherente con fondos elegibles, reservados y disponibles.
- Se muestra únicamente banco y últimos cuatro dígitos cuando la API los verifica. No recoger CLABE, tarjetas o secretos.
- Las solicitudes de retiro **siguen desactivadas en el frontend**, aunque `server_allows_requests` esté activado en un backend antiguo.
- Una entrega, venta, captura de Stripe, cuenta Connect o registro contable no equivale a dinero depositado en banco.
- Saldo contable, saldo Stripe conciliado y retiro realmente pagado deben visualizarse por separado.

## Plan de integración futura con Node (sin aplicarlo todavía)
1. Identificar SHA y esquema exactos del Node LIVE de Kali, sin secretos. Confirmar roles y IDs de negocio; rutas de lectura equivalentes o documentar `unsupported`.
2. Construir pruebas de contrato de esos GET con una cuenta de restaurante en **staging**: sin datos, datos consistentes, comercio ajeno, sin banco, reembolso, transferencia revertida, webhook pendiente, saldo reservado, 409/503/404.
3. Stripe TEST: verificar cuentas Connect, transferencias reales sandbox, balances, webhooks firmados, conciliación, KYC y restricciones bancarias. No generar pagos LIVE.
4. Solo después de evidencia y autorización explícita, diseñar flujo de retiro con 2FA de un solo uso, clave idempotente, doble confirmación, límites y fallo cerrado; no habilitar sin datos verificables.
5. Preflight contra Kali, CI + backup + rollback probado. No publicar una PWA nueva sobre la PWA de restaurantes del servidor si su SHA y arquitectura no coinciden con este repo.

## QA RC161
- `npm test` valida formato monetario estricto, alcance por restaurante, proveedor MXN, saldos coherentes, historia y ausencia de POST financieros.
- `npm run build` compila TypeScript y genera PWA; comprobar además responsive y sesión real antes de desplegar.
- Esta PR es **draft** y NO modifica Kali, Node, base de datos, Stripe ni migraciones.
