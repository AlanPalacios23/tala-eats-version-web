# Tala Eats · plan de las 7 capacidades del repartidor (RC151–RC154)

2026-10-30. RC144–RC150 no están integradas en producción por este PR; no desplegar directamente.

## Fuente de verdad
- API Node de Kali y respuestas autenticadas, nunca valores de prueba.
- GPS solo en primer plano. No se almacena en navegador ni se incluye en tickets.
- Estados assigned → picked_up → on_the_way → delivered solo mediante permisos del backend.
- Wallet no anuncia retiros ni liquidaciones sin ledger validado.

## 1. Alertas de ofertas
RC151: aviso visual y vibración optativos solo en mapa foreground, ante nuevas IDs autorizadas de driverAvailable. Baseline inicial y reconexión silenciosos. Usa el polling existente de 15 segundos; no declara push ni expiración inventada.
Pendiente: SSE/WebSocket autenticado, Web Push/FCM, expiración y pruebas nativas de Android/iOS.

## 2. Navegación
Actual: indicaciones externas a Google Maps con dirección/coord verificadas; la cercanía mostrada es solo geodésica.
Pendiente: rutas autorizadas por backend, cuotas, privacidad, distancia por carretera y ETA verificables.

## 3. Entrega activa
Actual: estados reales, tarjeta de progreso, acciones de recogida/ruta y PIN validado por servidor.
Pendiente: E2E en staging con driver, cliente, comercio, dinero, cancelaciones y reintentos idempotentes antes de LIVE.

## 4. Comunicación y soporte
RC151: formulario de ticket usando api.createSupportTicket, con VITE_DRIVER_SUPPORT_ENABLED=true como requisito estricto. Default: no escribe tickets ni muestra CTA habilitado.
Bloqueo: backend histórico /platform/support permite tickets por usuario, pero restringe order_id a pedidos del comprador. RC151 envía order_id=null, añade referencia informativa al texto y NO presenta el ticket como enlazado al pedido.
Pendiente: verificar RBAC Node actual, validar conductor asignado, vinculación de orden, rate limit, auditoría, soporte humano, historial y privacidad para contacto directo.

## 5. Wallet
Actual: FinanceWeeklyPreview y DriverCashHandoff read-only, separando devengo, efectivo bajo custodia y fondos autorizados. Retiros no habilitados.
Pendiente: Stripe Connect LIVE verificado, KYC, conciliación por orden, idempotencia, immutable ledger, impuestos, saldos y reversión. No activar sin QA real.

## 6. Seguridad
RC151: categoría de seguridad en tickets y advertencia de servicios de emergencia sin prometer asistencia inmediata.
Pendiente: personal de respuesta, severidades, escalamiento auditado, consentimiento y política de retención. No etiquetar como SOS 24/7 sin infraestructura.

## 7. Estadísticas
RC151: métricas de entregas y días activos validadas contra dashboard.last_7_days. Sin estimar pagos.
Actual: resumen diario, gráfica semanal y wallet de solo lectura.
Pendiente: definición backend verificable de aceptación, cancelación, calidad y periodos de cálculo.

## Gates antes de producción
1. Integrar y probar RC144–RC151 en rama conjunta sin afectar Usuarios ni Restaurantes.
2. Vitest, tsc, build de las 3 PWAs y QA visual 320/360/390/430 dp.
3. Verificar permisos, cambio de cuenta, GPS antiguo, PWA cache, ofertas repetidas y entrega end-to-end.
4. Confirmar backend de fotos y endpoints de soporte Node + flags en Kali.
5. Respaldar y desplegar solo Repartidores con rollback atómico, sin alterar Stripe o fondos.