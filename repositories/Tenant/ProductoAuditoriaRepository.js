/**
 * ProductoAuditoriaRepository - Registro inmutable de creación/edición/baja de
 * productos (ver migración 108). Un evento por fila, nunca se actualiza ni se borra.
 */

const db = require('../../config/database');

class ProductoAuditoriaRepository {
    static async registrar(tenantId, productoId, accion, usuarioId, cambios) {
        await db.query(
            `INSERT INTO producto_auditoria (tenant_id, producto_id, accion, usuario_id, cambios)
             VALUES (?, ?, ?, ?, ?)`,
            [tenantId, productoId, accion, usuarioId || null, cambios ? JSON.stringify(cambios) : null]
        );
    }

    /** Historial de un producto, más reciente primero, con el nombre de quién hizo el cambio. */
    static async findByProducto(productoId) {
        const [rows] = await db.query(
            `SELECT pa.id, pa.accion, pa.cambios, pa.created_at, u.nombre_completo AS usuario_nombre
             FROM producto_auditoria pa
             LEFT JOIN usuarios u ON u.id = pa.usuario_id
             WHERE pa.producto_id = ?
             ORDER BY pa.created_at DESC`,
            [productoId]
        );
        return rows.map(r => ({ ...r, cambios: typeof r.cambios === 'string' ? JSON.parse(r.cambios) : r.cambios }));
    }
}

module.exports = ProductoAuditoriaRepository;
