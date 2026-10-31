# RC157 · Repartidores PWA — interfaz limpia y mapa protagonista

**Estado:** candidata NO publicada. El usuario confirmó que RC156, SHA `54413d0596f009218dc0eb438ba6f59597c51066`, está instalada en el servicio aislado Nginx 18199 de Kali y el backend LIVE sigue en `f92f5d9a52856f24e155dcbc140dcff0e266056a`.

## Diseño RC157 (inspiración en patrones de Uber Driver / DiDi / Rappi, marca original Tala Eats)
- Inicio: un encabezado compacto, estado verificado del servidor y una sola llamada a la acción. El resumen diario queda subordinado; no se inventan cantidades.
- En línea sin pedido activo: se conserva el mapa real a pantalla completa y una tarjeta inferior con una única acción primaria, priorizando comercio, ganancia confirmada y distancia recta si el GPS y el catálogo ofrecen coordenadas verificadas.
- Menos repetición: contador de ofertas una sola vez, sin grandes bloques de degradado, mensajes de disponibilidad concisos y opciones secundarias en la hoja expandible.
- Las ofertas ocultas son solo un filtro de sesión; NO equivalen a rechazo remoto.
- Entregas, ganancias y perfil: fondos, bordes, navegación y tipografía con jerarquía uniforme. Se conservan PIN, permisos, acuse de efectivo, login, subida de foto, avisos de seguridad y soporte sujeto a flag.

## Cambios técnicos
- Nuevas hojas de estilo `src/styles/driver-focus-shell-rc157.css` y `src/styles/driver-focus-map-rc157.css`, importadas solo en componentes de Repartidores.
- Texto reducido y actualización manual de GPS visible solo cuando la presencia carece de GPS confirmado; el heartbeat de ubicación en primer plano **no se desactiva**.
- No hay cambios en API, backend Node, base de datos, pagos, permisos, mapas OSM o PWA de Clientes/Restaurantes.
- Se preservan el foco visible, la navegación accesible, el soporte para 320–430dp, safe areas y reduced motion.

## QA antes del deploy
1. GitHub CI y `npm test` / `npm run build:repartidor` PASS para el SHA **exacto** de RC157.
2. Capturas reales o pruebas en Android Chrome e iPhone Safari: inicio online/offline, mapa, bottom sheet de 0/1/múltiples ofertas, 320/360/390/430dp, portrait pequeño, dark-mode del teléfono y teclado.
3. Confirmar que la pantalla de mapa no enseña direcciones privadas de clientes antes de aceptar y que `Ocultar` no crea un rechazo remoto.
4. Probar sesión A→B, reconexión, GPS denegado, estado sin permisos, PIN en entrega activa y que botones de despachos siguen bloqueados si backend los bloquea.
5. Obtener el SHA backend activo mediante `rc138-kali-driver-live-preflight.sh --detect-backend`; **no** usar el backend candidato RC156 para forzar compatibilidad.
6. Antes de activar `VITE_DRIVER_ACTIONS_ENABLED`, `VITE_FINANCE_WALLET_V2_ENABLED`, `VITE_CASH_HANDOFF_V2_ENABLED` o `VITE_DRIVER_SUPPORT_ENABLED` hacen falta gates independientes de backend; el compilador seguro usado para RC156 los deja desactivados.

## Publicación posterior: solo Nginx 18199, sin Stripe/Node
Seguir el mismo procedimiento RC156 con el **nuevo SHA exacto**, no reutilizar el SHA de esta documentación:
- service-user `tala-node-stage`: `deploy/rc138-kali-build-driver-only.sh SHA`
- `deploy/rc138-kali-driver-live-preflight.sh --detect-backend`
- `deploy/rc138-kali-driver-deploy.sh --plan WEB_SHA BACK_SHA`
- comprobar backup/rollback y servicio aislado
- únicamente después de todos los PASS: `sudo bash deploy/rc138-kali-driver-deploy.sh --apply WEB_SHA BACK_SHA I_APPROVE_DRIVER_RC138_STATIC_ONLY`
- postcheck del SHA activo y bytes servidos, HTTP 200 público y pruebas manuales
- en FAIL, dejar RC156 como fallback con el script de rollback aislado ya existente.

**La compilación o un PR verde no publica RC157.** La release real sigue siendo RC156 hasta aplicar un switch confirmado en Kali.
