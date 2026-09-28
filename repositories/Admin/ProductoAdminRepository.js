/**
 * ProductoAdminRepository - Consultas de productos SIN filtro por tenant, para
 * el módulo de superadmin /admin/productos (ver todo el catálogo, de todos
 * los restaurantes, activos e inactivos).
 */

const db = require('../../config/database');

const PAGE_SIZE = 30;

function construirFiltros({ tenantId, estado, q }) {
    const where = [];
    const params = [];

    if (tenantId) {
        where.push('p.tenant_id = ?');
        params.push(tenantId);
    }
    if (estado === 'activo') {
        where.push('p.activo = 1');
    } else if (estado === 'inactivo') {
        where.push('p.activo = 0');
    }
    if (q) {
        where.push('(p.nombre LIKE ? OR p.codigo LIKE ?)');
        params.push(`%${q}%`, `%${q}%`);
    }

    return { whereSql: where.length > 0 ? `WHERE ${where.join(' AND ')}` : '', params };
}

class ProductoAdminRepository {
    static async findAll(filtros, page = 1) {
        const { whereSql, params } = construirFiltros(filtros);
        const offset = (Math.max(page, 1) - 1) * PAGE_SIZE;

        const [rows] = await db.query(
            `SELECT p.id, p.nombre, p.codigo, p.precio_unidad, p.activo, p.created_at, p.updated_at,
                    t.id AS tenant_id, t.nombre AS tenant_nombre,
                    c.nombre AS categoria_nombre
             FROM productos p
             JOIN tenants t ON t.id = p.tenant_id
             LEFT JOIN categorias c ON c.id = p.categoria_id
             ${whereSql}
             ORDER BY p.updated_at DESC
             LIMIT ? OFFSET ?`,
            [...params, PAGE_SIZE, offset]
        );
        return rows;
    }

    static async count(filtros) {
        const { whereSql, params } = construirFiltros(filtros);
        const [[row]] = await db.query(`SELECT COUNT(*) AS total FROM productos p ${whereSql}`, params);
        return row.total;
    }

    /** Detalle completo de un producto, sin importar el tenant (uso exclusivo de superadmin). */
    static async findById(id) {
        const [[row]] = await db.query(
            `SELECT p.*, t.nombre AS tenant_nombre, t.id AS tenant_id, c.nombre AS categoria_nombre
             FROM productos p
             JOIN tenants t ON t.id = p.tenant_id
             LEFT JOIN categorias c ON c.id = p.categoria_id
             WHERE p.id = ?`,
            [id]
        );
        return row || null;
    }

    static get PAGE_SIZE() {
        return PAGE_SIZE;
    }
}

module.exports = ProductoAdminRepository;
