const db = require('../../../config/database');
const RealtimeEvents = require('../../Shared/RealtimeEvents');

class LimpiarPedidoService {
    /**
     * @description Elimina todos los items de un pedido y resetea su total a 0
     */
    static async execute({ tenantId, pedidoId }) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Verificar existencia y pertenencia
            const [pedidos] = await connection.query(
                'SELECT id, mesa_id FROM pedidos WHERE id = ? AND tenant_id = ? FOR UPDATE',
                [pedidoId, tenantId]
            );
            if (pedidos.length === 0) {
                throw new Error('Pedido no encontrado');
            }

            const mesaId = pedidos[0].mesa_id;

            // 2. Eliminar items (vaciado total)
            await connection.query('DELETE FROM pedido_items WHERE pedido_id = ? AND tenant_id = ?', [
                pedidoId,
                tenantId
            ]);

            // 3. Cancelar el pedido (para que no aparezca como abierto)
            await connection.query("UPDATE pedidos SET estado = 'cancelado', total = 0, propina = 0 WHERE id = ?", [
                pedidoId
            ]);

            // 4. Liberar la mesa (ahora que no tiene items activos ni pedidos abiertos)
            await connection.query("UPDATE mesas SET estado = 'libre' WHERE id = ?", [mesaId]);

            await connection.commit();

            // Emitir evento SSE para notificar en tiempo real que se limpió/canceló el pedido
            RealtimeEvents.emitPedido({
                tenantId,
                pedidoId,
                mesaId,
                action: 'cancelled'
            });

            return { message: 'Pedido limpiado y mesa liberada correctamente', mesaId };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = LimpiarPedidoService;
