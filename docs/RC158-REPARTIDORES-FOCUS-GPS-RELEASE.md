# RC158 · Menos ruido en mapa y entregas; GPS que caduca de verdad

**Base:** RC157 (PR #41). **Estado:** candidata, no publicada. Mantener RC156 actualmente instalada en Kali intacta hasta nueva aprobación.
**Alcance:** PWA Repartidores solamente; sin nuevas acciones, rutas API, permisos, backend, PostgreSQL, Stripe ni funciones de pagos.

## Experiencia
- Mapa inmersivo conserva ofertas autenticadas, marcador del comercio, ganancia, control de disponibilidad, avisos en primer plano, aceptación, ocultar en sesión, navegación y botón principal.
- Con dos o más ofertas, los filtros para ordenarlas se abren desde **Ordenar ofertas**. Su valor seleccionado se conserva mientras el usuario navega dentro del mapa; los datos y las reglas de selección siguen viniendo del backend.
- En Inicio y con un pedido activo, las paradas y direcciones extensas se encuentran detrás de **Ver paradas y direcciones**, mientras que la navegación inmediata Google/Apple y el CTA seguro de recoger/entregar permanecen visibles. En la pestaña Entregas, los detalles siguen expuestos como antes.
- El GPS del mapa deja de mostrar la posición del repartidor después de la antigüedad máxima autorizada (60 s desde el timestamp recibido), incluso si el navegador deja de emitir callbacks. El watchdog es `setTimeout` por cada fix: se cancela en la siguiente ubicación, al cerrar el mapa, cambiar visibilidad o perder conexión. No se guarda ubicación en disco ni se envía otro heartbeat.
- Accesibilidad: `details/summary` nativos, foco visible, tamaños táctiles, 320–430 dp, safe areas existentes, `prefers-reduced-motion`.

## QA de seguridad y operación
1. El backend sigue siendo la fuente de autorización. Un ocultamiento de oferta NO es rechazo remoto.
2. Los saldos y ganancias no implican saldo disponible para retiro; no activar Stripe ni pagos como parte de esta release.
3. Probar 0/1/2+ ofertas, error de red, GPS denegado, ocultación de ofertas, reordenación con GPS, reentrada al mapa, pestañas y retorno, PIN, efectivo y cambio de cuenta A→B.
4. Revisar GPS sin nuevos callbacks durante más de 60 segundos (se debe retirar punto azul y aparecer un aviso, no simular posición fresca).
5. `npm test`, `npm run check`, build de Repartidores y CI móviles/sintéticos en GitHub deben pasar para el SHA final. No llamar un 200 de la landing un E2E de entrega.

## Publicación aislada posterior
Mismo procedimiento probado para RC156, pero con el nuevo **SHA aprobado de 40 caracteres**: `deploy/rc138-kali-build-driver-only.sh` → `rc138-kali-driver-live-preflight.sh --detect-backend` → `rc138-kali-driver-deploy.sh --plan WEB_SHA BACK_SHA` → backup → `--apply` solo si todo PASS. Después verificar symlink, bytes locales/públicos, autenticación y equipo móvil. `rollback` exclusivo de Repartidores si algo falla. No tocar Nginx 18195/18197, worker PM2, Cloudflare, Stripe ni PostgreSQL.

**Este documento/PR no cambia producción.**
