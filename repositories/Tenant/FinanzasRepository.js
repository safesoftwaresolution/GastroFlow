/**
 * FinanzasRepository - Gestión de movimientos de caja, gastos e ingresos.
 */

const db = require('../../config/database');
const { SQL_COLOMBIA } = require('../../utils/dateHelpers');

class FinanzasRepository {
    /**
     * Registra un movimiento de dinero (Entrada/Salida)
     */
    static async createMovimiento(tenantId, data) {
        const { sesion_id, usuario_id, tipo, monto, motivo, categoria_gasto, referencia_tipo, referencia_id } = data;

        const [result] = await db.query(
            `INSERT INTO caja_movimientos 
            (tenant_id, sesion_id, usuario_id, tipo, monto, motivo, categoria_gasto, referencia_tipo, referencia_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                tenantId,
                sesion_id || null,
                usuario_id,
                tipo,
                monto,
                motivo,
                categoria_gasto || 'General',
                referencia_tipo || 'manual',
                referencia_id || null
            ]
        );
        return result.insertId;
    }

    /**
     * Obtiene el resumen de ingresos y egresos por periodo
     */
    static async getResumenPeriodo(tenantId, fechaInicio, fechaFin) {
        const [rows] = await db.query(
            `SELECT 
                tipo,
                SUM(monto) as total,
                COUNT(*) as cantidad
            FROM caja_movimientos
            WHERE tenant_id = ? AND created_at BETWEEN ? AND ?
            GROUP BY tipo`,
            [tenantId, fechaInicio, fechaFin]
        );
        return rows;
    }

    /**
     * Obtiene ingresos/egresos agrupados por categoría
     */
    static async getPorCategoria(tenantId, tipo, fechaInicio, fechaFin) {
        const [rows] = await db.query(
            `SELECT 
                categoria_gasto,
                SUM(monto) as total
            FROM caja_movimientos
            WHERE tenant_id = ? AND tipo = ? AND created_at BETWEEN ? AND ?
            GROUP BY categoria_gasto
            ORDER BY total DESC`,
            [tenantId, tipo, fechaInicio, fechaFin]
        );
        return rows;
    }

    /**
     * Obtiene el histórico diario de ingresos y egresos
     */
    static async getHistoricoDiario(tenantId, fechaInicio, fechaFin) {
        const [rows] = await db.query(
            `SELECT
                ${SQL_COLOMBIA.dia('created_at')} as fecha,
                SUM(CASE WHEN tipo = 'entrada' THEN monto ELSE 0 END) as ingresos,
                SUM(CASE WHEN tipo = 'salida' THEN monto ELSE 0 END) as egresos
            FROM caja_movimientos
            WHERE tenant_id = ? AND created_at BETWEEN ? AND ?
            GROUP BY fecha
            ORDER BY fecha ASC`,
            [tenantId, fechaInicio, fechaFin]
        );
        return rows;
    }

    /** Suma de costos fijos mensuales activos (arriendo, servicios, nómina...), sin prorratear. */
    static async getCostosFijosActivosMensual(tenantId) {
        const [[row]] = await db.query(
            `SELECT COALESCE(SUM(monto_mensual), 0) AS total FROM costos_fijos WHERE tenant_id = ? AND activo = 1`,
            [tenantId]
        );
        return Number.parseFloat(row.total) || 0;
    }

    /**
     * Ingresos por forma de pago dentro del periodo, a partir de `facturas`
     * (no de caja_movimientos: ahí es donde vive el desglose efectivo/transferencia/bono).
     * Excluye sub-facturas de eventos (evento_id) igual que el resto del sistema, para no duplicar.
     */
    static async getDesglosePorFormaPago(tenantId, utcDesde, utcHasta) {
        const [[row]] = await db.query(
            `SELECT
                COALESCE(SUM(monto_efectivo), 0) AS efectivo,
                COALESCE(SUM(monto_transferencia), 0) AS transferencia,
                COALESCE(SUM(monto_bono), 0) AS bono
            FROM facturas
            WHERE tenant_id = ? AND evento_id IS NULL AND fecha >= ? AND fecha < ?`,
            [tenantId, utcDesde, utcHasta]
        );
        return {
            efectivo: Number.parseFloat(row.efectivo) || 0,
            transferencia: Number.parseFloat(row.transferencia) || 0,
            bono: Number.parseFloat(row.bono) || 0
        };
    }
}

module.exports = FinanzasRepository;
