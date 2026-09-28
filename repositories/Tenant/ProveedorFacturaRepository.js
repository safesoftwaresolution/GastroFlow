const db = require('../../config/database');

class ProveedorFacturaRepository {
    /**
     * Listar facturas de un proveedor (sin el contenido del archivo por rendimiento)
     */
    static async findAllByProveedor(tenantId, proveedorId) {
        const sql = `SELECT id, tenant_id, proveedor_id, numero_factura, fecha_emision, fecha_vencimiento,
                           monto_total, estado, fecha_pago, archivo_nombre, archivo_tipo, archivo_size, notas, created_at
                    FROM proveedor_facturas
                    WHERE tenant_id = ? AND proveedor_id = ?
                    ORDER BY created_at DESC`;
        const [rows] = await db.query(sql, [tenantId, proveedorId]);
        return rows;
    }

    /**
     * Obtener una factura específica con su contenido (para descarga/visualización)
     */
    static async findById(id, tenantId) {
        const sql = `SELECT * FROM proveedor_facturas WHERE id = ? AND tenant_id = ?`;
        const [rows] = await db.query(sql, [id, tenantId]);
        return rows[0] || null;
    }

    static async create(tenantId, data) {
        const {
            proveedor_id,
            numero_factura,
            fecha_emision,
            fecha_vencimiento,
            monto_total,
            archivo_nombre,
            archivo_contenido,
            archivo_tipo,
            archivo_size,
            notas
        } = data;

        const sql = `INSERT INTO proveedor_facturas
                    (tenant_id, proveedor_id, numero_factura, fecha_emision, fecha_vencimiento, monto_total,
                     archivo_nombre, archivo_contenido, archivo_tipo, archivo_size, notas)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const [result] = await db.query(sql, [
            tenantId,
            proveedor_id,
            numero_factura || null,
            fecha_emision || null,
            fecha_vencimiento || null,
            Number.parseFloat(monto_total) || 0,
            archivo_nombre,
            archivo_contenido,
            archivo_tipo,
            archivo_size,
            notas || null
        ]);

        return result.insertId;
    }

    static async marcarComoPagada(id, tenantId) {
        const sql = `UPDATE proveedor_facturas SET estado = 'pagada', fecha_pago = CURDATE()
                    WHERE id = ? AND tenant_id = ? AND estado = 'pendiente'`;
        const [result] = await db.query(sql, [id, tenantId]);
        return result.affectedRows > 0;
    }

    /** Facturas pendientes de pago de todo el tenant, para el panel de Finanzas. */
    static async findPendientes(tenantId) {
        const sql = `SELECT pf.id, pf.numero_factura, pf.fecha_vencimiento, pf.monto_total, pf.proveedor_id,
                           p.nombre AS proveedor_nombre
                    FROM proveedor_facturas pf
                    JOIN proveedores p ON p.id = pf.proveedor_id
                    WHERE pf.tenant_id = ? AND pf.estado = 'pendiente'
                    ORDER BY (pf.fecha_vencimiento IS NULL), pf.fecha_vencimiento ASC`;
        const [rows] = await db.query(sql, [tenantId]);
        return rows;
    }

    /** Suma de facturas de proveedor emitidas dentro de un rango de días (fecha_emision), para Finanzas. */
    static async sumaPorPeriodo(tenantId, desdeDia, hastaDia) {
        const sql = `SELECT COALESCE(SUM(monto_total), 0) AS total
                    FROM proveedor_facturas
                    WHERE tenant_id = ? AND fecha_emision BETWEEN ? AND ?`;
        const [[row]] = await db.query(sql, [tenantId, desdeDia, hastaDia]);
        return Number.parseFloat(row.total) || 0;
    }

    static async delete(id, tenantId) {
        const sql = `DELETE FROM proveedor_facturas WHERE id = ? AND tenant_id = ?`;
        const [result] = await db.query(sql, [id, tenantId]);
        return result;
    }
}

module.exports = ProveedorFacturaRepository;
