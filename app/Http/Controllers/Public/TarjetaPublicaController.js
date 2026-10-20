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
.pr{background:#0b6e4f33;border-radius:12px;padding:10px;margin-top:12px}
form{text-align:left;margin-top:16px}label{display:block;font-size:.85rem;color:#a9c4b8;margin-top:12px}input:not([type=checkbox]){display:block;width:100%;box-sizing:border-box;margin-top:4px;padding:12px;border-radius:10px;border:1px solid #2c4a3d;background:#0f1a15;color:#e8f3ee;font-size:1rem}
.chk{display:flex;gap:10px;align-items:flex-start;line-height:1.35}.chk input{margin-top:3px}.chk a{color:#00dfa2}.hp{position:absolute;left:-9999px}.err{background:#7a1f1f55;border-radius:10px;padding:10px}button.btn{width:100%;border:0;font-size:1rem;cursor:pointer}</style></head><body><div class="c">${cuerpo}</div></body></html>`;

const formularioHtml = (token, v, { error = '', valores = {} } = {}) => `<h1>${esc(v.restaurante)}</h1>
<p>Únete a nuestra tarjeta de sellos: completa ${esc(v.total)} y gana <b>${esc(v.premio)}</b>.</p>
${error ? `<p class="err">${esc(error)}</p>` : ''}
<form method="post" action="/tarjeta/unirse/${esc(token)}" autocomplete="on">
<label>Nombre<input name="nombre" required maxlength="80" autocomplete="name" value="${esc(valores.nombre)}"></label>
<label>Celular<input name="telefono" required inputmode="numeric" maxlength="16" autocomplete="tel" placeholder="3001234567" value="${esc(valores.telefono)}"></label>
<label>Correo (opcional)<input name="email" type="email" maxlength="120" autocomplete="email" value="${esc(valores.email)}"></label>
<input class="hp" name="web" tabindex="-1" autocomplete="off" aria-hidden="true">
<label class="chk"><input type="checkbox" name="consentimiento" value="1" required>
<span>Autorizo a <b>${esc(v.restaurante)}</b> a tratar mis datos (nombre, celular y correo) para administrar mi tarjeta de sellos y premios y avisarme de mis sellos. Puedo pedir que consulten, corrijan o eliminen mis datos en cualquier momento en el restaurante. Más información en la <a href="/legal/privacidad" target="_blank" rel="noopener">política de privacidad</a>.</span></label>
<button class="btn" type="submit">Crear mi tarjeta</button>
</form>`;

class TarjetaPublicaController {
    // GET /tarjeta/unirse/:token
    static async formulario(req, res) {
        try {
            res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
            const v = await FidelizacionService.vistaInscripcion(req.params.token);
            if (!v) {
                return res.status(404).send(pagina('Enlace no válido', '<h1>Enlace no válido</h1><p>Este QR ya no está activo. Pide uno nuevo en el restaurante.</p>'));
            }
            res.send(pagina(`Tarjeta ${v.restaurante}`, formularioHtml(req.params.token, v)));
        } catch (error) {
            console.error('Error en TarjetaPublicaController.formulario:', error);
            res.status(500).send(pagina('Error', '<h1>Error</h1><p>Intenta de nuevo en un momento.</p>'));
        }
    }

    // POST /tarjeta/unirse/:token
    static async inscribir(req, res) {
        res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
        const { token } = req.params;
        try {
            // Campo trampa: las personas no lo ven; los bots lo llenan. Se responde "ok" sin crear nada.
            if (req.body.web) {
                return res.send(pagina('Listo', '<h1>¡Listo!</h1><p>Tu tarjeta está en camino.</p>'));
            }
            const r = await FidelizacionService.inscribirPorQR(token, {
                nombre: req.body.nombre,
                telefono: req.body.telefono,
                email: req.body.email,
                consentimiento: req.body.consentimiento === '1',
                ip: req.ip
            });
            if (r.yaInscrito) {
                return res.send(
                    pagina(
                        'Ya tienes tarjeta',
                        '<h1>Ya tienes tarjeta</h1><p>Este celular ya está inscrito. Pide tu enlace en caja si lo necesitas.</p>'
                    )
                );
            }
            res.redirect(303, `/tarjeta/${r.token}`);
        } catch (error) {
            const v = await FidelizacionService.vistaInscripcion(token).catch(() => null);
            if (!v) {
                return res.status(404).send(pagina('Enlace no válido', '<h1>Enlace no válido</h1>'));
            }
            res.status(400).send(
                pagina(`Tarjeta ${v.restaurante}`, formularioHtml(token, v, { error: error.message, valores: req.body }))
            );
        }
    }

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
