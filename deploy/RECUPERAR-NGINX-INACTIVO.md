# Recuperación: nginx.service inactivo (Kali)

## Por qué el despliegue anterior se detuvo

El instalador global (script `deploy/kali-install-pwa.sh`) genera la
configuración Nginx y se niega a arrancar el **servicio global nginx.service**
si está inactivo. Esto impide exponer inesperadamente puertos 80 o 443 o
interrumpir los servicios existentes de Kali.

La primera instalación informó:

```text
PWA_EXISTING_LIVE_RC813=PASS
nginx -t=PASS
PWA_INSTALL_ABORT=NGINX_SERVICE_NOT_RUNNING_NO_AUTOSTART
PWA_ROLLBACK_ATTEMPTED=CHECK_NGINX
```

Ese rollback no es una certificación por sí mismo. El nuevo instalador
independiente comprueba que no haya symlinks/archivos viejos, que 18195 esté
libre y que el backend LIVE conteste antes de modificar algo.

## Alternativa adecuada para el servidor ocupado

**Usar `deploy/kali-install-pwa-isolated.sh`**, que NO llama a
`systemctl start nginx` ni `systemctl reload nginx`. Crea un Nginx
separado bajo systemd:

- **Servicio exclusivo:** `talaeats-web-pwa.service`
- **Usuario proceso:** `www-data`, sin privilegios root
- **Escucha:** solo `127.0.0.1:18195`
- **Config independiente:** `/etc/talaeats-web-pwa/nginx.conf`, que incluye
  únicamente `/etc/talaeats-web-pwa/server.conf`
- **Archivos PWA:** `/srv/talaeats-pwa/current` apuntando a release SHA
- **Proxy same-origin:** `/api/v1/*` → RC8.13 LIVE en 18190
- **No toca:** Nginx global, Caddy, Cloudflared, PM2, PostgreSQL, Redis, Stripe

Para desplegar desde un checkout SHA exacto, tras correr
`npm install && npm run check` como `tala-node-stage`:

```bash
# tala-node-stage (solo lectura)
bash deploy/kali-install-pwa-isolated.sh --plan "$SHA"

# alan con sudo, sin estar dentro de tla-node-stage
sudo bash "/home/tala-node-stage/tala-eats-web-releases/$SHA/deploy/kali-install-pwa-isolated.sh" \
  --apply "$SHA" I_APPROVE_ISOLATED_PWA_18195_ONLY
```

El script instala una **nueva** unidad systemd persistente entre reinicios.
Si algo falla, intenta retirar solo el servicio/config/assets nuevos
(cualquier residuo se revisa antes de reintentar).

Confirmar:

```bash
sudo systemctl is-active talaeats-web-pwa.service
sudo systemctl status talaeats-web-pwa.service --no-pager -l
curl -fsS -H 'Host: web-talaeats.alan-palacios-dev.com' \
  http://127.0.0.1:18195/api/v1/health
```

Solo al confirmarse todo lo local, agregar en Cloudflare Tunnel el nuevo
hostname:

```text
web-talaeats.alan-palacios-dev.com -> http://127.0.0.1:18195
```

No crear una ruta al servicio temporal desactivado 18192. No modificar
`talaeats.alan-palacios-dev.com` en 18190.

## Funciones habilitadas

Los tres portales son accesibles bajo las rutas `/clientes`,
`/restaurante` y `/repartidor` mediante un frontend y una API compartidos.
Los permisos reales, cobros y despacho los controla RC8.13 LIVE. Las
entregas del repartidor siguen no habilitadas y aún faltan comercios
aprobados en Stripe Connect antes de pedidos comerciales.
