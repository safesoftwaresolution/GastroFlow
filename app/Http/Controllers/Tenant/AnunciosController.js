const AnuncioService = require('../../../../services/Admin/AnuncioService');

class AnunciosController {
    // GET /api/anuncios/pendiente?excluir=1,2
    static async pendiente(req, res) {
        try {
            const excluir = String(req.query.excluir || '')
                .split(',')
                .map(Number)
                .filter(n => Number.isInteger(n) && n > 0);
            const anuncio = await AnuncioService.getPendiente({
                usuarioId: req.user.id,
                rol: req.user.rol,
                planId: req.tenant?.plan_id,
                excluir
            });
            res.json({ anuncio });
        } catch (error) {
            // Un anuncio nunca debe romper la pantalla: el cliente simplemente no muestra nada.
            console.error('Error obteniendo anuncio pendiente:', error);
            res.json({ anuncio: null });
        }
    }

    // POST /api/anuncios/:id/evento  { evento: 'vista' | 'clic' | 'no_mostrar' }
    static async evento(req, res) {
        try {
            await AnuncioService.registrarEvento({
                anuncioId: Number.parseInt(req.params.id, 10),
                usuarioId: req.user.id,
                tenantId: req.tenant?.id,
                evento: req.body?.evento
            });
            res.json({ ok: true });
        } catch (error) {
            res.status(error.status || 500).json({ error: error.message });
        }
    }
}

module.exports = AnunciosController;
