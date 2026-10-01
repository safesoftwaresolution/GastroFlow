const express = require('express');
const router = express.Router();
const CocinaController = require('../../app/Http/Controllers/Tenant/CocinaController');
const { requirePermission } = require('../../middleware/auth');

// GET /cocina - Cola cocina vista
router.get('/', CocinaController.index);

// GET /cocina/kds - ruta antigua; el KDS por estación ahora vive como toggle en /cocina
router.get('/kds', CocinaController.redirectKds);

// API Cola
router.get('/cola', CocinaController.getQueue);

// Cambiar estados de la cola: cocina.gestionar (cocina.ver solo permite mirar la cola).
// Los dos montajes (/cocina y /api/cocina) exigen cocina.ver antes de llegar aquí.

// API Estado item
router.put('/item/:id/estado', requirePermission('cocina.gestionar'), CocinaController.updateItemEstado);

// API Lote
router.put('/preparar-lote', requirePermission('cocina.gestionar'), CocinaController.updateGroupEstado);

// API Completar pedido de mostrador (POS)
router.put('/pedidos/:pedidoId/completar', requirePermission('cocina.gestionar'), CocinaController.completarPedidoPOS);

// API Cancelar pedido de mostrador (POS)
router.put('/pedidos/:pedidoId/cancelar', requirePermission('cocina.gestionar'), CocinaController.cancelarPedidoPOS);

module.exports = router;
