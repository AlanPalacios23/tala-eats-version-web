# RC175 — Tala Eats Crece: cierre de alcance de los 27 beneficios

**Fecha:** 10/nov/2026 · **Ramas:** PWA PR #48, Core v2 PR #24.  
**Estado actual:** funcionalidad de interfaz probada en GitHub y capacidades adicionales LAB, **NO-GO en producción comercial**.  
**Arquitectura:** reutilizar el mismo backend Node/PM2, PostgreSQL18, PWA clientes/restaurantes, sin Docker ni copias persistentes de backend.

## Regla de veracidad

Un beneficio solo puede anunciarse como **operativo para restaurantes en producción** cuando haya pruebas E2E, sesión/propietario autorizado, persistencia, soporte y publicación verificadas. Que aparezca un botón, se descargue un borrador o pase un test LAB no cumple este criterio.

La PWA incorpora 27 acciones seguras y distinguibles: navegar a una funcionalidad existente, copiar un enlace público verificado, abrir un contacto comercial oficial o generar un documento de preparación marcado como **no publicado**. No hay botones que inventen cupones, pedidos, retiros o ventas.

## Matriz completa de los 27 beneficios

| N.º | Beneficio | Resultado funcional en ramas | Bloqueo para operación comercial |
| --- | --- | --- | --- |
| 1 | Alta y configuración gratis | Solicitud asistida; M6 puede crear tienda en LAB; PWA Mi negocio | Vincular cuentas LIVE M4↔M6 y consentimiento aprobado |
| 2 | Fotografías | Solicitud asistida auditada M11 LAB; M6 metadata con hash | Almacenamiento binario autorizado, autorización del propietario y verificación de imagen |
| 3 | Perfil público | Catálogo de clientes y vista individual existentes | Aprobación/publicación verificadas en LIVE |
| 4 | Código QR | Verificación pública paginada, QR 1024px PNG exportable, caducidad/renovación | Validar dominio de Clientes y permisos de marca |
| 5 | Kit de lanzamiento | Borrador local descargable; solicitud asistida disponible en M11 LAB | Entrega de material real, branding aprobado, coordinación humana |
| 6 | Visibilidad Fundadores | Solicitud M11 LAB, 10 plazas atómicas Fundadores | Ranking publicitario verificado y presupuesto; divulgación de patrocinio |
| 7 | Difusión en redes | Solicitud asistida M11 LAB | Agenda y publicación real por equipo humano |
| 8 | Compartir WhatsApp | Mensaje listo para copiar si enlace público verificado | Confirmar canal/URL de Clientes al publicar |
| 9 | Enlace para Instagram | Enlace público verificado copiable para biografía | Confirmar URL de Clientes antes de difundir |
| 10 | Cupones y campañas | Borrador validado/versionado M11 LAB; plantilla descargable | Motor de descuento real M1/M3/M8, límites, reembolsos y conciliación |
| 11 | Campañas estacionales | Borrador validado/versionado M11 LAB | Presupuesto aprobado, programación real y publicación |
| 12 | Pedidos del restaurante | Tablero y actualizaciones backend v1 existentes | G1–G9 y reconciliación LIVE |
| 13 | Menú/precios/stock | Gestión del menú en PWA; M6 stock/variantes LAB | Sincronizar inventario M1↔M6 por pedido |
| 14 | Disponibilidad temporal | Abrir/cerrar comercio con confirmación de backend v1 | Horarios/sucursales reales coordinados con M6 |
| 15 | Estados de cocina | Recibido → aceptado → preparando → listo mediante backend v1 | Flujo E2E motorista, pago y entrega |
| 16 | Pedidos programados | Propuesta de capacidad/anticipación validada M11 LAB | Reserva de inventario + cobro/cancelación programada en M1 |
| 17 | Combos y paquetes | Borrador de conjunto de variantes/precio, validado en M11 LAB | Integridad variante↔stock↔precios M6/M1; sin ofertas falsas |
| 18 | Varias sucursales | Contrato borrador M11 y sucursales nativas M6 LAB | Integración M6 con catálogo de clientes, checkout, zonas y logística |
| 19 | Reportes históricos | Rendimiento existente desde API autenticada | E2E de órdenes reales y fecha/periodo verificado |
| 20 | Exportación CSV | Exportación de vista de pedidos cargados, sin direcciones ni PIN | Garantizar alcance/paginación completa si se promete un reporte total |
| 21 | Wallet de consulta | Lectura desde servidor, sin simulación de saldos retirables | Stripe Connect, conciliación M8 y política de retiros |
| 22 | Comisiones claras | Calculadora de centavos 17% comercio / 7% cliente; asesoría M11 LAB | Cotización contractual versionada y autorizada en pedidos reales |
| 23 | Soporte local | Contacto oficial opcional + solicitud M11 LAB | Equipo, horario, SLA e incidencias con responsables reales |
| 24 | Consejos comerciales | Recomendaciones basadas en contadores que devuelve API | Datos de M10 reconciliados por comercio y periodo |
| 25 | Fidelidad y puntos | Borrador de reglas validado/versionado M11 LAB | Ledger antifraude, consentimiento y canje/ajuste M1/M8 |
| 26 | Pedidos para empresas | Borrador de anticipación/volumen validado M11 LAB | Cotización real, facturación, inventario y entrega E2E |
| 27 | Distintivo de calidad | Borrador de métricas verificables M11 LAB | M10 valida umbrales reales, política y aprobación sin reseñas fabricadas |

## Validaciones técnicas existentes y añadidas

**PWA RC175**
- Unit tests: cada ID de los 27 beneficios tiene acción, no existen identificadores duplicados ni contactos WhatsApp inventados.
- Beneficios existentes navegan a secciones reales de Restaurantes. Las acciones de QR solo comparten enlaces verificados.
- El kit y los ocho beneficios todavía no comerciales generan documentación local identificada como **BORRADOR**, sin cambiar el servidor.
- Exportación CSV mantiene el límite de la vista cargada; no filtra datos personales de entregas.

**Core v2 LAB**
- M11 migración 012: siete servicios asistidos de estado `requested → in_progress → reported_completed/declined` con propietario M6, M4 sesión real, M9 autorización y evidencia SHA256. El servicio no se marca comercialmente activo.
- M11 migración 013: ocho capacidades avanzadas con borrador versionado, validaciones de precio/porcentaje/capacidad y solicitudes idempotentes; consulta aislada por propietario; ningún `published=true`.
- Pruebas concurrentes: reintentos con una misma operación, errores de versiones, permisos de otros comerciantes, transiciones ilegales, historial inmutable, no efectos en M1/M3/M8.
- Guardas SQL para impedir aplicar 012/013 fuera de bases M11 de laboratorio.
- Core v2 conserva `/v2/ready=503` y operaciones comerciales externas cerradas hasta gates de producción.

## Lo que debe cerrarse para llamar '27 beneficios funcionando en producción'

1. Terminar gateway comercial M4/M6/M9 con IDs/tokens del backend LIVE actual y endpoints autenticados (no exponer las funciones LAB tal cual).
2. Activar gestión de solicitudes/panel ADMIN con pruebas de datos y autorización multiempresa.
3. Implementar desde M1 los ocho contratos restantes hasta operación comercial real, sin modificar tarifas anteriores, con pruebas de devolución/fraude/concurrencia y auditoría.
4. Integrar inventario, marketplace, repartidor/GPS/PIN, Stripe TEST y contabilidad en la misma transacción/reconciliación operativa.
5. Verificar fotos, permisos de marca, disponibilidad real del personal y publicidad pagada; no prometer trabajo humano automáticamente.
6. Ensayar en la **misma** instalación de staging Kali PM2/PostgreSQL18 y realizar pruebas Android/iOS con rollback seguro.
7. Firma comercial y aprobación final antes de publicar beneficios para usuarios reales.

**Prohibiciones:** no llamar LIVE a un borrador, no atribuir ventas garantizadas, no prometer retiros automáticos sin conciliación, no crear una segunda pila de backend, no usar Docker en Kali y no migrar SQL LAB contra PostgreSQL LIVE.
