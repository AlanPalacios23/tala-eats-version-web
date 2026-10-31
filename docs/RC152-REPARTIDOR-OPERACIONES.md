# RC152 · Repartidor: siete funciones, progreso comprobable y límites de seguridad

Base: RC151 -> RC152, sin desplegar. Backend, Stripe y producción permanecen sin modificaciones.

## 1. Pedidos y avisos
- RC151: avisos por nuevas IDs autorizadas con opt-in, solo con la PWA abierta. RC152 añade botón para enfocar la oferta exacta en el mapa antes de aceptarla.
- No hay push/sounds de fondo, no hay ofertas demo, no hay aceptación automática.
- Para push real: evento firmado desde backend, expiración y deduplicación en origen, FCM/Web Push, permisos y QA iOS/Android.

## 2. Navegación
- RC152 ofrece Google Maps y Apple Maps con indicaciones de conducción para el destino siguiente: comercio antes de recoger, cliente después.
- Usa la dirección del pedido y el detalle respaldado por ID/restaurant_id; nunca inventa ETA, kilometraje por carretera ni rutas dibujadas.
- Enlaces externos solo tras pulsación del repartidor; sin GPS personal en parámetros.
- Mapas internos turn-by-turn requieren proveedor, licencia, costos, privacidad, pruebas de desvíos y conectividad.

## 3. Entrega activa
- Se conserva el flujo de backend: asignado -> recogido -> en camino -> PIN, con controles protegidos e historial de entregas.
- RC152 simplifica la navegación desde la tarjeta de entrega activa. Sin doble escritura de estados; todas las confirmaciones permanecen en el servidor.
- Pendiente prueba E2E de flujo completo con restaurante, usuario y repartidor en staging; retiros LIVE fuera de alcance.

## 4. Comunicación y soporte
- RC152 añade historial de tickets de la cuenta validada en el endpoint actual, sin mostrar registros con otro user_id.
- Formulario evita envíos repetidos por toques simultáneos; conserva estado de ticket confirmado, referencia informativa a pedido y categoría.
- Sigue estrictamente bajo VITE_DRIVER_SUPPORT_ENABLED=true (OFF por defecto) hasta auditar permisos del backend Node, vinculación de pedidos y rate limit.

## 5. Wallet
- FinanceWeeklyPreview permanece solo lectura y con controles de validación financiera. RC152 borra el resumen previo y reconsulta al cambiar el ID de sesión.
- Conserva desglose de devengo, efectivo bajo custodia, saldo retirable confirmado y acuse del restaurante cuando sus flags estén habilitados.
- No hay botones LIVE de retiro o Stripe Connect nuevos. Antes de activarlos: ledger, KYC, webhooks, conciliación y pruebas de reintentos idempotentes.

## 6. Seguridad
- RC152 incorpora panel Estado operativo con datos verificados por backend (cuenta, GPS vigente, nuevas asignaciones y disponibilidad de consultas).
- Distingue sin Internet, usuario desconectado y ausencia de autorización para pedidos. No etiqueta SOS real ni promete tiempos de soporte.
- Centro SOS auténtico requiere equipo de respuesta, consentimientos, procedimientos y auditar el backend.

## 7. Estadísticas
- Actividad derivada de dashboard.last_7_days; RC152 añade promedio de entregas por día activo (no representa ingreso ni saldo para retiro).
- Fecha, cantidades y disponibilidad del dashboard se validan, sin fabricar tasa de aceptación o calificaciones.

## Pruebas y publicación
- RC152 añade tests de mapas, seguridad de rutas, alertas autorizadas, tickets y filtrado por usuario, lectura wallet, estados backend.
- Antes de LIVE: integrar RC144-RC152 en una rama definitiva; smoke test Node READ ONLY, activar flags de apoyo solo tras auditoría, respaldo/rollback para Repartidores, sin afectar Usuarios/Restaurantes.
- No cambiar datos financieros, configuración LIVE ni ubicación en servidor durante una verificación visual.