# RC159 — Repartidores: confiabilidad y datos honestos

**Estado: candidato, NO publicado en Kali.** Basado en RC158 (PR #42). El despliegue que se confirmó en Kali fue RC156 PWA (`54413d0596f009218dc0eb438ba6f59597c51066`), con backend entonces identificado como `f92f5d9a52856f24e155dcbc140dcff0e266056a`. Se debe revalidar identidad LIVE antes de cualquier publicación posterior.

## Ajustes
- **No saturar la API:** un ciclo de refresco automático a 15 s no inicia otra ronda mientras la anterior aún continúa. Refresco manual y conciliación postacción mantienen prioridad, resguardados con `refreshVersion`. No se modifican rutas ni frecuencia de GPS.
- **Dinero y ofertas:** una única función estricta valida ganancias del repartidor. Valores no finitos, negativos, exponenciales, vacíos o con formato corrupto aparecen como «Por confirmar»/«Ganancia pendiente»; no se muestran como pesos ni se usan para ordenar por ganancia.
- **Fecha de jornada:** `Hoy` compara el día local del dispositivo, no el día UTC, evitando etiquetar erróneamente períodos alrededor de medianoche.
- **Recuperación del mapa:** un fallo temporal de teselas de OpenStreetMap se limpia al volver a cargar teselas; no oculta errores del motor Leaflet o de GPS.

## Seguridad y compatibilidad
PWA **solo Repartidores**, sin cambios de backend/Stripe/PG/PM2, cobros, wallets, aprobación administrativa, tasas/comisiones ni flujos de entrega. Conserva filtros, mapas, PIN, sesión por repartidor, privacidad GPS y componentes de RC157/158. No habilita nuevas funciones de backend.

## QA automático
- `npm test`, `npm run check`, `npm run build:repartidor` y workflows PWA, Repartidores móvil, capturas responsivas en GitHub para el SHA final.
- Casos unitarios: importes falsos/negativos, ordenación segura, límite de refresco automático, fecha local entre meses, mapa que recupera teselas, permisos y PIN.

## QA real antes de publicar
Comprobar en Android/iOS, sesión autorizada y sin transacciones reales: modo sin red y vuelta online, varios cambios de ubicación, 0/1/múltiples ofertas, abrir/cerrar mapa, ordenador de ofertas, retirar GPS, mapa con mala conectividad, entrega activa y botones seguros. Verificar específicamente que el mapa no conserva GPS vencido tras 60 s. La prueba de pago/delivery de extremo a extremo sigue pendiente del backend, no hacerla con dinero real sin aprobación separada.

## Deploy posterior, aislado a puerto 18199
1. Identificar nuevo SHA GitHub fijado y CI PASS. Detectar el backend realmente ejecutado con `rc138-kali-driver-live-preflight.sh --detect-backend`.
2. Clonar/compilar como `tala-node-stage` usando el builder aprobado (`deploy/rc138-kali-build-driver-only.sh`) en release SHA nuevo.
3. Preflight de solo lectura `deploy/rc138-kali-driver-deploy.sh --plan WEB_SHA BACK_SHA`. NO proseguir si HOLD, diferencias de backend o flags inesperadas.
4. Solo después de revisión de plan y respaldo usar el wrapper aislado `--apply WEB_SHA BACK_SHA I_APPROVE_DRIVER_RC138_STATIC_ONLY`, verificar symlink, bytes local/público y funcionamiento real.
5. Ante fallo, detener y recuperar el release anterior mediante el rollback de Repartidores; no reiniciar Stripe ni los otros portales.

Esta PR no ejecuta el deploy ni activa permisos de reparto.
