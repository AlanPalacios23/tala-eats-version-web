# Tala Eats Splash — GitHub como fuente única

Rama de desarrollo: `feat/mobile-parity-v1046-navigation`. Proyecto: `AlanPalacios23/tala-eats-version-web`.
Dominio real: `https://web-talaeats.alan-palacios-dev.com/clientes` (sitio estático Kali, puerto 18195). No crear otro dominio/túnel.

## Qué está listo en esta rama
- `src/components/CustomerOnboarding.tsx`: splash interactivo con botón circular naranja de avance (sin cuenta regresiva), ruta `/iniciar`.
- `src/components/CustomerLaunch.tsx`: mismo arte mientras restaura sesión.
- `src/styles/main.css`: imagen completa y dimensiones adaptables; no simula barra superior de Android.
- `deploy/INSTALAR_SPLASH_TALA_EATS_DESDE_GITHUB.sh`: instala SOLO desde GitHub una vez que se haya cargado el recurso binario.
- `deploy/IMPORTAR_SPLASH_A_GITHUB_DESDE_KALI.sh`: importación del original en la rama **una sola vez**.

## Importación inicial única (PENDIENTE)
La API conectada de GitHub no admite transferir directamente bytes de los archivos binarios desde el entorno ChatGPT. **Los siguientes dos archivos NO están aún en el repositorio**, hasta ejecutar el importador:
- `public/branding/splash-exacto-728x1536.webp`
- `deploy/releases/TalaEats_Splash_Exacto_Instalacion_Kali.zip`

Descarga una única vez en Kali el ZIP `TalaEats_Splash_Exacto_Instalacion_Kali.zip` de la conversación de ChatGPT. Debe estar en `~/Downloads`, `~/Descargas` o pasa su ruta como argumento. Como usuario `alan` (no sudo):

```bash
curl -fsSL \
  'https://raw.githubusercontent.com/AlanPalacios23/tala-eats-version-web/feat/mobile-parity-v1046-navigation/deploy/IMPORTAR_SPLASH_A_GITHUB_DESDE_KALI.sh' \
  -o /tmp/IMPORTAR_SPLASH_A_GITHUB_DESDE_KALI.sh
bash /tmp/IMPORTAR_SPLASH_A_GITHUB_DESDE_KALI.sh "$HOME/Downloads/TalaEats_Splash_Exacto_Instalacion_Kali.zip"
```

El importador:
- valida SHA-256 del WebP original `b48a972b1307ea9563f3d1167926d00299f7edc11569244baca5148ac69c3031` y sus 728×1536 píxeles,
- clona **solo la rama** indicada (no `main`),
- añade la imagen WebP y el ZIP al repositorio,
- ejecuta `git push` con tus credenciales locales de GitHub (debes tener acceso de escritura),
- verifica los dos URLs raw (HTTP 200),
- **no toca** la instalación pública, el backend, PM2, Cloudflare, Stripe ni PostgreSQL.

Si GitHub solicita autenticación, usa GitHub CLI (`gh auth login`) o credenciales SSH/PAT ya configuradas. No pongas tokens en comandos ni compartas contraseñas por chat.

## Instalación posterior completamente desde GitHub
Después de obtener `GITHUB_SPLASH_UPLOAD=PASS`, instalar con:
```bash
curl -fsSL \
  'https://raw.githubusercontent.com/AlanPalacios23/tala-eats-version-web/feat/mobile-parity-v1046-navigation/deploy/INSTALAR_SPLASH_TALA_EATS_DESDE_GITHUB.sh' \
  -o /tmp/INSTALAR_SPLASH_TALA_EATS_DESDE_GITHUB.sh
bash /tmp/INSTALAR_SPLASH_TALA_EATS_DESDE_GITHUB.sh
```

El instalador clona una release inmóvil por SHA, prueba `npm run check`, valida WebP en `dist`, llama al actualizador público con respaldo y confirma `/clientes` y el `image/webp`. **Jamás ejecutar el instalador antes de que GitHub tenga la imagen.**

## Descargas directas futuras desde GitHub
- Imagen: `https://raw.githubusercontent.com/AlanPalacios23/tala-eats-version-web/feat/mobile-parity-v1046-navigation/public/branding/splash-exacto-728x1536.webp`
- ZIP: `https://raw.githubusercontent.com/AlanPalacios23/tala-eats-version-web/feat/mobile-parity-v1046-navigation/deploy/releases/TalaEats_Splash_Exacto_Instalacion_Kali.zip`

Estos enlaces a binarios solo serán válidos después del primer push. El último despliegue público verificado por el usuario antes de esta iteración es `a742238b5c08090ea6a903f8cef1ec26db10a61f`; ningún script se ejecuta automáticamente en Kali desde GitHub.
