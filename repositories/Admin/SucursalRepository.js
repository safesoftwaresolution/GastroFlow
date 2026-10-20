/**
 * SucursalRepository - sucursales = tenants con tenant_padre_id.
 * Related to: services/Shared/SucursalService.js
 */

const db = require('../../config/database');

class SucursalRepository {
    static async obtenerTenant(id) {
        const [rows] = await db.query(
            'SELECT id, nombre, slug, activo, plan_id, tenant_padre_id, max_sucursales FROM tenants WHERE id = ?',
            [id]
        );
        return rows[0] || null;
    }

    static async slugExiste(slug) {
        const [rows] = await db.query('SELECT id FROM tenants WHERE slug = ?', [slug]);
        return rows.length > 0;
    }

    static async usernameExiste(username) {
        const [rows] = await db.query('SELECT id FROM usuarios WHERE username = ?', [username]);
        return rows.length > 0;
    }

    static async contarPorPadre(padreId) {
        const [[row]] = await db.query('SELECT COUNT(*) AS c FROM tenants WHERE tenant_padre_id = ?', [padreId]);
        return Number(row.c) || 0;
    }

    static async listarPorPadre(padreId) {
        const [rows] = await db.query(
            `SELECT t.id, t.nombre, t.slug, t.ciudad, t.direccion, t.telefono, t.activo,
                    t.suspendido_por_pago, t.created_at,
                    (SELECT u.username FROM usuarios u
                       WHERE u.tenant_id = t.id AND u.rol_id = (SELECT id FROM roles WHERE nombre = 'admin')
                       ORDER BY u.id LIMIT 1) AS admin_username
             FROM tenants t
             WHERE t.tenant_padre_id = ?
             ORDER BY t.created_at DESC`,
            [padreId]
        );
        return rows;
    }

    static async listarTodas() {
        const [rows] = await db.query(
            `SELECT t.id, t.nombre, t.slug, t.ciudad, t.activo, t.suspendido_por_pago, t.created_at,
                    t.tenant_padre_id, p.nombre AS padre_nombre, pl.nombre AS plan_nombre
             FROM tenants t
             INNER JOIN tenants p ON p.id = t.tenant_padre_id
             LEFT JOIN planes pl ON pl.id = t.plan_id
             ORDER BY p.nombre, t.created_at DESC`
        );
        return rows;
    }

    /** Tenants que no son sucursal, con su limite y cuantas sucursales llevan. */
    static async listarPadres() {
        const [rows] = await db.query(
            `SELECT t.id, t.nombre, t.max_sucursales, t.activo,
                    (SELECT COUNT(*) FROM tenants h WHERE h.tenant_padre_id = t.id) AS sucursales
             FROM tenants t
             WHERE t.tenant_padre_id IS NULL
             ORDER BY t.nombre`
        );
        return rows;
    }

    static async fijarLimite(id, max) {
        const [result] = await db.query(
            'UPDATE tenants SET max_sucursales = ? WHERE id = ? AND tenant_padre_id IS NULL',
            [max, id]
        );
        return result.affectedRows;
    }

    /**
     * Crea el tenant hijo y su usuario admin en una sola transaccion.
     * Con `limite` (tenant creando su propia sucursal) vuelve a leer el tope con la fila del
     * padre bloqueada, para que dos peticiones simultaneas no superen max_sucursales.
     * @returns {Promise<{tenantId:number, usuarioId:number}>}
     */
    static async crearConAdmin({ padreId, aplicarLimite, sucursal, admin }) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [[padre]] = await connection.query(
                'SELECT id, max_sucursales, tenant_padre_id FROM tenants WHERE id = ? FOR UPDATE',
                [padreId]
            );
            if (!padre || padre.tenant_padre_id !== null) {
                throw Object.assign(new Error('El restaurante no puede tener sucursales'), { status: 403 });
            }
            if (aplicarLimite) {
                const [[cuenta]] = await connection.query(
                    'SELECT COUNT(*) AS c FROM tenants WHERE tenant_padre_id = ?',
                    [padreId]
                );
                if (Number(cuenta.c) >= Number(padre.max_sucursales)) {
                    throw Object.assign(new Error('Alcanzaste el máximo de sucursales de tu plan'), { status: 403 });
                }
            }

            const [rolRows] = await connection.query("SELECT id FROM roles WHERE nombre = 'admin'");
            if (!rolRows.length) {
                throw new Error('No existe el rol admin');
            }
            const rolAdminId = rolRows[0].id;

            const [tenantRes] = await connection.query(
                `INSERT INTO tenants (nombre, email, slug, config, activo, plan_id, direccion, telefono, ciudad,
                                      regimen_fiscal, tenant_padre_id, creado_por_usuario_id)
                 VALUES (?, ?, ?, '{}', 1, ?, ?, ?, ?, 'No responsable de IVA', ?, ?)`,
                [
                    sucursal.nombre,
                    admin.email,
                    sucursal.slug,
                    sucursal.plan_id,
                    sucursal.direccion,
                    sucursal.telefono,
                    sucursal.ciudad,
                    padreId,
                    sucursal.creado_por_usuario_id
                ]
            );
            const tenantId = tenantRes.insertId;

            const [userRes] = await connection.query(
                `INSERT INTO usuarios (username, password_hash, email, nombre_completo, rol_id, tenant_id, activo)
                 VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
                [admin.username, admin.passwordHash, admin.email, admin.nombre_completo, rolAdminId, tenantId]
            );
            await connection.query('INSERT INTO usuario_roles (user_id, rol_id) VALUES (?, ?)', [
                userRes.insertId,
                rolAdminId
            ]);

            await connection.commit();
            return { tenantId, usuarioId: userRes.insertId };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = SucursalRepository;
