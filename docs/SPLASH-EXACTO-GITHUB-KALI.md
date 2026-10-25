# Tala Eats: splash exacto instalado solo desde GitHub

**Estado: LOS BINARIOS YA ESTÁN VERSIONADOS EN GITHUB.** El usuario ya NO debe descargar nada de ChatGPT ni ejecutar el antiguo importador manual. GitHub Actions `Publicar archivos originales del Splash en GitHub` creó y confirmó los tres archivos a partir de la foto original del usuario con SHA256 verificado.

## Archivos disponibles en la rama

Rama: `feat/mobile-parity-v1046-navigation`

- Foto original (fuente): `assets/splash/source-1000260473.png`, 728×1536.
- Foto para la Web sin barra de teléfono: `public/branding/splash-exacto-728x1536.webp`, 728×1536.
- ZIP reutilizable: `deploy/releases/TalaEats_Splash_Exacto_Instalacion_Kali.zip`.
- Instalador autónomo: `deploy/INSTALAR_SPLASH_TALA_EATS_DESDE_GITHUB.sh`.
- Generador de arte (reproducible con SHA256): `tools/gh_generate_splash_assets.py`.
- Workflow publicador: `.github/workflows/publish-splash-files.yml`.

El primer commit con estos archivos es `b07c2321e908fd423358fc1c6d2ad0e090e3d0c9`.

## Comando recomendado: instalación DIRECTAMENTE desde GitHub en Kali

Ejecutar en Kali como `alan`:

```bash
curl -fsSL --max-time 25 \
  'https://raw.githubusercontent.com/AlanPalacios23/tala-eats-version-web/feat/mobile-parity-v1046-navigation/deploy/INSTALAR_SPLASH_TALA_EATS_DESDE_GITHUB.sh' \
  -o "$HOME/INSTALAR_SPLASH_TALA_EATS_DESDE_GITHUB.sh"
bash "$HOME/INSTALAR_SPLASH_TALA_EATS_DESDE_GITHUB.sh"
```

El script:
1. Clona el HEAD de la rama de revisión al usuario `tala-node-stage`.
2. Verifica el formato WebP y tamaño 728×1536 **dentro del repositorio clonado**; si falta, termina SIN desplegar.
3. Ejecuta `npm install`, `npm run check`, `npm run build`, compara la foto en `public` y `dist`.
4. Hace plan y apply con `deploy/kali-update-existing-public.sh`, conservando el respaldo y actualizando **solamente** el sitio público 18195.
5. Verifica el JS de la versión pública y el HTTP `image/webp` del recurso.

## URL esperada

- Web: `https://web-talaeats.alan-palacios-dev.com/clientes`
- Arte: `https://web-talaeats.alan-palacios-dev.com/branding/splash-exacto-728x1536.webp`

**No** crear otro dominio, no cambiar Stripe, pagos, PM2, Cloudflared, base de datos ni el backend.

## ZIP directo de GitHub (opcional, no necesario para instalar)

```
https://raw.githubusercontent.com/AlanPalacios23/tala-eats-version-web/feat/mobile-parity-v1046-navigation/deploy/releases/TalaEats_Splash_Exacto_Instalacion_Kali.zip
```

Los archivos están en la **rama del PR DRAFT**, no fusionados con `main`. El despliegue público actual anterior a esta actualización era `a742238b5c08090ea6a903f8cef1ec26db10a61f`. Tener los archivos versionados no significa que Kali ya los instaló.

El script anterior `deploy/IMPORTAR_SPLASH_A_GITHUB_DESDE_KALI.sh` queda solo como recuperación histórica y no se necesita.
