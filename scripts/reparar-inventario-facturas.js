/**
 * Reparación puntual (incidente 2026-09-26/27): entre el deploy de e889e4c y el
 * hotfix edbfd52, facturar en Mesas un producto con receta no descontaba el
 * inventario (lock wait timeout; ver commit edbfd52). En esas facturas el stock
 * NO se tocó: registrarSalida inserta el movimiento y actualiza el stock en su
 * propia transacción y la revierte si falla.
 *
 * Este script busca facturas del rango que tengan productos con receta y que no
 * tengan ningún movimiento de inventario 'factura_<id>', y aplica el descuento
 * que faltó (mismo InventarioService.descontarPorReceta que usa la venta).
 * Es idempotente: una factura que ya tiene movimientos se salta.
 *
 * Uso (por defecto solo muestra, no cambia nada):
 *   node scripts/reparar-inventario-facturas.js --desde "2026-09-26 23:00:00"
 *   node scripts/reparar-inventario-facturas.js --desde "2026-09-26 23:00:00" --aplicar
 * --desde / --hasta en hora UTC ('YYYY-MM-DD HH:mm:ss'); --hasta por defecto: ahora.
 */
require('dotenv').config();
const db = require('../config/database');
const InventarioService = require('../services/Tenant/InventarioService');

function arg(nombre) {
    const i = process.argv.indexOf(nombre);
    return i > -1 ? process.argv[i + 1] : null;
}

async function main() {
    const desde = arg('--desde');
    const hasta = arg('--hasta') || new Date().toISOString().slice(0, 19).replace('T', ' ');
    const aplicar = process.argv.includes('--aplicar');
    if (!desde) {
        console.error('Falta --desde "YYYY-MM-DD HH:mm:ss" (UTC)');
        process.exit(1);
    }

    const [facturas] = await db.query(
        `SELECT f.id, f.tenant_id, f.numero, f.fecha
         FROM facturas f
         WHERE f.fecha BETWEEN ? AND ?
           AND EXISTS (
             SELECT 1 FROM detalle_factura df
             JOIN recetas r ON r.producto_id = df.producto_id AND r.tenant_id = f.tenant_id
             WHERE df.factura_id = f.id AND (df.es_servicio = 0 OR df.es_servicio IS NULL)
           )
           AND NOT EXISTS (
             SELECT 1 FROM movimientos_inventario m
             WHERE m.tenant_id = f.tenant_id AND m.referencia = CONCAT('factura_', f.id)
           )
         ORDER BY f.fecha`,
        [desde, hasta]
    );

    console.log(`${facturas.length} facturas sin descuento de inventario entre ${desde} y ${hasta} (UTC).`);
    console.log(aplicar ? 'Modo: APLICAR' : 'Modo: solo mostrar (agrega --aplicar para descontar)');

    let reparadas = 0;
    for (const f of facturas) {
        const [lineas] = await db.query(
            `SELECT producto_id, cantidad FROM detalle_factura
             WHERE factura_id = ? AND producto_id IS NOT NULL AND (es_servicio = 0 OR es_servicio IS NULL)`,
            [f.id]
        );
        console.log(
            `  tenant ${f.tenant_id} · factura #${f.numero} (id ${f.id}) · ${f.fecha} · ${lineas.length} líneas`
        );
        if (!aplicar) {
            continue;
        }
        for (const l of lineas) {
            await InventarioService.descontarPorReceta(f.tenant_id, l.producto_id, l.cantidad, 'factura_' + f.id);
        }
        reparadas++;
    }
    if (aplicar) {
        console.log(`Listo: ${reparadas} facturas reparadas.`);
    }
    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
