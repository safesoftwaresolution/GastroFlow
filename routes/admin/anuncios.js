const express = require('express');
const router = express.Router();
const AnunciosController = require('../../app/Http/Controllers/Admin/AnunciosController');

// Guard de superadmin aplicado en routes/web.js (requireRole(ROLES.SUPERADMIN))

router.get('/', AnunciosController.index);
router.post('/', AnunciosController.crear);
router.put('/:id(\\d+)', AnunciosController.actualizar);
router.patch('/:id(\\d+)/activo', AnunciosController.setActivo);
router.delete('/:id(\\d+)', AnunciosController.eliminar);

module.exports = router;
