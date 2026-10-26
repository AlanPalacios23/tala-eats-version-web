# Tala Eats Restaurantes Web: comparativa con Flutter Restaurante (26-oct-2026)

Fuente nativa: AlanPalacios23/tala-eats-mobile/tala-eats-restaurante/app/lib (main y PR #66). Web: rama feat/restaurant-app-activation-20261026.

## Paridad funcional implementada en web
- Entrada /restaurante diferente de la app Clientes: portada empresarial, registro y activación, autenticación por rol.
- Inicio: apertura/cierre, alertas de pedidos, stock bajo y resumen real de la API.
- Pedidos: filtros (todos, nuevos, cocina, listos, historial), búsqueda por ID/producto, cambios de estado y entrega pickup con PIN.
- Modo cocina: comandas por etapas, artículos y avance protegido según pago conciliado.
- Menú: buscar, categorías, CRUD real, stock, disponibilidad, descripción, alérgenos, combo, fotos y eliminación condicionada por backend.
- Más: editar restaurante y tiempo de preparación, dirección textual, foto de portada, apertura/recogida, equipo y permisos.
- Finanzas: datos reales de /owner/finance, sin inventar liquidaciones. Activación Stripe Connect por consentimiento real.
- Navegación móvil con cinco destinos, escritorio con secciones completas y diseño responsive.

## Dependencias o paridad parcial (no declarar operativas)
- Ubicación: ya admite latitud/longitud reales y captura GPS por consentimiento explícito en el navegador. Aún falta la pantalla de mapa/pin y la validación de tarifas de domicilio con backend LIVE.
- Equipo: POST /owner/employees asocia un usuario existente, pero el backend continúa protegiendo operaciones owner-only; probar permisos reales por empleado.
- 2FA: se admite OTP al inicio de sesión; no hay ruta pública de configuración Node confirmada aquí.
- Retiros/transferencias automáticas: no habilitados; el neto contable no es un saldo bancario disponible.
- Rechazar/cancelar pedido con eventual reverso financiero: se debe certificar antes de habilitar en producción.
- Notificaciones reales a restaurantes: la web actual refresca al estar visible; no declarar push hasta E2E.
- Fotos de catálogo: el backend Node contiene un origen stage fijo para URLs; verificar que sean accesibles desde producción antes de anunciar esta función operativa.
- Los pedidos a domicilio y asignación de repartidor requieren pruebas separadas del backend LIVE.

## Reglas de publicación
1. QA responsive 320, 360, 390, 430, 768 y 1280; teclado, escalado de texto y revisión visual.
2. E2E autenticado para alta, aprobación MFA, relogin, Connect, menú, equipo y pedidos cash/Stripe verificados.
3. Comprobar fotos subidas reales y que la URL remota responde HTTPS.
4. Publicar SHA inmutable con respaldo/rollback del frontend; sin escribir en Stripe/PM2/PostgreSQL/Cloudflare.
5. No se han creado cobros reales ni desplegado esta rama en Kali desde GitHub.