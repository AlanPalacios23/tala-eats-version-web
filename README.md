# TALA EATS · Versión Web PWA

Un solo repositorio con portada de acceso editorial oscura, tres áreas responsive y un único backend Node.js RC8.13 LIVE:

- **Clientes:** catálogo real, detalle y menú, carrito por comercio, cotización
  del backend, pedido pickup **en efectivo** cuando está autorizado, historial.
- **Restaurantes:** inicio de sesión para cuentas con rol de restaurante,
  pedidos y estados, menú/precios/stock, abrir/cerrar y KPIs.
- **Repartidores:** acceso según rol, perfil, entregas y ofertas del servidor;
  **acciones desactivadas en LIVE**, hasta que se certifique el reparto real.

**NO** se ha creado una segunda API, una nueva base de datos ni se ha cambiado
la versión RC8.13 LIVE desplegada en Kali.

## Portada de accesos

- `/`: portada negra premium tipo selector, inspirada en la captura aportada por el usuario, pero con identidad propia TALA EATS; accesos a Clientes, Restaurantes y Repartidores.
- `/clientes`: catálogo y búsqueda originales, separados de la portada.
- `/restaurante` y `/repartidor`: protecciones de rol existentes; no se exponen acciones LIVE prohibidas.
- Botones Entrar y Registrarse, y menú móvil accesible.

## Estado real por función

| Función | Estado web MVP |
|---|---|
| Catálogo y menú verificados | Implementado, consume backend LIVE |
| Login/registro con cookie HttpOnly | Implementado, mismo origen |
| Carrito y cotización servidor | Implementado |
| Pickup efectivo | Condicional: métodos habilitados + comercio autorizado |
| Pickup tarjeta Stripe LIVE | Pendiente de Stripe.js + confirmación de pago |
| Restaurante: pedidos, estados, menú y apertura | Implementado; reglas del backend |
| Repartidor: perfil y consultas | Implementado; sujeto al backend |
| Reparto/entrega real | **No habilitado en LIVE** |
| Notificaciones push | Pendiente |
| Imágenes originales/logotipo vectorial | Pendiente de importar activos oficiales |

## Iniciar localmente

```bash
npm install
npm run dev
```

Abrir http://127.0.0.1:5173. Vite reenvía `/api/v1` al backend real para
consultas y autenticación. **Advertencia**: el proxy de desarrollo apunta a
producción. No crear pedidos de prueba ni cuentas desechables en LIVE. El
checkout en efectivo usa los permisos reales y no es un modo de simulación.
Para probar transacciones usa un backend de laboratorio aislado y revisa
`vite.config.ts` antes de iniciar. En producción se usa Nginx mismo origen;
consulta [el runbook de Kali](deploy/PRODUCCION-KALI.md).

```bash
npm run test
npm run build
```

El proyecto requiere Node 22+ y npm. En el entorno de creación no se pudieron
descargar dependencias desde npm; el workflow de GitHub debe confirmar pruebas
y compilación, y generar un lock reproducible antes de desplegar a Kali.

## Arquitectura

```text
Chrome / Safari / Edge
          |
https://web-talaeats.alan-palacios-dev.com
          |
   Cloudflared → Nginx 127.0.0.1:18195
                    ├─ /                → React/Vite PWA (static)
                    └─ /api/v1/*        → Backend RC8.13 LIVE 127.0.0.1:18190
                                              ├─ PostgreSQL LIVE existente
                                              ├─ Redis LIVE existente
                                              └─ Stripe LIVE (mismo ledger)
```

La API no se incluye en este repositorio, tampoco secreto alguno.
La autenticación utiliza cookie **HttpOnly Secure SameSite=Lax** devuelta por
el backend y credenciales `include`. No se almacena access token en localStorage.
El Service Worker cachea sólo estáticos públicos; no cachea `/api/v1`.

## Límites antes del lanzamiento comercial

La auditoría RC8.13 LIVE del 24/10/2026 informó
`SELLER_OWNER_APPROVED_MAPPINGS=0`: ningún comerciante autorizado aún a
cobrar en producción. La PWA no elimina ese requisito.

El backend aún impide acciones de reparto LIVE, y el Web MVP no debe fingir
que un pedido se entregó si el API lo rechaza. La integración de tarjeta web
se mantuvo fuera del flujo para no manejar pagos sin confirmación firmada.

## GitHub — repositorio del proyecto

Repositorio: **`AlanPalacios23/tala-eats-version-web`**. Contiene el frontend
PWA y sus pruebas. Los cambios a RC8.13 LIVE deben revisarse por separado
en el repositorio del backend: no se despliegan automáticamente desde aquí.

El repositorio se creó inicialmente como **público** en GitHub. Si la política
operativa requiere repositorios privados, cambiar su visibilidad desde Settings.
Nunca subir archivos `.env` reales, tokens, contraseñas, claves Stripe ni datos
de compradores a GitHub.

### Referencias del contrato API comprobado

Backend repositorio `AlanPalacios23/AlanPalacios23-tala-eats-backend`, SHA LIVE
`aea74744ba47db2333bcef052b296a7a7ab63eb9`:

- `/api/v1/auth/{register,login,logout,me}`
- `/api/v1/restaurants` y `/api/v1/restaurants/:id`
- `/api/v1/orders/{payment-methods,quote,mine,by-reference/:ref}`
- `/api/v1/owner/{restaurant,orders,menu,analytics}`
- `/api/v1/driver/{profile,dashboard,mine,available}`

La API es fuente de autoridad para permisos, precios, pagos, stock y estados.
