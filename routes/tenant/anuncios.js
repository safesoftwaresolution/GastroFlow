const express = require('express');
const router = express.Router();
const AnunciosController = require('../../app/Http/Controllers/Tenant/AnunciosController');

// Cualquier usuario autenticado de un restaurante (sin permiso específico): solo ve y marca SUS anuncios.
router.get('/pendiente', AnunciosController.pendiente);
router.post('/:id(\\d+)/evento', AnunciosController.evento);

module.exports = router;
