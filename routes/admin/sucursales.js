const express = require('express');
const router = express.Router();
const SucursalesController = require('../../app/Http/Controllers/Admin/SucursalesController');

// Guard de superadmin aplicado en routes/web.js (requireSuperadmin)

router.get('/', SucursalesController.index);
router.post('/', SucursalesController.crear);
router.put('/limite/:id', SucursalesController.fijarLimite);

module.exports = router;
