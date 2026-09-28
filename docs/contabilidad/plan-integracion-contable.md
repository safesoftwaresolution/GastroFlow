# GastroFlow — Plan y estrategia: integración contable (Alegra / Siigo)

> Creado el 2026-09-27. Decisión de alcance: **no construir un motor contable nativo**
> (plan de cuentas, partida doble, estados financieros) dentro de GastroFlow. En su
> lugar, construir un puente que sincronice automáticamente las ventas, compras y
> gastos operativos hacia el software contable que el restaurante (o su contador) ya
> usa — Alegra primero, Siigo después.

## Por qué esta estrategia y no otra

Se evaluaron tres niveles de ambición:

1. **Contabilidad nativa completa** (PUC, libro mayor, cierre de periodo, retenciones,
   reportes de exógena DIAN) — descartada por ahora: 6+ meses de esfuerzo y GastroFlow
   asumiría responsabilidad legal de que los reportes fiscales sean correctos.
2. **Puente contable automatizado + estados financieros propios** — intermedia, no elegida.
3. **Solo integración con software contable existente (elegida)** — GastroFlow no calcula
   nada, solo empuja los datos operativos (ya con impuestos desglosados) a Alegra/Siigo
   vía su API. Menor riesgo, más rápido de lanzar, y es lo que ya se usa como estándar
   de la industria: los POS de restaurante en Colombia no reemplazan a Alegra/Siigo,
   se conectan con ellos.

Investigación de mercado (2026-09): Alegra ya tiene su propio "Modo Restaurante" (POS
incluido) y Siigo también ofrece POS — la competencia real no es solo otro POS de
restaurante, es que las plataformas contables se están expandiendo hacia el punto de
venta. Por eso GastroFlow no compite siendo mejor contador que ellas, compite siendo
el mejor operador de restaurante que alimenta la contabilidad que el cliente ya tiene.
Varios POS colombianos ya venden "integración contable con Alegra/Siigo/World Office"
como funcionalidad estándar — esto cierra brecha competitiva, no es diferenciador de lujo.

## Por qué Alegra primero, Siigo en segunda fase

- **Alegra**: API REST bien documentada (`developer.alegra.com`), autenticación simple
  (usuario + token), ya tiene verticalización "restaurante" — su modelo de factura/ítem/
  tercero calza casi 1:1 con lo que GastroFlow ya guarda. Precio de entrada bajo
  (~$69.900/mes) = es lo que más van a tener los clientes pyme de GastroFlow.
- **Siigo**: más presencia en empresas medianas/grandes, API también documentada
  (`developers.siigo.com`), pero el modelo de autenticación y "comprobantes" es más
  rígido. Se aborda en fase 5 reusando la misma arquitectura de adapters, sin rediseñar nada.
- **World Office**: fuera de alcance inicial (menor cuota en restaurantes pequeños). Se
  agrega como tercer adapter solo si aparece demanda real de clientes.

## Contexto actual del sistema (auditado 2026-09-27)

| Pieza | Estado |
|-------|--------|
| Desglose de impuestos por línea de venta | ✅ `detalle_factura.base_gravable/tasa_impuesto/valor_impuesto` (ya construido para Factus) |
| Tributo por producto | ✅ `productos.tributo` / `tasa_impuesto` |
| Datos fiscales del tenant | ✅ `tenants.nit`, `direccion`, `ciudad`, `regimen_fiscal` |
| Facturación electrónica DIAN (Factus) | ✅ Implementada (`facturas_electronicas`, `tenant_facturacion_electronica`) — sirve de referencia de arquitectura (cola asíncrona, credenciales cifradas por tenant) |
| Cuentas por pagar reales | ❌ `proveedor_facturas` solo guarda el PDF/monto, sin vencimiento ni estado de pago |
| IVA descontable en compras | ❌ No existe |
| Plan de cuentas / partida doble / estados financieros | ❌ No existe y **no está en el alcance de este plan** (ver decisión de arriba) |

Esto significa que la parte más costosa de cualquier integración contable —el cálculo
correcto de IVA/impoconsumo por venta— **ya está resuelta**. El trabajo de este plan es
de mapeo y sincronización, no de cálculo tributario.

## Arquitectura (mismo patrón que Factus — no reinventar)

```
Venta/Compra/Gasto en GastroFlow (flujo actual intacto)
        │
        ▼
tabla de cola de sincronización contable
        │
        ▼
AdapterContable (Alegra | Siigo)  ──► API del proveedor
        │
        ▼
tenant_integracion_contable (estado, últimos errores, mapeo de cuentas)
```

- **Nueva tabla `tenant_integracion_contable`**: por tenant — proveedor elegido,
  credenciales cifradas (mismo mecanismo que ya se usa para Factus), ambiente, estado,
  y un **mapeo de cuentas/categorías** configurable (ej.: a qué cuenta/rubro de Alegra
  corresponde cada `caja_movimientos.categoria_gasto`) — es configuración, no código,
  porque cada restaurante puede querer mapear distinto.
- **Sincronización asíncrona por cola**, igual que el worker de Factus: nunca bloquea el
  POS/caja. Si el proveedor está caído o el token expiró, la venta se guarda igual y se
  reintenta.
- **Entidades a sincronizar (fase 1, alcance mínimo útil):**
  - `clientes` → contacto/tercero
  - `productos` → ítem (ya trae tributo/tasa)
  - `facturas` + `detalle_factura` → factura de venta (con IVA/impoconsumo ya desglosado)
  - `proveedores` + `proveedor_facturas` → factura de compra / gasto (obliga a agregarle
    a `proveedor_facturas` lo que hoy no tiene: fecha de vencimiento, estado de pago —
    útil de todas formas para cuentas por pagar internas)
  - `costos_fijos` → gasto recurrente
- **Fuera de alcance a propósito:** nómina, activos fijos, cierre de periodo, declaración
  de renta — eso lo sigue haciendo el contador dentro de Alegra/Siigo, GastroFlow solo le
  ahorra la digitación operativa.

## Fases estimadas

| Fase | Contenido | Estimado |
|------|-----------|----------|
| 0 · Preparación | Cuenta sandbox Alegra, probar a mano en Postman: crear contacto, ítem, factura de venta con impuesto, factura de compra | 2-3 días |
| 1 · Modelo de sincronización | Migración `tenant_integracion_contable` + tabla de cola/log de sync, cifrado de credenciales, UI de conexión en `/configuracion` (o tab del tenant en admin) | 1 semana |
| 2 · Adapter Alegra + ventas | `AlegraAdapter`: mapper factura interna → payload Alegra, worker de envío con reintentos, contactos/ítems sincronizados on-demand | 1.5-2 semanas |
| 3 · Compras y gastos | Mapear `proveedor_facturas` + `costos_fijos` a gastos/facturas de compra en Alegra; agregar vencimiento/estado de pago a `proveedor_facturas` | 1 semana |
| 4 · UI de estado y errores | Badge de sincronizado/pendiente/error en Ventas y Proveedores, botón reintentar, log visible | 3-5 días |
| 5 · Adapter Siigo | Mismo contrato de adapter, otro proveedor — reusa toda la arquitectura de fases 1-4 | 1.5-2 semanas |
| 6 · Piloto | Validar con un restaurante real que ya tenga cuenta Alegra, contra su contador | 1 semana |

**Total realista: ~6-8 semanas** para Alegra completo (ventas + compras/gastos);
+1.5-2 semanas más para sumar Siigo.

## Riesgos / puntos de atención

1. **Mapeo de impuestos**: Alegra/Siigo tienen sus propios catálogos de tarifas de IVA/
   impoconsumo — hay que homologar contra `productos.tributo`/`tasa_impuesto`, no asumir
   que los códigos coinciden 1:1.
2. **Ventas sin cliente (mostrador)**: igual que en Factus, mapear a "consumidor final"
   del proveedor contable.
3. **Rate limits y caídas del proveedor**: el diseño de cola con reintentos es
   obligatorio, no opcional — no se puede bloquear una venta porque Alegra esté lento.
4. **No asumir responsabilidad contable**: la UI debe dejar claro que esto es una
   sincronización de datos operativos, no una certificación de que la contabilidad está
   "correcta" — esa responsabilidad sigue siendo del contador del cliente.

## Referencias

- Alegra API: https://developer.alegra.com/
- Siigo API: https://developers.siigo.com/docs/siigoapi/
- Arquitectura de referencia (mismo patrón, ya en producción): `docs/facturacion-electronica/plan-integracion-factus.md`
