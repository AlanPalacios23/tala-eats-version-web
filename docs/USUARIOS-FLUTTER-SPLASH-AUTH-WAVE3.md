# TALA EATS Usuarios · Web PWA Wave 3: splash, bienvenida y autenticación Flutter

**Fuente de verdad:** repo mobile, rama main, archivos tala-eats-usuarios/app/lib/main.dart,
ui/auth_screens.dart, ui/design_system.dart, ui/legal_screens.dart.

## Flujo reproducido
La rama main de Flutter **no incluye un onboarding intermedio**:
1. Arranque `LaunchScreen`, splash crema blanco `#FFFAF6`, gradiente de `AuthBackdrop`.
2. `TalaLogoMark(size:88)` con fondo naranja `#FF7A3D → #FF5A1F → #CE3C0A`, icono redondeado `delivery_dining`, escala 0.86→1.
3. A los 242 ms entra el nombre `Tala Eats` y el lema `Tu comida favorita, más cerca.`; a los 660 ms aparece el loader de 64 × 3 px.
4. La marca dura al menos **1100 ms** en paralelo con `/auth/me`. Cuando concluyen ambos, fundido de **420 ms**.
5. Si no existe sesión, aparece `Bienvenido de vuelta`. Si existe sesión, entra directamente al Home de Usuarios.

## Interfaces portadas
- Login: título/subtítulo exactos de Flutter, Roboto, formulario Material con labels flotantes dentro de borde radio 16, CTA 54 px naranja profundo, mostrar/ocultar contraseña, 2FA opcional desplegable para conservar soporte web.
- Crear cuenta: nombre/correo/contraseña/confirmación, fuerza 8+ caracteres con mayúscula, minúscula y número, validación de consentimiento, enlace a documentos.
- Confirmar datos: nombre/correo revisables y `Crear cuenta y entrar` (solo entonces llama a la API; no simula SMS).
- Recuperar contraseña: solicitud explícita `/auth/password/forgot` y mensaje condicionado por éxito HTTP; restablecer por token `/auth/password/reset`.
- Éxito: `SuccessOrb` 620 ms verde para restablecimiento/solicitud, respetando la preferencia reducir movimiento.
- Pantallas legales: contenidos basados en `legal_screens.dart` (revisión legal final pendiente; la web no afirma permisos Android).
- Manifiesto PWA Clientes y theme-color pasan a `#FFFAF6` exclusivamente en rutas de clientes.

## Aislamiento y seguridad
- No altera portada principal `/`, Restaurante `/restaurante`, Repartidor `/repartidor`, API financiera, Stripe ni el servidor Kali.
- Usuarios sin sesión reciben splash y login al entrar a las rutas de la PWA. No se solicita acceso administrativo.
- Mantiene soporte de inicio de sesión de otros roles en el portal; redirección basada en rol del servidor.
- No guarda claves/OTP en localStorage y no realiza POST en QA.
- No presupone que la recuperación de contraseña LIVE esté operativa; errores reales se muestran al usuario.
- Los términos requieren revisión legal antes de etiquetarlos definitivos.

## QA
Pruebas Vitest de arranque 1100ms + 420ms, cuatro intervalos de animación,
registro por etapas, endpoints reales, claves de manifiesto e integridad de rutas;
TypeScript y build Vite mediante GitHub Actions.
**Estos tests no prueban igualdad visual pixel a pixel ni el flujo de email real.**
Para esa certificación siguen pendientes screenshots en Android Flutter y Chrome PWA
a 320/360/390/430dp con fontScale 1.0/1.3, modo reducir movimiento y teclado virtual,
además de pruebas de sesión/registro/recuperación en entorno no productivo.

## Estado de despliegue
Todo guardado en la rama `feat/usuarios-flutter-home-search-parity`,
PR #1, todavía borrador.
**No ha sido desplegado a Kali LIVE.**
