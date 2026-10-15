// Tarjeta "Carta / Brochure" en /configuracion: páginas (imagen o PDF) del carrusel del menú QR.
document.addEventListener('DOMContentLoaded', function () {
    const lista = document.getElementById('brochureLista');
    if (!lista) return;

    const input = document.getElementById('brochureInput');
    const btnSubir = document.getElementById('btnBrochureSubir');
    const feedback = document.getElementById('brochureFeedback');
    let paginas = [];

    function mostrar(msg, esError) {
        feedback.textContent = msg;
        feedback.classList.remove('alert-success', 'alert-danger');
        feedback.classList.add(esError ? 'alert-danger' : 'alert-success');
        feedback.hidden = false;
    }

    function render() {
        if (!paginas.length) {
            lista.innerHTML = '<div class="col-12 text-muted small">Aún no has subido páginas.</div>';
            return;
        }
        lista.innerHTML = paginas
            .map(function (p, i) {
                const vista =
                    p.tipo === 'pdf'
                        ? '<div class="d-flex flex-column align-items-center justify-content-center bg-light" style="height:150px">' +
                          '<i class="bi bi-file-earmark-pdf text-danger" style="font-size:2.5rem"></i>' +
                          '<small class="text-muted px-2 text-truncate w-100 text-center">' + GF.escapeHtml(p.nombre || 'PDF') + '</small></div>'
                        : '<img src="' + GF.escapeHtml(p.url) + '" alt="Página ' + (i + 1) + '" style="height:150px;width:100%;object-fit:cover">';
                return (
                    '<div class="col-6 col-md-3 col-lg-2" data-id="' + p.id + '">' +
                    '<div class="card h-100">' + vista +
                    '<div class="card-footer p-1 d-flex justify-content-between align-items-center">' +
                    '<span class="small text-muted ps-1">' + (i + 1) + '</span>' +
                    '<span>' +
                    '<button type="button" class="btn btn-sm btn-light" data-accion="subir" ' + (i === 0 ? 'disabled' : '') + ' title="Mover antes"><i class="bi bi-arrow-left"></i></button>' +
                    '<button type="button" class="btn btn-sm btn-light" data-accion="bajar" ' + (i === paginas.length - 1 ? 'disabled' : '') + ' title="Mover después"><i class="bi bi-arrow-right"></i></button>' +
                    '<button type="button" class="btn btn-sm btn-light text-danger" data-accion="eliminar" title="Eliminar"><i class="bi bi-trash"></i></button>' +
                    '</span></div></div></div>'
                );
            })
            .join('');
    }

    async function cargar() {
        paginas = await GF.api.getOr('/configuracion/brochure', []);
        render();
    }

    btnSubir.addEventListener('click', function () {
        input.click();
    });

    input.addEventListener('change', async function () {
        if (!input.files.length) return;
        const fd = new FormData();
        Array.from(input.files).forEach(function (f) {
            fd.append('archivos', f);
        });
        GF.cargando(btnSubir, true);
        try {
            paginas = await GF.api('/configuracion/brochure', { method: 'POST', body: fd }, 'No se pudo subir el brochure');
            render();
            mostrar('Brochure actualizado.', false);
        } catch (err) {
            mostrar(err.message, true);
        } finally {
            input.value = '';
            GF.cargando(btnSubir, false);
        }
    });

    lista.addEventListener('click', async function (e) {
        const btn = e.target.closest('button[data-accion]');
        if (!btn) return;
        const col = btn.closest('[data-id]');
        const id = Number(col.dataset.id);
        const idx = paginas.findIndex(function (p) { return p.id === id; });
        const accion = btn.dataset.accion;

        try {
            if (accion === 'eliminar') {
                const ok = await GF.confirmar('¿Eliminar esta página del brochure?');
                if (!ok) return;
                await GF.api.delete('/configuracion/brochure/' + id, 'No se pudo eliminar');
                paginas.splice(idx, 1);
            } else {
                const destino = accion === 'subir' ? idx - 1 : idx + 1;
                if (destino < 0 || destino >= paginas.length) return;
                const tmp = paginas[idx];
                paginas[idx] = paginas[destino];
                paginas[destino] = tmp;
                await GF.api.put('/configuracion/brochure/orden', { ids: paginas.map(function (p) { return p.id; }) }, 'No se pudo reordenar');
            }
            render();
        } catch (err) {
            mostrar(err.message, true);
            cargar();
        }
    });

    cargar();
});
