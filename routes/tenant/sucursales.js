const express = require('express');
const router = express.Router();
const SucursalesController = require('../../app/Http/Controllers/Tenant/SucursalesController');

// Montado en /api/sucursales con auth + sucursales.gestionar + exigirPadre (routes/web.js)
router.get('/', SucursalesController.listar);
router.post('/', SucursalesController.crear);
router.patch('/:id/activo', SucursalesController.cambiarEstado);
router.post('/:id/password', SucursalesController.resetearPassword);

module.exports = router;
