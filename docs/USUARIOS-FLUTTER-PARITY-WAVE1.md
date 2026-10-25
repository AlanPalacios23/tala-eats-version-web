# Usuarios Web v0.2 — primera réplica visual de Flutter

## Fuente de verdad
Revisión del repositorio conectado [tala-eats-mobile](https://github.com/AlanPalacios23/tala-eats-mobile), rama main:
- tala-eats-usuarios/app/lib/ui/discovery_screens.dart: CustomerShell, PremiumBottomDock, HomeScreen, HomeSearchPill, RestaurantCard, SearchScreen.
- tala-eats-usuarios/app/lib/ui/design_system.dart: Roboto, naranja #FF5A1F, fondos #FAFAF9, espacio 20dp, cards 16:9.
- tala-eats-usuarios/app/lib/ui/market_selector.dart y docs/UX-QUIET-UI-v1.0.27.md: piloto Tala y UI minimalista.

Los PR más recientes de Usuarios siguen en borrador; esto se basa en main y no asegura paridad con cambios todavía no fusionados.

## Implementado en la primera etapa
- Inicio /clientes: encabezado de ubicación/comercio, saludo, búsqueda, lista del catálogo real, error/empty/loading.
- Buscar /buscar: búsqueda real por nombre, categoría y descripción, sin resultados ficticios.
- Cards: fotos 16:9, rating y ETA sólo si vienen del servidor, cerrado solo cuando aplique, modalidad pickup del backend.
- Corazón favorito: preferencia local de este navegador (NO sincronizada con el backend ni con la cuenta).
- BottomDock de 4 pestañas: Inicio, Buscar, Pedidos, Cuenta.
- CSS aislado te-customer: tipografía Android Roboto, colores/espacios Flutter, responsive desde 320px, focus visible, reduce motion.

## Pendientes: no hay paridad completa todavía
- Detalle del comercio, carrito, checkout, historial y cuenta: siguen con UI web previa, aunque sus endpoints se mantienen intactos.
- Auth login/registro Liquid Glass: primero reconciliar con PR Flutter de autenticación para portarlo fielmente.
- Buscar por platillo exige menú disponible en el contrato web; NO inventamos platillos.
- Notificaciones no disponibles en PWA: icono deshabilitado. Selección de mercado/dirección pendiente del contrato real.
- Fotos del catálogo dependen de backend. No inventar imágenes, promociones, reviews, tarifas ni tiempos.
- No se ha ejecutado QA visual pixel a pixel en teléfono real. Los tests de CI certifican código y build, no igualdad visual completa.

## Entrega y límites
- No se modifican backend RC8.13 LIVE, PM2, Stripe, Cloudflared, Nginx ni PostgreSQL.
- No se lanzan pedidos ni pagos para probar diseño.
- Los roles Restaurante y Repartidor conservan su interfaz anterior.
- Para desplegar estáticos tras revisión y build, usar deploy/kali-update-pwa-static.sh.
