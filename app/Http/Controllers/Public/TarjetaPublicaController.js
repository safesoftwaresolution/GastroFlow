const FidelizacionService = require('../../../../services/Tenant/FidelizacionService');

const esc = v =>
    String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const pagina = (titulo, cuerpo) => `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>${esc(titulo)}</title>
<style>body{font-family:system-ui,sans-serif;background:#0f1a15;color:#e8f3ee;margin:0;padding:24px;display:grid;place-items:center;min-height:100vh}
.c{max-width:360px;width:100%;background:#16251e;border-radius:20px;padding:28px;text-align:center}
h1{font-size:1.2rem;margin:0 0 4px}p{color:#a9c4b8;margin:6px 0}.sellos{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:20px 0}
.s{width:34px;height:34px;border-radius:50%;border:2px solid #0b6e4f}.s.on{background:#0b6e4f}
.btn{display:block;background:#00dfa2;color:#04231a;font-weight:700;text-decoration:none;padding:14px;border-radius:999px;margin-top:20px}
.pr{background:#0b6e4f33;border-radius:12px;padding:10px;margin-top:12px}</style></head><body><div class="c">${cuerpo}</div></body></html>`;

class TarjetaPublicaController {
    // GET /tarjeta/:token
    static async show(req, res) {
        try {
            res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
            const v = await FidelizacionService.vistaPublica(req.params.token);
            if (!v) {return res.status(404).send(pagina('Tarjeta no encontrada', '<h1>Tarjeta no encontrada</h1><p>El enlace no es válido.</p>'));}
            const puntos = Array.from({ length: v.total }, (_, i) => `<span class="s ${i < v.sellos ? 'on' : ''}"></span>`).join('');
            const premios = v.premiosDisponibles
                ? `<div class="pr">¡Tienes ${esc(v.premiosDisponibles)} premio(s) por canjear!</div>`
                : '';
            res.send(
                pagina(
                    `Tarjeta ${v.restaurante}`,
                    `<h1>${esc(v.restaurante)}</h1><p>${esc(v.cliente)}</p>
<div class="sellos">${puntos}</div><p>${esc(v.sellos)} de ${esc(v.total)} sellos</p><p>Premio: ${esc(v.premio)}</p>${premios}
<a class="btn" href="/tarjeta/${esc(req.params.token)}/wallet">Agregar a Google Wallet</a>`
                )
            );
        } catch (error) {
            console.error('Error en TarjetaPublicaController.show:', error);
            res.status(500).send(pagina('Error', '<h1>Error</h1><p>Intenta de nuevo en un momento.</p>'));
        }
    }

    // GET /tarjeta/:token/wallet -> redirige a "Guardar en Google Wallet"
    static async wallet(req, res) {
        try {
            const enlace = await FidelizacionService.enlaceWalletPublico(req.params.token);
            if (!enlace) {return res.status(404).send(pagina('Tarjeta no encontrada', '<h1>Tarjeta no encontrada</h1>'));}
            res.set('Cache-Control', 'no-store');
            res.redirect(302, enlace);
        } catch (error) {
            console.error('Error en TarjetaPublicaController.wallet:', error.message);
            res.status(503).send(pagina('No disponible', '<h1>No disponible</h1><p>No se pudo preparar tu tarjeta. Intenta más tarde.</p>'));
        }
    }
}

module.exports = TarjetaPublicaController;
