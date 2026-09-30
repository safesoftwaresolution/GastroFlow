const BonoPublicoService = require('../../../../services/Public/BonoPublicoService');

class BonoPublicoController {
    // GET /bono/:token
    static async show(req, res) {
        try {
            const vista = await BonoPublicoService.getVista(req.params.token);
            if (!vista) {
                return res.status(404).render('errors/404', { message: 'Este bono no existe o el enlace no es válido.' });
            }
            // Contiene saldo: que ni el navegador ni un proxy lo guarden ni lo indexen.
            res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
            res.render('bono/publico', vista);
        } catch (error) {
            console.error('Error en BonoPublicoController:', error);
            res.status(500).render('errors/internal', {
                error: { message: 'No se pudo cargar el bono', stack: '' }
            });
        }
    }
}

module.exports = BonoPublicoController;
