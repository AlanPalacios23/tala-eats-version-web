# Auditoría de paridad Usuarios v1.0.46 — 25 octubre 2026

## Fuente
La rama main de tala-eats-mobile, SHA 39fa0ac6608eb1dca5e6a97d1f95bf3c6433888f, sigue en Flutter 1.0.30+41.
La última rama de Usuarios encontrada es feat/usuarios-v1046-rc810-stripe-test-delivery-20261024, SHA f247bf3996a41b1af2e0384c787e6fd2f4fe9d5d, Flutter **1.0.46+57**, PR #67 **DRAFT y NO fusionado**.
Verificar nuevamente antes de cualquier entrega posterior.

## Correcciones implantadas en Web
- Splash oficial: blanco total, marca PNG HD a 350x136, 5s mínimos, animación intro de 1050ms y salida en 620ms, lema «Pide, disfruta y repite.».
- Bienvenida: foto B (food_tala.webp), wordmark transparente, «Bienvenido a Tala Eats», glass Continuar de 64px y blur 20px.
- Selección: foto A (food_fiesta.webp), texto «Un antojo, mil posibilidades.», botón «Continuar con tu correo» de 64px.
- Login en 2 pasos y registro en 4 pasos (nombre, apellido, email, contraseña); progreso y CTA circular de 62px.
- Modal de consentimiento con dos checkboxes y enlaces legales. Sin Google OAuth o SMS ficticios.
- Cuenta extendida con Wallet, Notificaciones y Ayuda/soporte conectados a API real; errores de saldo y movimientos no se representan como valor cero.
- Las otras apps, Stripe y la API RC8.13 LIVE no se modificaron.

## RECURSOS OFICIALES AUSENTES
Las cuatro imágenes HD originales no están en GitHub Mobile. Mobile documenta que se ensamblaron localmente en una APK y NO aprueba sustitutos.
Recursos Web esperados:
public/landing/tala_eats_original_wordmark.png
public/landing/food_tala.webp
public/landing/tala_eats_wordmark_transparent.png
public/landing/food_fiesta.webp

Para importar el ZIP oficial aprobado por el dueño:
python3 scripts/verify-mobile-hd-assets.py --zip /ruta/TalaEats-HD-ORIGINAL.zip --install
python3 scripts/verify-mobile-hd-assets.py
npm run check

Se usan exactamente los SHA256 del verificador Mobile. El instalador de Kali de esta rama rechaza despliegue sin 4/4 PASS y dist con los cuatro archivos. Nunca inventar fotos ni un logo nuevo.

## Pendientes antes de decir «idéntica»
Visual: cotejar capturas de Flutter y PWA, con activos originales, en 320, 360, 390 y 430 dp, teclado, safe areas y reducir movimiento.
Funcional: promociones, direcciones, favoritos sincronizados, preferencias, perfil, recompensas, notificaciones push y seguimiento avanzado.
Pagos: RC8.7/RC8.10 móvil usa algunas funciones Stripe TEST y domicilio; no equivale a activar cobros LIVE web. Requiere contrato/QA financiero independiente.
Verificar que PR #67 salga de draft y sea aprobado.
No se desplegó este trabajo a Kali; web pública sigue en SHA a5f6a4042f86c19670fd2d66fb7a00735e31dfd8.
