const express = require('express');
const rateLimit = require('express-rate-limit');
const TarjetaPublicaController = require('../app/Http/Controllers/Public/TarjetaPublicaController');

const router = express.Router();

// Sin login: el token es aleatorio (144 bits) y además se limita por IP.
const limitador = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Demasiadas consultas. Espera unos minutos e intenta de nuevo.'
});

// Rutas base: /tarjeta
router.get('/:token', limitador, TarjetaPublicaController.show);
router.get('/:token/wallet', limitador, TarjetaPublicaController.wallet);

module.exports = router;
