/**
 * TenantOwnership - Verifica que los ids de registros relacionados que llegan del cliente
 * (cliente_id, producto_id, servicio_id, evento_id, insumo_id) pertenezcan al tenant autenticado.
 *
 * Las FK de la BD son solo por id (sin tenant_id), así que nada impide guardar un id de otro
 * tenant: sin esta validación, un id ajeno queda referenciado y luego se lee con un JOIN por id
 * (fuga de nombre/teléfono del cliente, costos de insumos, etc.). Úsalo antes de INSERT/UPDATE
 * con ids que vengan de req.body.
 */

const db = require('../../config/database');

// Lista fija: el nombre de tabla se interpola en el SQL y nunca viene de input del cliente.
const TABLAS = {
    clientes: 'Cliente',
    productos: 'Producto',
    servicios: 'Servicio',
    eventos: 'Evento',
    insumos: 'Insumo'
};

/**
 * @param {string} tabla - clave de TABLAS
 * @param {number} tenantId
 * @param {number|Array<number>|null|undefined} ids - null/undefined/'' se ignoran (campos opcionales)
 */
async function asegurar(tabla, tenantId, ids) {
    const etiqueta = TABLAS[tabla];
    const lista = (Array.isArray(ids) ? ids : [ids]).filter(id => id !== null && id !== undefined && id !== '');
    if (lista.length === 0) {
        return;
    }
    const unicos = [...new Set(lista.map(Number))];
    if (unicos.some(n => !Number.isInteger(n) || n <= 0)) {
        throw new Error(`${etiqueta} inválido`);
    }
    const [rows] = await db.query(`SELECT id FROM ${tabla} WHERE tenant_id = ? AND id IN (?)`, [tenantId, unicos]);
    if (rows.length !== unicos.length) {
        throw new Error(`${etiqueta} no encontrado`);
    }
}

module.exports = {
    clientes: (tenantId, ids) => asegurar('clientes', tenantId, ids),
    productos: (tenantId, ids) => asegurar('productos', tenantId, ids),
    servicios: (tenantId, ids) => asegurar('servicios', tenantId, ids),
    eventos: (tenantId, ids) => asegurar('eventos', tenantId, ids),
    insumos: (tenantId, ids) => asegurar('insumos', tenantId, ids)
};
