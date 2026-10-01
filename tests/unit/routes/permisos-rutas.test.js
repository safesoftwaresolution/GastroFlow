/**
 * Guardas de permisos en rutas sensibles. Inspecciona la pila de cada router (sin levantar el
 * servidor ni la BD): una ruta protegida tiene al menos un middleware antes del controlador, así
 * que si alguien la deja "desnuda" (solo el controlador) esta prueba falla.
 */

jest.mock('../../../config/database', () => ({ query: jest.fn(), getConnection: jest.fn() }));

const facturasRouter = require('../../../routes/tenant/facturas');
const cocinaRouter = require('../../../routes/tenant/cocina');
const configuracionRouter = require('../../../routes/tenant/configuracion');
const ventasRouter = require('../../../routes/tenant/ventas');

function handlersDe(router, metodo, ruta) {
    const layer = router.stack.find(l => l.route && l.route.path === ruta && l.route.methods[metodo]);
    if (!layer) {
        throw new Error(`No existe la ruta ${metodo.toUpperCase()} ${ruta}`);
    }
    return layer.route.stack.length;
}

describe('rutas sensibles llevan un middleware de permiso antes del controlador', () => {
    const casos = [
        [facturasRouter, 'get', '/facturar'],
        [facturasRouter, 'post', '/'],
        [facturasRouter, 'get', '/:id/imprimir'],
        [facturasRouter, 'get', '/:id/imprimir-json'],
        [facturasRouter, 'get', '/:id/detalles'],
        [facturasRouter, 'post', '/:id/facturacion-electronica/reintentar'],
        [cocinaRouter, 'put', '/item/:id/estado'],
        [cocinaRouter, 'put', '/preparar-lote'],
        [cocinaRouter, 'put', '/pedidos/:pedidoId/completar'],
        [cocinaRouter, 'put', '/pedidos/:pedidoId/cancelar'],
        [configuracionRouter, 'get', '/'],
        [configuracionRouter, 'post', '/'],
        [configuracionRouter, 'get', '/impresoras'],
        [configuracionRouter, 'get', '/preview'],
        [ventasRouter, 'get', '/']
    ];

    it.each(casos)('%#: %s %s', (router, metodo, ruta) => {
        expect(handlersDe(router, metodo, ruta)).toBeGreaterThanOrEqual(2);
    });
});
