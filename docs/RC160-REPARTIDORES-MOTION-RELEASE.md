# RC160 — Repartidores: acabado visual y microinteracciones (sin ruido)
 
**Estado:** candidata, NO publicada. La última publicación de Kali confirmada en este chat es RC156 (Nginx Repartidores aislado en 18199). RC157–RC159 se desarrollaron y aprobaron por CI pero NO son un deploy confirmado.
 
## Alcance
 
Cambios exclusivamente en la **PWA Repartidores** del repositorio web, encima del SHA aprobado de RC159 (`c7ee2c30445ce4f9434af601c4862c9bd0eb37fb`).
 
1. **Disponibilidad:** tarjeta limpia con transición de estado; el indicador respira suavemente SOLO cuando el backend confirma `online`. El indicador del mapa usa tonos de advertencia en `SIN RED`, no un punto verde engañoso.
2. **Mapa y ofertas:** marcador seleccionado del comercio con halo sutil; la tarjeta de la oferta confirmada por el backend entra con una animación de 220 ms al cambiar de ID. Las cantidades, ganancias y distancias siguen siendo las verificadas en el código RC159 y los permisos siguen detrás del backend.
3. **Acciones:** transición táctil de 160–180 ms para botones reales de abrir ruta y aceptar pedido, sin acciones automáticas. Las rutas Google/Apple siguen abriéndose solo al pulsar.
4. **Jornada y entregas:** progresión del pedido, barras semanales, menú inferior y panel de paradas opcionales con movimiento mínimo; no se fabrican cambios de etapa.
5. **Reducción de movimiento:** `prefers-reduced-motion: reduce` apaga animaciones, transiciones y transformaciones añadidas. En pantallas pequeñas se conserva legibilidad y accesibilidad.
 
## Límites
 
- No se replican logos, colores o imágenes de Uber, DiDi o Rappi; se reutiliza la identidad de Tala Eats.
- No hay nueva geolocalización, notificaciones del sistema, almacenamiento de GPS, cambios de navegación, escrituras, backend Node, Stripe o wallet.
- No se modifica la lógica de PIN, efectivo, fotos, sesiones, pedidos, comisiones, retiro ni capacidades del backend.
- Efectos visuales no equivalen a aceptación real de pedidos o validación financiera.
 
## Gates antes de publicar
 
- `npm test`, `npm run check`, `npm run build:repartidor` y CI de capturas responsive / QA Flutter 320–430 dp deben pasar para el SHA final.
- Validar manualmente dispositivo Android y iPhone/iOS: online/offline real, GPS denegado o caducado, 0/1/múltiples ofertas, cambio de oferta, sheet expandido, navegación teclado, VoiceOver/TalkBack, `prefers-reduced-motion`.
- Desplegar más adelante **solo** Repartidores en Kali 18199 con `rc138-kali-build-driver-only.sh`, detectar SHA backend actual, `--plan`, respaldo, y `--apply` explícito si el plan pasa. Mantener rollback a RC156 o a la versión que Kali confirme como previa en ese momento.
- No activar flags de delivery, Stripe LIVE ni wallets con motivo de este cambio visual.
 
Esta PR no cambia producción.
