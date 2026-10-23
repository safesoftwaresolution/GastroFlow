// Aviso "Estás en la sucursal X": vuelve al restaurante principal con el mismo usuario.
(function () {
    document.addEventListener('click', async ev => {
        const btn = ev.target.closest('.js-volver-principal');
        if (!btn) return;
        GF.cargando(btn, true);
        try {
            const r = await GF.api.post('/auth/volver-principal', {}, 'No se pudo volver al restaurante principal');
            window.location.href = r.redirect || '/';
        } catch (e) {
            GF.cargando(btn, false);
            GF.error(e.message);
        }
    });
})();
