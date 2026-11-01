# RC166 — Tala Eats Restaurantes: preparación y auditoría POSDESPLIEGUE

## Alcance confirmado

Esta RC actualiza **solo frontend/PWA** (React, manifest, assets y service worker). No hay migraciones SQL, cambios Node.js, Stripe LIVE, redis, reinicio PM2 ni movimientos bancarios. Los cambios se encuentran en la rama del PR #46 hasta que se revise y se promocione el SHA exacto. **No afirmar que está desplegada por superar CI.**

## 1. Gates antes de promocionar a Kali

1. Usar el SHA de 40 caracteres del commit concreto **que esté aprobado en GitHub Actions**; no reemplazarlo por `main` sin verificar.
2. Validar en una copia aislada: `npm install --no-audit --no-fund && npm run check`. El build genera `dist/release.json` con `source_sha` y `built_at`. Exigir coincidencia del SHA respecto al árbol compilado.
3. El Nginx del dominio **restaurantes-talaeats.alan-palacios-dev.com** debe servir el mismo directorio `dist/` compilado. Revisar sus headers en producción. No reutilizar los scripts `kali-install-pwa*.sh` como actualizadores: son instaladores *one-time* y comprueban una versión RC8.13 antigua.
4. En Kali, determinar la ruta activa real del sitio y el procedimiento de promoción que ya funciona; documentar un backup válido del release actual y un rollback del symlink. No sobrescribir archivos de configuración de Nginx o Cloudflared ni copiar sobre el directorio `current` en vivo.
5. Si no hay procedimiento de promoción verificado compatible con ese host, dejar `DEPLOY=HOLD`, no improvisar `sudo rm`, `systemctl restart nginx`, ni tocar PM2. La activación requiere aprobación explícita.

## 2. Verificación POSTDESPLIEGUE sin causar pedidos

Después de publicar el commit aprobado, desde una terminal con curl y Python 3:

```bash
SHA="<SHA_APROBADO_DE_40_CARACTERES>"
bash deploy/rc166-postdeploy-smoke.sh \
  https://restaurantes-talaeats.alan-palacios-dev.com "$SHA"
```

El script ejecuta solamente GET HTTPS sin cookies ni credenciales, sin redirecciones y con timeout. Comprueba la aplicación SPA, deep-link Wallet, manifiesto, iconos PNG 180/192/512, service worker y el `source_sha` real del build; exige cabeceras sin caché para HTML, manifest, release y service worker. `RC166_SMOKE=PASS_READ_ONLY` es evidencia de *estáticos* desplegados, no garantía de pedidos reales.

Solo cuando se haya confirmado que ese dominio enruta `/api/v1/ready` al backend correcto:

```bash
bash deploy/rc166-postdeploy-smoke.sh \
  https://restaurantes-talaeats.alan-palacios-dev.com "$SHA" --check-api
```

`--check-api` agrega un GET de `/api/v1/ready` y requiere `ready=true`. No consulta Stripe ni realiza compras. Si el endpoint no está expuesto en ese dominio, no activar este argumento; validar el backend desde Kali con una comprobación separada, read-only, ya conocida.

## 3. Protocolo operativo manual Android/iOS

- Android Chrome: abrir URL oficial, instalar Tala Negocios cuando esté disponible; confirmar icono, modo standalone, áreas seguras y tabs con Atrás.
- iPhone Safari: Compartir → Agregar a pantalla de inicio; validar barra, notch/Dynamic Island y teclado en Menú. Cerrar detalle de pedido con Atrás o con Cerrar, sin salir del panel.
- Restaurador autorizado: consultar pedidos y pago; confirmar que Stripe pendiente **no permite** aceptar/preparar. No forzar pedidos/retiradas LIVE de prueba.
- Menú: abrir Editar, cambiar precio sin guardar; confirmar que aviso RC166 **no recarga** la app hasta que el borrador se guarde o deshaga. Validar Guardar, Deshacer, stock y botón Pausar con un comercio de prueba autorizado, no en producción comercial.
- Wallet: lectura sin inventar saldos, sin solicitud de retiro. No confundir estado de conciliación con dinero bancario disponible.
- Cortar red: offline explícito; volver online: reintentar GET y comprobar que no se recuperan saldos privados del caché.
- Tras actualizar release: el SW nuevo espera aprobación del usuario. El aviso de actualización **no reinicia el panel solo**. Después de terminar acciones, pulsar Actualizar para activar la versión.

## 4. Si cualquier gate falla

**HOLD / rollback.** Retener logs HTTP, número de build y SHA, sin tokens, cookies, direcciones de clientes ni PIN. Restaurar la versión estática anterior mediante el mecanismo seguro y respaldado existente, sin reiniciar backend/Stripe. Volver a pasar el smoke sobre el SHA anterior y verificar autenticación/cola/manual. No anunciar PASS hasta ver el script verde más el QA móvil.

## 5. Pendientes para liberación comercial

- Matriz real Safari iOS, Chrome Android, escritorio y PWA instalada, con capturas propias tras la publicación.
- Comprobar API Node LIVE (no dar por hecho que sus rutas financieras replican los contratos históricos Python).
- Pruebas E2E autorizadas de usuario → restaurante → repartidor → PIN → conciliación; transferencias automáticas siguen fuera de esta RC.
