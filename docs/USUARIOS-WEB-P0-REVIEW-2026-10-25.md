# TALA EATS Usuarios Web — P0 después del primer deploy público (25/oct/2026)

**Flutter de referencia:** repositorio `AlanPalacios23/tala-eats-mobile`, PR #67, rama `feat/usuarios-v1046-rc810-stripe-test-delivery-20261024`, SHA `f247bf3996a41b1af2e0384c787e6fd2f4fe9d5d`. No comparar contra el `main` antiguo de Mobile. **Web:** PR #3, `feat/mobile-parity-v1046-navigation`, DRAFT. **Dominio:** `https://web-talaeats.alan-palacios-dev.com/clientes`.

## Evidencia real de Android Chrome suministrada por usuario
1. Home y detalle de The Burger House presentan iconos de imagen rotos y textos alternativos visibles en marcos grandes.
2. El detalle de "The super burger king" exhibe incluso el texto alternativo como tipografía de proporciones enormes dentro del bottom sheet.
3. Al volver desde comercio con un producto agregado el carrito aparece y el checkout cotiza $260 + 7% ($18.20) = $278.20 para recoger. Esta es una cotización de backend, no una entrega, aceptación ni cobro comprobado.
4. Tarjeta con Stripe muestra 'Disponible únicamente cuando el backend active Stripe TEST'; no activar tarjeta LIVE a fuerza en cliente web.
5. La entrega muestra 'Pendiente de activación del servidor'; no manipular controles CSS/JS para eludir autorizaciones del API. Requiere backend, cotización y reparto realmente activos.
6. No existía splash equivalente al LaunchScreen Flutter y el flujo de sesión/logout no se parecía a la app móvil.

## Correcciones implementadas en Web, posteriores a la versión pública b33c9916
- **Imágenes:** `CustomerPhoto.tsx` reemplaza inmediatamente recursos fallidos o URLs no permitidas por un fallback visual accesible, acotado a su contenedor, SIN inventar imágenes de restaurantes. Home, detalle de tienda, productos, modal y búsqueda usan la misma recuperación. Playwright devuelve 404 para fotos y verifica que no quede un `img` roto.
- **Inicio y sesión:** primer splash blanco antes incluso de JS (`index.html`); una segunda vista React se mantiene únicamente durante la carga/verificación inicial de sesión. Transiciones reducidas respetan prefers-reduced-motion.
- **Login:** la confirmación POST no basta; se verifica GET `/auth/me` con cookie de mismo origen. Las respuestas tardías del bootstrap ya no pueden borrar un login recién validado. Redirección por defecto al Home Usuarios y vuelta a la pantalla original cuando hay `from`.
- **Logout:** lleva a `/acceso`, nunca a una tienda visualmente abierta; errores del servidor son visibles, no redirige simulando cierre exitoso. Se limpia el carrito de la cuenta anterior al logout/cambio de usuario.
- **Carrito:** snapshot público sin tokens/password/pagos en sessionStorage, validado en read para comercio, stock, precios y límite; requiere cotización server-side nuevamente antes de registrar un pedido. No guardar PII.
- **QA:** capturas responsive esperan a que el splash desaparezca para no reportar falsos PASS. Flujo de inicio y cierre de sesión con mocks (sin compras, logins reales o escrituras LIVE).

## Lo que SIGUE pendiente — no reportar "100% idéntica"
- **Fotografías reales:** el servidor/URLs del catálogo del comercio pueden devolver 403/404; el nuevo fallback elimina el defecto visual, pero no restaura bytes de imágenes perdidas ni reemplaza contenido que los comercios no hayan cargado. Auditar `cover_image_url` y `menu_items[].image_url` del backend y su ruta de media antes de tocar el catálogo.
- **Autenticación paso a paso:** el Flutter Mobile tiene `TalaWelcomeScreen`, `TalaLoginMethodsScreen`, `TalaStepAuthScreen`, recuperación/verificación y controles nativos. La Web aún tiene formulario propio; el splash no implica paridad visual del onboarding.
- **Pagos y domicilios:** Stripe TEST, webhook firmado, entrega con costo por distancia y liquidaciones no están habilitados por desplegar el frontend. El backend LIVE y sus métodos de pago son la autoridad. No cambiar flags sin pruebas E2E en backend staging.
- **Pedimentos, chat, push, rastreo y contabilidad:** las consultas y algunas acciones Web implementadas todavía necesitan pruebas reales con cuentas de test y backend aislado; Flutter incluye FCM nativo, seguridad/privacidad, PIN de entrega, recompra, reembolsos y otras pantallas no portadas en su totalidad.
- **Assets de Flutter:** el Flutter LaunchScreen apunta a `assets/landing/tala_eats_original_wordmark.png`, pero no está versionado en la rama móvil de referencia; Web usa lettering de marca como fallback. Para una copia idéntica, aportar el asset oficial, no generar un logotipo diferente.
- **Visuales:** QA de Web capturas 320-1024 y 1.3x no sustituye comparativa de goldens auténticos Flutter y pruebas de movimiento/teclado en dispositivos reales.

## Publicación y reversión
El commit nuevo debe aprobar el workflow de **Web CI**, **Visual QA** y **Smoke**. Después compilar en Kali con `env -u VITE_PREVIEW_READONLY npm run build` y usar el actualizador de `deploy/kali-update-existing-public.sh`, primero `--plan`. La versión pública instalada desde el primer deploy `b33c9916bc3723d5c5d894b907bbc77808aba050` permanece intacta hasta aplicar un nuevo SHA. Se conserva el backup del release antiguo en `/srv/talaeats-pwa/backups/` y el symlink `previous-public`.
