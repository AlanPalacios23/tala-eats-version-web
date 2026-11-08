# RC170 — Tala Eats Crece / Fundadores: QA y despliegue seguro

**PWA fuente:** rama `feat/restaurantes-crece-fundadores-20261108`, descendiente directa de la última interfaz de Restaurantes RC169 (PR #46), no de `main` antiguo.  
**Estado:** preparado para revisión / CI, **no instalado en Kali**.

## Alcance verificado en código

- Visita pública informativa por `/restaurante?vista=crece` en la PWA dedicada de restaurantes cuando se publique el build.
- Página de acceso normal incorpora un botón **«Conoce Tala Eats Crece»**; volver a iniciar sesión mantiene el flujo anterior.
- Comercio autenticado autorizado ve nueva pestaña **Crece** y puede regresar a Menú, Pedidos y Rendimiento.
- Catálogo versionado de 27 beneficios, cinco pilares y tres estados por capacidad: **Disponible en la app**, **Con apoyo del equipo** o **En preparación**.
- Programa Fundadores máximo 10 con **propuesta de** alta/mensualidad $0, comisión estándar 17% productos y 7% de servicio al cliente. Sin exclusividad, sin ventas garantizadas.
- Consejos con `ownerAnalytics` solo cuando se reciban métricas válidas; cifras antiguas no se presentan como saldos retirables.
- QR local con biblioteca `qrcode` y URL del comercio verificada por configuración HTTPS. Sin peticiones a un tercero para generar imágenes del QR.

## Comprobaciones para revisión (no operaciones LIVE)

1. `npm install --no-audit --no-fund && npm test && npm run build` en CI. Deben generar tanto el portal cliente como la PWA dedicada de restaurantes.
2. Chrome Android, Safari iOS, escritorio: 320/360/390/430/768/1200 px, aumento de texto, teclado, toque y navegación inferior de **seis** opciones. La barra no debe tapar botones.
3. La portada pública debe verse sin inicio de sesión. No hay formulario de alta falso ni solicitudes que parezcan enviadas.
4. Con cuenta de comercio de **staging**, sección Crece carga beneficios y consejos. Sesión sin permisos de comercio no debe ver información privada.
5. Si el backend no devuelve indicadores, mostrar «no confirmados» y **ninguna cifra inventada**.
6. Con la variable de dominio ausente, el QR debe aparecer desactivado y explicar por qué.
7. Antes de habilitar QR, configurar `VITE_TALA_CUSTOMERS_BASE_URL` como **origen HTTPS real del portal de clientes**. Abrir manualmente `<origen>/comercio/<id>` para cada comercio de prueba, confirmar publicación y ausencia de redirecciones incorrectas.
8. Confirmar que la PWA de Restaurantes y la de Clientes no confunden los dominios al construir enlaces. No usar el origen de Restaurantes como si fuera el de Clientes.
9. El botón «copiar» debe copiar el link, no tokens ni datos financieros; ofrecer el campo visible como respaldo si el navegador deniega portapapeles.
10. Carga de Pedidos, menú, estado de tienda, Wallet y operaciones de repartidor se comporta **exactamente igual que antes**, sin llamadas API adicionales hechas por Crece.
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
