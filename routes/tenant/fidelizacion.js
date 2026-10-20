const express = require('express');
const router = express.Router();
const FidelizacionController = require('../../app/Http/Controllers/Tenant/FidelizacionController');
const { requirePermission } = require('../../middleware/auth');

// Rutas base: /api/fidelizacion
router.get('/programa', requirePermission('fidelizacion.ver'), FidelizacionController.programa);
router.put('/programa', requirePermission('fidelizacion.gestionar'), FidelizacionController.guardarPrograma);

router.get('/tarjetas', requirePermission('fidelizacion.ver'), FidelizacionController.listar);
router.post('/tarjetas', requirePermission('fidelizacion.gestionar'), FidelizacionController.inscribir);
// Antes de /:id para que "cliente" no se tome como id
router.get('/tarjetas/cliente/:clienteId', requirePermission('fidelizacion.ver'), FidelizacionController.porCliente);
router.get('/tarjetas/:id', requirePermission('fidelizacion.ver'), FidelizacionController.detalle);
router.post('/tarjetas/:id/canjear', requirePermission('fidelizacion.gestionar'), FidelizacionController.canjear);
router.get('/tarjetas/:id/wallet', requirePermission('fidelizacion.ver'), FidelizacionController.wallet);

module.exports = router;
