# RC9.8 · PWA Repartidores — paridad Flutter y alta con placas

Fuente visual: `AlanPalacios23/tala-eats-mobile/main/tala-eats-repartidor/app` (Flutter Perfil v1.2.4). Rama web: `feat/rc98-driver-flutter-parity-registration-20261028`. Rama backend: `feat/rc97-driver-signup-plate-contract-20261028` (PR #167).

## Lo que cambia en la web

- Inicio: saludo, disponibilidad y estado del repartidor, jornada diaria y entrega activa.
- Entregas: en curso, historial, ofertas autorizadas por servidor, recoger / ruta / entrega PIN.
- Ganancias: ganancia del día, entregas, promedio, distancia, gráfico semanal y retiro **informativo/deshabilitado**.
- Perfil: identidad, vehículo, **placas enmascaradas** (solo 2 últimos caracteres), estado de verificación, ayuda, seguridad y cerrar sesión con bloqueo por entrega activa.
- Inicio de sesión de conductor independiente: `/repartidor/acceso`.
- Registro: `/repartidor/registro`, datos personales, teléfono, vehículo, placas moto/auto (bicicleta sin placas) y documentos opcionales PDF/JPG/PNG/WEBP (máximo 3, 5 MB c/u). Permite reutilizar una cuenta cliente ya existente, sin crear otra.
- Estilos basados en colores, tamaños, superficies y navegación de `theme.dart` y `shell.dart` en Flutter; 320/360/390/430 dp con pruebas sintéticas de navegador.

**Paridad certificable:** estructura de navegación, jerarquía y estados principales. La equivalencia pixel-perfect requiere comparar goldens Flutter reales con capturas PWA en los mismos tamaños y datos. No afirmar coincidencia al 100% únicamente por compilar.

## Seguridad de registro: deploy backend primero

El backend LIVE rc8.13 hoy rechaza `plate` por el validador estricto de `/operations/onboarding`. Sin adaptación, el formulario web no podría guardar las placas y generaría solicitudes incompletas.

PR backend #167 modifica de manera aislada:
1. Migración Prisma para agregar `plate` a `onboarding_applications` (no a `driver_profiles`, donde ya existe).
2. Contrato `POST /operations/onboarding` para placas validadas (opcional para compatibilidad Flutter v1.2.4), documentos y vehículo.
3. Al aprobar ADMIN con MFA, copiar placa a `driver_profiles.plate` en la transacción del rol.
4. `GET /operations/onboarding-capabilities` como handshake público read-only; no activa ningún pago, asignación ni verificación automática.

La **PWA bloquea por defecto todo envío de alta** si el endpoint falta (404), falla o no devuelve `driver_plate_supported:true` y `driver_admin_approval_required:true`. No crea cuenta antes de ese handshake.

## Orden de validación

1. Backend PR #167: verificar TypeScript/Prisma con migración en base STAGING aislada; REST ADMIN autenticado y MFA, reintento, duplicados, usuario customer existente y docs. Confirmar que las solicitudes Flutter sin plate siguen admitiéndose.
2. Realizar staging TEST desde Chrome/Safari para registro de nueva cuenta y cuenta ya existente: documento bajo autorización, solicitud `pending`, control ADMIN y aprobación; no elevar privilegios antes.
3. Verificar inicio de sesión web solo con rol driver aprobado, cookies HttpOnly Secure, presencia y GPS HTTPS, foco visible, teléfono físico.
4. Web PR #10: CI `npm run check`, QA de Repartidores (16 capturas + registro), QA Restaurantes, regresión Clientes, todo SUCCESS mismo HEAD. No usar un run cancelado como PASS.
5. Activar la nueva release pública **estática** con script `deploy/kali-update-existing-public.sh --plan SHA`, verificar callback y backup antes del apply separado. No habilitar `VITE_DRIVER_ACTIONS_ENABLED` ni flags de delivery LIVE.
6. Verificar `/repartidor`, `/repartidor/acceso`, `/repartidor/registro`, `/clientes`, `/restaurante`; API/health y permisos. Si falla, rollback exclusivamente de 18195.

## Restricciones

- Node LIVE actual no se ha actualizado. Frontend RC9.8 y backend PR #167 son **draft**, sin deploy.
- `/driver/dashboard` sirve cifras reales; si falla, se muestra «—», nunca dinero simulado. El botón de retiros está bloqueado.
- Foto de prueba de entrega: el contrato actual acepta `photo_url`, pero la PWA aún no posee una API de evidencia de repartidor certificada. Solo PIN API; no mostrar evidencia inventada.
- Stripe LIVE delivery, dispatch y payout deben seguir **HOLD** hasta certificar la cadena de pago y entrega en STAGING Stripe TEST.
