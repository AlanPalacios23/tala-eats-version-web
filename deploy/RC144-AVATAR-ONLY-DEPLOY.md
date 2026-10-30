# RC144 · Plan de despliegue EXCLUSIVO para foto de repartidor

**Estado:** preparado en GitHub; no ejecutado en Kali. No activar hasta obtener
todos los PASS, revisar el estado LIVE real y aprobar expresamente cada fase.
La RC143 está vigente; backend de referencia:
`f92f5d9a52856f24e155dcbc140dcff0e266056a`.

## Alcance permitido

- Backend: POST autenticado propio `/api/v1/driver/avatar`; GET de imagen
  WEBP opaca, columna existente `auth_users.avatar_url` y el campo existente
  `driver_info.avatar_url` en un pedido asignado. Sin migración.
- Frontend: solo foto de Perfil en Repartidores y fotografía del conductor
  asignado en Clientes y Restaurantes. Servir imágenes sobre el proxy
  `/api/v1/` de cada dominio.
- **No tocar** comisiones, despacho, entregas, Stripe, Wallet, retiros,
  flujos de pedido, PM2 worker financiero (salvo el cutover coordinado para
  cargar la misma nueva versión de código), PostgreSQL schema, Cloudflared,
  Nginx, banners ni estilos generales.

## Identidades y versiones

1. GitHub backend PR #208: `feat/rc144-driver-avatar-persistent-backend-20261030`
   comparado con la rama de anclaje del LIVE
   `rc144-avatar-live-base-f92f5d9a`.
2. GitHub web PR #28: `feat/rc144-driver-avatar-cross-app-20261030`
   comparado con `feat/rc143-driver-immersive-map-20261029`.
3. Antes de clonar, anotar dos SHA **EXACTOS de 40 caracteres**, tomados
   de los HEAD que hayan pasado todos los workflows. No usar `main`,
   ramas móviles, ni sobrescribir un release anterior.
4. La ruta del backend candidata es
   `/home/tala-node-stage/tala-node-releases/BACK_SHA/node-backend`.
   La web es
   `/home/tala-node-stage/tala-eats-web-releases/WEB_SHA`.
   El SHA de la PWA de Repartidores actualmente LIVE es
   `9101ae8c349aa22f9f14ad95d65a75067ec84738`.
   No suponer los SHA actuales de Clientes/Restaurantes: comprobar sus
   symlinks `current` en el servidor.

## Fase 1 — Preparación SIN cambiar LIVE

- Usar `tala-node-stage` y Node 24 para clonar ambos repos en *nuevas*
  carpetas SHA sin sobrescribir. `git fetch origin EXACT_SHA` y
  `git checkout --detach EXACT_SHA`.
- Backend, con credenciales sintéticas y sin ENV LIVE:
  `bash scripts/rc144-kali-avatar-candidate-build.sh BACK_SHA`.
  Debe completar `npm ci`, `npm audit --omit=dev --audit-level=high`,
  Prisma, TypeScript y tests. Resultado
  `RC144_AVATAR_CANDIDATE=PASS_NOT_DEPLOYED`.
- Web, usando el builder compartido de las tres PWAs (clona por SHA):
  `bash deploy/rc136-kali-build-three-pwa.sh WEB_SHA`.
  Deben existir los tres bundles `dist`, `dist-restaurantes` y
  `dist-repartidores` y pasar `npm run check`.
- Plan del directorio: como administrador,
  `bash .../scripts/rc144-kali-avatar-storage.sh --plan`.
  El único comando permitido para crear la carpeta, después de revisar:
  `sudo bash .../scripts/rc144-kali-avatar-storage.sh --provision I_APPROVE_RC144_AVATAR_STORAGE_ONLY`.
  Crea solo `/srv/talaeats-media/driver-avatars` con UID/GID
  `tala-node-stage`, modo `0700`, **fuera del release**.
  No modifica PM2, DB, Stripe, Nginx ni los portales.
  Se debe hacer respaldo del volumen junto a la base de datos;
  guardar y probar restauración antes de LIVE.
- Backend preflight read-only:
  `bash scripts/rc144-kali-avatar-live-preflight.sh --plan BACK_SHA`.
  Verifica identidad exacta de los dos PM2, integridad Git, diff permitido,
  versión Sharp parcheada, compilación, disco persistente, API/worker y
  los 3 proxies. La diferencia frente al backend LIVE debe ser únicamente
  de avatar y scripts/tests de RC144.
- Si cualquier verificación da HOLD, **no publicar ni cambiar flags**.

## Fase 2 — LIVE (solo con aprobación explícita adicional)

**No ejecutar desde este documento sin revisar primero el log real de Kali.**
Requiere plan específico de cutover controlado de los dos PM2 y restauración
de la versión anterior. Los procesos financieros comparten el backend y por
eso NO se debe improvisar un `pm2 restart` sin snapshot.

1. Respaldo consistente PostgreSQL y estado de PM2, más directorio de fotos.
   Verificar `pg_restore --list` y recuperación de versiones.
2. Publicar el backend SHA compilado como *code-only*, preservando de forma
   byte-a-byte los flags LIVE existentes. `DRIVER_AVATAR_UPLOAD_ENABLED`
   sigue en `false` por defecto. Verificar `/health`, `/ready`,
   webhooks y worker en ese SHA.
3. Habilitar únicamente estas variables tras validar backend y volumen:
   `DRIVER_AVATAR_MEDIA_DIR=/srv/talaeats-media/driver-avatars`
   y `DRIVER_AVATAR_UPLOAD_ENABLED=true`.
   Exige una activación controlada de la API; no cambiar otros flags.
   Verificar sin sesión que la URL GET con un nombre de 40 ceros devuelve
   **404** (ruta activa), y que POST anónimo no acepta imágenes.
4. Comprobar la ruta `/api/v1/driver/avatar/000...000.webp` por los
   puertos 18195, 18197 y 18199 (con Host correcto). Todos deben responder
   404, no HTML 200, 503 ni 502.
5. Ejecutar el plan web (no cambia LIVE):
   `sudo bash deploy/rc144-kali-avatar-three-pwa.sh --plan WEB_SHA BACK_SHA`.
   El wrapper reutiliza `rc136-kali-promote-three-pwa.sh --plan`, respaldos
   y reversión existentes, sin editar Nginx ni backend.
6. **Solo después del plan PASS:** aplicar 3 estáticos con el token separado:
   `sudo bash deploy/rc144-kali-avatar-three-pwa.sh --apply WEB_SHA BACK_SHA I_APPROVE_RC144_THREE_AVATAR_PWA_ONLY`.
   No mezclar con despliegues de backend, dinero o nuevas funcionalidades.
7. QA final **autenticado**: un repartidor sube foto original JPG/PNG/WEBP;
   el backend devuelve 201 y sirve WEBP; cambia foto; reinicia sesión,
   abre la PWA en otro teléfono y comprueba persistencia.
   Comprueba desde pedidos *realmente asignados* la foto en Clientes y
   Restaurantes, sin mostrarla en pedidos no asignados.
   Prueba 401/403, datos corruptos, 413, 415, 429 y caída de storage.
8. Si falla cualquier paso, detener liberación. Rollback estático con
   los scripts respectivos y restauración backend desde snapshot probado.
   **No borrar el volumen de fotos en rollback**, ni revertir DB a ciegas;
   mantener la función apagada mientras se investiga.

## Señales que NO son prueba de éxito

- 200 en landing no confirma subida autenticada.
- GET 404 de un archivo inexistente solo prueba la ruta de lectura, NO
  la persistencia de datos ni permisos de POST.
- Compilación GitHub PASS no confirma que Kali tenga volumen, backup o
  que Flutter nativo muestre la imagen; estas implementaciones son PWA web.
- No dar por activados despacho, pago domicilio o transferencias Stripe.
