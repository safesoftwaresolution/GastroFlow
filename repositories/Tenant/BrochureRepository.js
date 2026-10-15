/**
 * BrochureRepository - Páginas del brochure/carta (imagen o PDF) por tenant.
 */
const db = require('../../config/database');

class BrochureRepository {
    static async listar(tenantId) {
        const [rows] = await db.query(
            'SELECT id, url, tipo, nombre, orden FROM brochure_paginas WHERE tenant_id = ? ORDER BY orden, id',
            [tenantId]
        );
        return rows;
    }

    static async contar(tenantId) {
        const [[row]] = await db.query('SELECT COUNT(*) AS total FROM brochure_paginas WHERE tenant_id = ?', [
            tenantId
        ]);
        return Number(row.total);
    }

    static async siguienteOrden(tenantId) {
        const [[row]] = await db.query(
            'SELECT COALESCE(MAX(orden), 0) + 1 AS siguiente FROM brochure_paginas WHERE tenant_id = ?',
            [tenantId]
        );
        return Number(row.siguiente);
    }

    static async crear(tenantId, { url, tipo, nombre, orden }) {
        const [result] = await db.query(
            'INSERT INTO brochure_paginas (tenant_id, url, tipo, nombre, orden) VALUES (?, ?, ?, ?, ?)',
            [tenantId, url, tipo, nombre, orden]
        );
        return result.insertId;
    }

    static async findById(id, tenantId) {
        const [rows] = await db.query('SELECT * FROM brochure_paginas WHERE id = ? AND tenant_id = ?', [id, tenantId]);
        return rows[0] || null;
    }

    static async eliminar(id, tenantId) {
        await db.query('DELETE FROM brochure_paginas WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    }

    static async actualizarOrden(tenantId, ids) {
        for (let i = 0; i < ids.length; i++) {
            await db.query('UPDATE brochure_paginas SET orden = ? WHERE id = ? AND tenant_id = ?', [
                i + 1,
                ids[i],
                tenantId
            ]);
        }
    }
}

module.exports = BrochureRepository;
