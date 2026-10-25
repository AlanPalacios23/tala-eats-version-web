# Usuarios Web v0.3 — réplica visual y motion Flutter, segunda etapa

## Referencias exactas del repositorio Mobile (rama main)
- discovery_screens.dart: CustomerShell, PremiumBottomDock, HomeScreen, SearchScreen, RestaurantScreen y SliverAppBar.
- design_system.dart: TalaMotion micro 140 ms, select 200 ms, reveal 300 ms, page 320 ms, success 620 ms; Curves.easeOutCubic, reveal stagger 45 ms, press scale 0.975 y PopIn 220 ms.
- purchase_screens.dart: CartScreen, CartLineCard, CheckoutSectionCard, DeliveryModeCard y resúmenes.
- order_screens.dart: OrdersScreen, ActiveOrderCard, PastOrderTile, SegmentedProgress, OrderDetailScreen.
- account_screens.dart: AccountScreen, TalaClubAccountCard, secciones de enlaces, estado de logout.
- auth_screens.dart: PremiumAuthScaffold y AuthBackdrop, con gradiente estático, glow y layout máximo 460 px.

## Código web implementado
- /clientes y /buscar: Home/Search, foto de negocio 16:9, skeleton, estados vacíos, tarjetas reales y favoritos locales.
- /comercio/:id: imagen cabecera, superposición redondeada, título compacto al hacer scroll, meta reales, categorías pegajosas, filas de producto y botón de añadir con gate de stock/permisos backend.
- /acceso: estructura y textos de Flutter, gradiente crema, brillo naranja no animado, formulario de email/contraseña, mostrar/ocultar contraseña y OTP existente.
- /carrito: tarjetas de productos, stepper, resumen, forma de entrega y botones estilizados; funciones de precio/pedido existentes preservadas.
- /pedidos: En curso/Anteriores, tarjetas y progreso por segmentos a partir de estados reales, pantalla detalle, PIN solo cuando existe.
- /cuenta: perfil, Tala Club sin saldo inventado, favoritos locales, pedidos, agrupaciones y confirmación para cerrar sesión; conserva enlaces por rol.
- Navegación: dock flotante de cuatro pestañas, indicador deslizante 280 ms, iconos/labels con selección 200 ms.
- Motion: entrada de pantalla 320 ms, revelado 300 ms + 45 ms de retraso hasta 7 elementos, presión escala 0.975 en 140 ms, heart pop 220 ms, barra de progreso 420 ms.
- Accesibilidad: @media prefers-reduced-motion:reduce, 320 px, foco visible, nombres para controles.

## Alcances preservados
Backend RC8.13 LIVE, API, Stripe, PM2, Nginx, Cloudflare y PostgreSQL siguen SIN modificar.
No se disparan pedidos ni cobros para tests. Los permisos y cálculos permanecen del lado del backend.
La portada, Restaurante y Repartidor conservan sus pantallas.

## Limitaciones / paridad pendiente
- No hay capturas reales comparadas lado a lado ni certificación pixel perfect en Android/iOS.
- Faltan los assets de marca binarios oficiales y fotos reales si el backend no las sirve; no sustituir con negocios/tiempos/reviews inventados.
- Búsqueda por platillos exige contrato real de menú consultable; la primera réplica busca comercios.
- El selector de localidades y direcciones sigue sin contrato de cambio de mercado seguro para la web. Tala está fijado como piloto.
- Tala Club y cartera muestran información indisponible en lugar de inventar saldo; faltan endpoints web verificados.
- Pagos con tarjeta Stripe Web, domicilio y acciones LIVE de reparto: siguen fuera del alcance.
- Flujo de recuperación de contraseña/OTP y notificaciones push aún no están replicados.
- La animación Flutter de confirmación de pago y seguimiento en vivo requiere un flujo web financiero y de despacho previamente verificado. No simularla.
- Reproducir más fielmente componentes específicos se hará con capturas de Flutter real y pruebas móviles.

## Despliegue
La rama está preparada para revisión. NO se desplegó a Kali; no alterar RC8.13.
Para actualización posterior usar deploy/kali-update-pwa-static.sh con --plan antes de --apply.
