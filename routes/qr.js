const express = require('express');
const router = express.Router();
const MenuQRService = require('../services/Public/MenuQRService');
const MenuQRController = require('../app/Http/Controllers/Public/MenuQRController');

// Rutas base: /qr

// GET /qr/:tenantSlug/:qrToken -> Muestra la vista del menú (catálogo)
router.get('/:tenantSlug/:qrToken', MenuQRController.showMenu);

// GET /qr/:tenantSlug/:qrToken/manifest.webmanifest -> PWA del menú de ese restaurante
// (start_url propio: instalar el menú no debe abrir el login de GastroFlow)
router.get('/:tenantSlug/:qrToken/manifest.webmanifest', async (req, res) => {
    try {
        const { tenantSlug, qrToken } = req.params;
        const data = await MenuQRService.getMenuData(tenantSlug, qrToken);
        const base = `/qr/${encodeURIComponent(tenantSlug)}/${encodeURIComponent(qrToken)}`;
        const nombre = String(data.tenant.nombre || 'Menú digital').slice(0, 45);
        res.type('application/manifest+json').json({
            name: nombre,
            short_name: nombre.slice(0, 12),
            id: base,
            start_url: base,
            scope: base,
            display: 'standalone',
            background_color: '#080b09',
            theme_color: '#080b09',
            lang: 'es',
            icons: [
                { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
                { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
                { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
            ]
        });
    } catch (_) {
        res.status(404).end();
    }
});

module.exports = router;
