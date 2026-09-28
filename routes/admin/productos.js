const express = require('express');
const router = express.Router();
const ProductosController = require('../../app/Http/Controllers/Admin/ProductosController');

// Guard de superadmin aplicado en routes/web.js (requireSuperadmin)

router.get('/', ProductosController.index);
router.get('/:id', ProductosController.show);

module.exports = router;
