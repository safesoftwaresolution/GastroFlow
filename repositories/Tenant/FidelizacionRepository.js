/**
 * FidelizacionRepository - Acceso a datos del programa de sellos, las tarjetas de los
 * clientes y su historial de movimientos. Todo va acotado por tenant_id.
 * Los métodos aceptan una `connection` opcional para participar en una transacción.
 */
const db = require('../../config/database');

const ejecutar = (connection, sql, params) => (connection || db).query(sql, params);

class FidelizacionRepository {
    // ---- Programa ----------------------------------------------------------

    static async obtenerPrograma(tenantId, connection) {
        const [rows] = await ejecutar(connection, 'SELECT * FROM fidelizacion_programas WHERE tenant_id = ?', [
            tenantId
        ]);
        return rows[0] || null;
    }

    static async guardarPrograma(tenantId, { nombre, sellosRequeridos, montoMinimo, premio, activo }) {
        await db.query(
            `INSERT INTO fidelizacion_programas (tenant_id, nombre, sellos_requeridos, monto_minimo, premio, activo)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), sellos_requeridos = VALUES(sellos_requeridos),
                monto_minimo = VALUES(monto_minimo), premio = VALUES(premio), activo = VALUES(activo)`,
            [tenantId, nombre, sellosRequeridos, montoMinimo, premio, activo ? 1 : 0]
        );
        return FidelizacionRepository.obtenerPrograma(tenantId);
    }

    // ---- Tarjetas ----------------------------------------------------------

    static async crearTarjeta({ tenantId, clienteId, numero, tokenPublico }) {
        const [r] = await db.query(
            `INSERT INTO fidelizacion_tarjetas (tenant_id, cliente_id, numero, token_publico) VALUES (?, ?, ?, ?)`,
            [tenantId, clienteId, numero, tokenPublico]
        );
        return r.insertId;
    }

    static async obtenerTarjetaPorId(tenantId, id, connection, bloquear = false) {
        const [rows] = await ejecutar(
            connection,
            `SELECT t.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono
             FROM fidelizacion_tarjetas t JOIN clientes c ON c.id = t.cliente_id
             WHERE t.tenant_id = ? AND t.id = ? ${bloquear ? 'FOR UPDATE' : ''}`,
            [tenantId, id]
        );
        return rows[0] || null;
    }

    static async obtenerTarjetaPorCliente(tenantId, clienteId, connection, bloquear = false) {
        const [rows] = await ejecutar(
            connection,
            `SELECT t.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono
             FROM fidelizacion_tarjetas t JOIN clientes c ON c.id = t.cliente_id
             WHERE t.tenant_id = ? AND t.cliente_id = ? ${bloquear ? 'FOR UPDATE' : ''}`,
            [tenantId, clienteId]
        );
        return rows[0] || null;
    }

    static async obtenerTarjetaPorToken(token) {
        const [rows] = await db.query(
            `SELECT t.*, c.nombre AS cliente_nombre
             FROM fidelizacion_tarjetas t JOIN clientes c ON c.id = t.cliente_id
             WHERE t.token_publico = ? AND t.estado = 'activa'`,
            [token]
        );
        return rows[0] || null;
    }

    static async listarTarjetas(tenantId, { q } = {}) {
        const params = [tenantId];
        let filtro = '';
        if (q) {
            filtro = 'AND (c.nombre LIKE ? OR c.telefono LIKE ? OR t.numero LIKE ?)';
            const like = `%${q}%`;
            params.push(like, like, like);
        }
        const [rows] = await db.query(
            `SELECT t.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono
             FROM fidelizacion_tarjetas t JOIN clientes c ON c.id = t.cliente_id
             WHERE t.tenant_id = ? ${filtro}
             ORDER BY t.updated_at DESC LIMIT 200`,
            params
        );
        return rows;
    }

    static async actualizarContadores(
        connection,
        tarjetaId,
        { sellos, sellosHistoricos, premiosDisponibles, premiosCanjeados }
    ) {
        await ejecutar(
            connection,
            `UPDATE fidelizacion_tarjetas
             SET sellos = ?, sellos_historicos = ?, premios_disponibles = ?, premios_canjeados = ?
             WHERE id = ?`,
            [sellos, sellosHistoricos, premiosDisponibles, premiosCanjeados, tarjetaId]
        );
    }

    static async marcarSincronizada(tarjetaId) {
        await db.query('UPDATE fidelizacion_tarjetas SET wallet_sincronizada_at = NOW() WHERE id = ?', [tarjetaId]);
    }

    // ---- Movimientos ---------------------------------------------------------

    /** Devuelve true si insertó; false si ya existía (misma factura ya sellada). */
    static async registrarMovimiento(
        connection,
        { tenantId, tarjetaId, tipo, cantidad = 1, facturaId = null, usuarioId = null }
    ) {
        try {
            await ejecutar(
                connection,
                `INSERT INTO fidelizacion_movimientos (tenant_id, tarjeta_id, tipo, cantidad, factura_id, usuario_id)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [tenantId, tarjetaId, tipo, cantidad, facturaId, usuarioId]
            );
            return true;
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                return false;
            }
            throw error;
        }
    }

    static async listarMovimientos(tenantId, tarjetaId, limite = 50) {
        const [rows] = await db.query(
            `SELECT id, tipo, cantidad, factura_id, usuario_id, created_at
             FROM fidelizacion_movimientos WHERE tenant_id = ? AND tarjeta_id = ?
             ORDER BY id DESC LIMIT ?`,
            [tenantId, tarjetaId, limite]
        );
        return rows;
    }
}

module.exports = FidelizacionRepository;
