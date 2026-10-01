const express = require('express');
const router = express.Router();
const multer = require('multer');
const ConfiguracionController = require('../../app/Http/Controllers/Tenant/ConfiguracionController');
const BaseRequest = require('../../app/Http/Requests/BaseRequest');
const StoreConfiguracionRequest = require('../../app/Http/Requests/Tenant/StoreConfiguracionRequest');
const { requirePermission } = require('../../middleware/auth');

// Multer configuration
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: function (req, file, cb) {
        if (!/\.(jpg|jpeg|png|gif|webp)$/i.test(file.originalname)) {
            return cb(new Error('Solo se permiten imágenes (jpg, jpeg, png, gif, webp)'));
        }
        cb(null, true);
    }
});

function manejarErrorUpload(err, req, res, next) {
    if (!err) {
        return next();
    }
    return res.status(400).render('errors/generic', {
        error: {
            message:
                err.message === 'File too large' ? 'La imagen supera el tamaño máximo permitido (5MB)' : err.message
        },
        tenant: req.tenant || null,
        user: req.user || null
    });
}

// GET /configuracion - Vista principal
router.get('/', requirePermission('configuracion.ver', 'configuracion.editar'), ConfiguracionController.index);

// POST /configuracion - Guardar config (el permiso va antes del upload: no se procesan archivos sin autorización)
router.post(
    '/',
    requirePermission('configuracion.editar'),
    upload.fields([
        { name: 'logo', maxCount: 1 },
        { name: 'qr', maxCount: 1 }
    ]),
    manejarErrorUpload,
    BaseRequest.validate(StoreConfiguracionRequest),
    ConfiguracionController.store
);

// Helpers
// /impresoras la consume el POS/Mesas al imprimir el comprobante (pos_qz.js): quien factura la necesita.
router.get(
    '/impresoras',
    requirePermission(
        'configuracion.ver',
        'configuracion.editar',
        'pos.ver',
        'pos.vender',
        'mesas.facturar',
        'facturas.crear',
        'facturas.ver'
    ),
    ConfiguracionController.getPrinters
);
router.get('/preview', requirePermission('configuracion.ver', 'configuracion.editar'), ConfiguracionController.preview);

// Alertas proactivas (tarjeta aparte dentro de la misma vista de configuración)
router.put('/alertas', requirePermission('alertas.configurar'), ConfiguracionController.saveAlertas);

module.exports = router;
