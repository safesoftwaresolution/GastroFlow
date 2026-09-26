/**
 * NumeracionRepository - Consecutivos internos por tenant (número de pedido del
 * día y número de factura). Único lugar donde se calculan: antes la misma
 * consulta estaba copiada en 5 archivos y solo POS la bloqueaba.
 *
 * Ambas funciones deben llamarse con la `connection` de la transacción que
 * luego inserta el registro, para que dos meseros (o dos cajas) que abren/cobran
 * al mismo tiempo no reciban el mismo número. En facturas, sin bloqueo el
 * segundo chocaba con la clave única (tenant_id, numero) y fallaba con error 500.
 *
 * Cómo se bloquea (probado contra MySQL con aperturas simultáneas):
 * 1. Primero la fila del tenant (FOR UPDATE): serializa a los consecutivos del
 *    mismo restaurante. Un `SELECT MAX(...) FOR UPDATE` solo -- lo que hacía POS --
 *    NO basta: si aún no hay filas en el rango, las dos transacciones toman un
 *    gap lock compatible entre sí y al insertar se bloquean mutuamente (deadlock).
 * 2. Luego el MAX con lectura bloqueante: en REPEATABLE READ una lectura normal
 *    usaría la foto de la transacción (tomada antes de esperar el lock) y
 *    devolvería el mismo número que el otro acaba de usar.
 */
const { SQL_COLOMBIA } = require('../../utils/dateHelpers');

async function bloquearTenant(connection, tenantId) {
    await connection.query('SELECT id FROM tenants WHERE id = ? FOR UPDATE', [tenantId]);
}

class NumeracionRepository {
    /**
     * Siguiente número de pedido del día (se reinicia a medianoche Colombia,
     * como un ticket de cocina). Usa idx_pedidos_tenant_created.
     */
    static async siguienteNumeroPedidoDelDia(connection, tenantId) {
        await bloquearTenant(connection, tenantId);
        const [rows] = await connection.query(
            `SELECT COALESCE(MAX(numero), 0) + 1 AS siguiente
             FROM pedidos
             WHERE tenant_id = ? AND created_at >= ${SQL_COLOMBIA.inicioHoyUtc}
             FOR UPDATE`,
            [tenantId]
        );
        return Number(rows?.[0]?.siguiente) || 1;
    }

    /** Siguiente número de factura del tenant (consecutivo, nunca se reinicia). */
    static async siguienteNumeroFactura(connection, tenantId) {
        await bloquearTenant(connection, tenantId);
        const [rows] = await connection.query(
            'SELECT COALESCE(MAX(numero), 0) + 1 AS siguiente FROM facturas WHERE tenant_id = ? FOR UPDATE',
            [tenantId]
        );
        return Number(rows?.[0]?.siguiente) || 1;
    }
}

module.exports = NumeracionRepository;
