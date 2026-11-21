# RC170 — Tala Eats Crece / Fundadores: QA y despliegue seguro

**PWA fuente:** rama `feat/restaurantes-crece-fundadores-20261108`, descendiente directa de la última interfaz de Restaurantes RC169 (PR #46), no de `main` antiguo.  
**Estado:** preparado para revisión / CI, **no instalado en Kali**.

## Alcance verificado en código

- Visita pública informativa por `?vista=crece` sobre la **URL dedicada de Restaurantes** cuando se publique el build. React Router administra la consulta y la navegación Atrás.
- Página de acceso normal incorpora un botón **«Conoce Tala Eats Crece»**; volver a iniciar sesión mantiene el flujo anterior.
- Comercio autenticado autorizado ve nueva pestaña **Crece** y puede regresar a Menú, Pedidos y Rendimiento.
- Catálogo versionado de 27 beneficios, cinco pilares y tres estados por capacidad: **Disponible en la app**, **Con apoyo del equipo** o **En preparación**.
- Programa Fundadores máximo 10 con **propuesta de** alta/mensualidad $0, comisión estándar 17% productos y 7% de servicio al cliente. Sin exclusividad, sin ventas garantizadas.
- Consejos con `ownerAnalytics` solo cuando se reciban métricas válidas; cifras antiguas no se presentan como saldos retirables.
- QR local con biblioteca `qrcode` de carga diferida. Exige origen HTTPS, **identificador exacto en el listado público** y **detalle de comercio confirmado** por la API. Si no hay prueba, no muestra ni permite copiar el QR.

## Comprobaciones para revisión (no operaciones LIVE)

1. `npm install --no-audit --no-fund && npm test && npm run build` en CI. Deben generar tanto el portal cliente como la PWA dedicada de restaurantes.
2. Chrome Android, Safari iOS, escritorio: 320/360/390/430/768/1200 px, aumento de texto, teclado, toque y navegación inferior de **cinco** opciones. Crece queda en la navegación lateral y en una tarjeta dentro de Mi negocio, no como una sexta pestaña inferior.
3. La portada pública debe verse sin inicio de sesión. No hay formulario de alta falso ni solicitudes que parezcan enviadas.
4. Con cuenta de comercio de **staging**, sección Crece carga beneficios y consejos. Sesión sin permisos de comercio no debe ver información privada.
5. Si el backend no devuelve indicadores, mostrar «no confirmados» y **ninguna cifra inventada**. El checklist de perfil nunca certifica pagos ni significa GO comercial.
6. Con la variable de dominio ausente, una tienda no listada, un detalle de otro ID o un error de red, el QR debe aparecer desactivado y explicar por qué. El usuario puede volver a comprobarlo.
7. Antes de habilitar QR, configurar `VITE_TALA_CUSTOMERS_BASE_URL` como **origen HTTPS real del portal de clientes**. Abrir manualmente `<origen>/comercio/<id>` para cada comercio de prueba, confirmar publicación y ausencia de redirecciones incorrectas.
8. Confirmar que la PWA de Restaurantes y la de Clientes no confunden los dominios al construir enlaces. No usar el origen de Restaurantes como si fuera el de Clientes.
9. El botón «copiar» debe copiar solo el enlace público confirmado, nunca tokens ni datos financieros; ofrecer el campo visible como respaldo si el navegador deniega portapapeles. El QR solo se genera tras comprobar publicación.
10. Carga de Pedidos, menú, estado de tienda, Wallet y operaciones de repartidor se comporta **exactamente igual que antes**. Crece solo realiza **dos lecturas públicas** para comprobar publicación cuando un comercio autorizado abre esa sección; sin mutaciones nuevas.
11. Revisar con asesoría legal/publicitaria términos de comisión, publicidad y derechos de fotos antes de enviar campaña a comercios.

## No publicar todavía

- Beneficios asistidos como si fueran ya concedidos, campañas automáticas, puntos, cupones y descuentos.
- Promesas de retiros rápidos o pagos no conciliados.
- Cupos ocupados, números de comercios o testimonios ficticios.
- Crece para cambiar roles, reembolsos, wallets, tarifas o políticas de pedidos.
- Endpoint público de inscripción hasta M4/M9, consentimiento, protección anti abuso y auditoría.

## Despliegue cuando se autorice

Mantener la misma instalación estática de la PWA de Restaurantes, con los scripts existentes de RC169 y un SHA fijo. **No crear un nuevo backend ni otro proceso PM2.** Primero preflight y backup de assets estáticos, build verificado, luego publicación de la nueva versión y smoke público; revisar rollback del release anterior. No tocar los procesos PM2 del backend ni PostgreSQL 18.

La aplicación instalada actual sigue operando hasta aprobar una promoción separada. El programa Core v2 está en PR independiente y **no forma parte de este build estático**.

## Documentos

- [Kit comercial de Fundadores](TALA-EATS-CRECE-KIT-COMERCIAL.md)
- [Backend Core v2 — contrato](https://github.com/AlanPalacios23/Tala-Eats-NewBackend/blob/feat/core-v2-crece-fundadores-lab-20261108/docs/TALA-EATS-CRECE-FUNDADORES-PROGRAMA.md)
- [Core v2: gates para salida comercial](https://github.com/AlanPalacios23/Tala-Eats-NewBackend/issues/20)

## RC171 — mejoras de calidad añadidas en la misma rama, sin otro backend

- **Verificación de publicación:** el QR no se habilita hasta recibir coincidencia exacta entre la tienda autenticada, el listado público y su detalle público del backend. Si los endpoints fallan, la acción queda deshabilitada, con opción de reintento. La comprobación revisa páginas sucesivas de 100 registros (hasta 12 páginas = 1,200 comercios consultados) y detiene solicitudes si el componente se desmonta. Si se alcanza el límite sin encontrar la tienda, el QR permanece bloqueado y se requiere una verificación individual, nunca publicar el enlace por suposición.
- **Preparación del perfil:** checklist informativo de 5 pasos (identidad, dirección, artículo disponible/stock, imagen y publicación comprobada). Estos pasos **no** afirman que la plataforma esté lista para cobros.
- **Simulador monetario exacto:** entrada validada en MXN de hasta seis dígitos enteros y dos decimales; cálculo de 17% comercio / 7% servicio en **centavos enteros**, misma convención de redondeo half-up que M1; no emite Stripe PaymentIntent, factura ni saldo. Comprobar 250.00 → 42.50 de comisión, 207.50 antes de ajustes para el comercio, 17.50 de servicio cliente. Para 500.00, servicio 35.00 **sin tope de 25**.
- **Navegación móvil sin ruido:** mantiene las 5 pestañas inferiores originales; Crece queda en la barra lateral de escritorio y dentro de **Mi negocio** en móvil. Navegación `?vista=crece` sincronizada con React Router, con botón volver y gesto Atrás.
- **FAQ pública:** ocho preguntas mediante elementos `details/summary`, con respuestas prudentes sobre afiliación, exclusividad, ventas, pagos, dispositivos, fotos, entregas y cupos.
- **Nuevos tests:** verificación del QR con doble lectura, checklist que no inventa stock, importes/redondeo exactos, SSR de la sección pública y calculadora, beneficios y permisos internos.

**Antes de publicar realmente:** además de `npm test && npm run build`, verificar de forma manual que la página pública existe en el dominio correcto de Restaurantes (consulta `?vista=crece`) y que Clientes responde para el ID correcto, tanto con tienda abierta como cerrada. La coincidencia del listado y ficha prueba que el backend la expone, **no que los derechos de las fotos estén autorizados**. Confirmar permisos y consentimiento.

**No desplegado en Kali**: estos cambios todavía están propuestos en PR de PWA. La integración Core v2 sigue bajo gates G1–G9 y no admite operaciones comerciales.

## RC172 — calidad, escalabilidad y continuidad (9/nov/2026)

**PWA de clientes sin nueva pantalla:** el catálogo ahora incluye botón `Cargar más comercios` y consulta `/restaurants?limit=100&offset=N`. Se preservan los parámetros y permisos existentes. La búsqueda usa exclusivamente negocios ya cargados y lo explica sin presentar resultados parciales como una búsqueda global. La lista deduplica comercios si hay superposición entre páginas y detecta cuando el backend ignora `offset` para **detener paginación infinita**. Una respuesta malformada no añade tarjetas ni inventa tiendas; muestra un reintento seguro.

**PWA restaurantes / Crece:** la publicación de QR verifica el detalle público y busca el ID a través de páginas sucesivas, hasta **1,200** comercios consultados. Más allá del límite, o ante un error de API, **falla cerrado** y solicita revisión; un catálogo pequeño sin coincidencia se marca como no publicado. Las peticiones de verificación se cancelan al salir de Crece. Tras verificar publicación, el negocio puede guardar el QR en PNG directamente en el dispositivo. En iOS el navegador podría abrir la imagen en vez de descargarla: comprobar Safari real antes de prometer impresión con un toque.

**Pruebas añadidas:**
- Comercios en páginas posteriores a los primeros 100, identificación exacta, sin QR por detalles incompatibles o catálogo malformado
- Petición cancelada durante la búsqueda, límite de exploración y reintentos
- Búsqueda y deduplicación del catálogo de clientes, offsets y respuesta a servidores que repiten páginas
- Validación CI de clientes y restaurantes (unitarios, TypeScript y compilación PWA) en GitHub

**Limitaciones deliberadas:** las páginas del backend actual emplean `offset`, no un cursor consistente; si los negocios se agregan o eliminan mientras el usuario recorre el catálogo, puede variar el orden. Una solución de búsqueda/paginación con cursor, clasificación geográfica y filtro en servidor debe llegar con la estabilización de Core v2. No llamar a la PWA actual «búsqueda global» ni «listado total» antes de disponer de ese servicio.

**Regla de producción:** esto no habilita inscripción comercial, pagos, repartidores o wallets. La PWA sigue en borrador, sin publicación en Kali. El backend actual continúa con PM2, y el nuevo Core v2 se prueba de forma aislada en GitHub.

## RC173 — verificación vigente del QR (9/nov/2026)

- Una comprobación de publicación tiene vida limitada: la PWA realiza una **revalidación cada 90 segundos** mientras la sección Crece está abierta y visible, y al volver a primer plano o recuperar la conexión.
- Durante una nueva comprobación, cuando el dispositivo pierde internet, cambia el ID de comercio, alcanza el límite de páginas o el backend falla, **el enlace, el botón de copiar y el PNG anterior quedan inhabilitados inmediatamente**. La respuesta de una petición cancelada o anterior no puede reactivar el QR por accidente.
- El comerciante dispone de **«Abrir mi tienda en Clientes»** una vez que su ficha supera la doble verificación del backend. Esta acción abre la URL pública exacta en una pestaña nueva con `noopener noreferrer`; no confirma que el dominio de clientes esté operativo, por lo que el equipo debe probarlo antes de distribuir material impreso.
- Las opciones del QR continúan siendo **PNG 1024 px, margen de cuatro módulos y corrección Q**. No se sube la imagen QR a servicios externos.
- Nuevos tests verifican bloqueo por conexión, revisión anterior, cambio de tienda y estados de error. La sesión de dueño y el catálogo público se consultan para mostrar el enlace; **no se introduce ninguna mutación, orden, gasto o pago**.
- Prueba manual pendiente en Android Chrome/iOS Safari: volver a primer plano, desconectar/reconectar red, cerrar tienda en otra sesión, descargar el PNG e intentar acceder al dominio de clientes real. No anunciar la actualización como publicada hasta completar ese QA.

Esta mejora sigue en el mismo PR #48 y la PWA de Restaurantes preexistente, sin una pantalla adicional y sin afectar la aplicación de Repartidores.
