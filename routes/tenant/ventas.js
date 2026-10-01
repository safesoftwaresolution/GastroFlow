const express = require('express');
const router = express.Router();
const VentasController = require('../../app/Http/Controllers/Tenant/VentasController');
const { requirePermission } = require('../../middleware/auth');
const { requirePlanFeature } = require('../../middleware/planFeature');

// GET /ventas - Listado con filtros
// ventas.ver; eventos.ver / ventas_evento.realizar también, porque el listado de eventos enlaza a /ventas?evento_id=
router.get(
    '/',
    requirePermission('ventas.ver', 'ventas.exportar', 'eventos.ver', 'ventas_evento.realizar'),
    VentasController.index
);

// GET /ventas/export - Exportar Excel
router.get('/export', requirePermission('plantillas.ver'), requirePlanFeature('plantillas'), VentasController.export);

module.exports = router;
