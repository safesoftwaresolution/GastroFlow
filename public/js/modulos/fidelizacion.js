// Pantalla de Fidelización: programa de sellos, QR de inscripción y tarjetas de clientes.
// Sin onclick inline (delegación de eventos), consistente con la convención CSP.

(function () {
    const app = document.getElementById('fidelizacionApp');
    if (!app) return;
    const puedeGestionar = app.dataset.puedeGestionar === '1';
    const $ = id => document.getElementById(id);

    let programa = null;
    let tarjetas = [];
    let temporizador = null;

    // ---------- Programa ----------

    function pintarPrograma(p) {
        programa = p;
        $('pNombre').value = p.nombre || '';
        $('pSellos').value = p.sellos_requeridos || 8;
        $('pMonto').value = Number(p.monto_minimo || 0);
        $('pPremio').value = p.premio || '';
        $('pActivo').checked = Boolean(Number(p.activo));
        if (!puedeGestionar) {
            $('formPrograma').querySelectorAll('input, button').forEach(el => (el.disabled = true));
        }
    }

    async function cargarPrograma() {
        pintarPrograma(await GF.api('/api/fidelizacion/programa', {}, 'No se pudo cargar el programa'));
        if (programa.configurado === false) {
            $('pPremio').value = '';
        }
        await cargarQr();
    }

    async function guardarPrograma(e) {
        e.preventDefault();
        const btn = $('btnGuardarPrograma');
        GF.cargando(btn, true);
        try {
            const guardado = await GF.api(
                '/api/fidelizacion/programa',
                {
                    method: 'PUT',
                    body: {
                        nombre: $('pNombre').value,
                        sellos_requeridos: $('pSellos').value,
                        monto_minimo: $('pMonto').value || 0,
                        premio: $('pPremio').value,
                        activo: $('pActivo').checked
                    }
                },
                'No se pudo guardar el programa'
            );
            pintarPrograma(guardado);
            GF.toast('Programa guardado', 'success');
            await cargarQr();
            await cargarTarjetas();
        } catch (error) {
            GF.error(error.message);
        } finally {
            GF.cargando(btn, false);
        }
    }

    // ---------- QR de inscripción ----------

    async function cargarQr(regenerar) {
        if (!puedeGestionar || !programa || programa.configurado === false) {
            $('qrVacio').classList.remove('d-none');
            $('qrContenido').classList.add('d-none');
            return;
        }
        try {
            const r = regenerar
                ? await GF.api('/api/fidelizacion/inscripcion/regenerar', { method: 'POST' }, 'No se pudo regenerar el QR')
                : await GF.api('/api/fidelizacion/inscripcion', {}, 'No se pudo cargar el QR');
            $('qrImagen').src = r.qr;
            $('qrUrl').value = r.url;
            $('btnDescargarQr').href = r.qr;
            $('qrVacio').classList.add('d-none');
            $('qrContenido').classList.remove('d-none');
        } catch {
            $('qrVacio').classList.remove('d-none');
            $('qrContenido').classList.add('d-none');
        }
    }

    async function regenerarQr() {
        const ok = await GF.confirmar('El QR anterior dejará de funcionar. ¿Generar uno nuevo?', {
            confirmar: 'Sí, generar',
            peligro: true
        });
        if (!ok) return;
        await cargarQr(true);
        GF.toast('QR nuevo generado', 'success');
    }

    async function copiar(texto) {
        try {
            await navigator.clipboard.writeText(texto);
            GF.toast('Enlace copiado', 'success');
        } catch {
            GF.error('No se pudo copiar. Selecciona el texto y cópialo a mano.');
        }
    }

    // ---------- Tarjetas ----------

    function filaTarjeta(t) {
        const total = programa ? programa.sellos_requeridos : '';
        const premios = t.premios_disponibles
            ? `<span class="badge bg-success">${t.premios_disponibles} por canjear</span>`
            : '<span class="text-muted">—</span>';
        const canjear =
            puedeGestionar && t.premios_disponibles
                ? `<button class="btn btn-sm btn-success btn-canjear" data-id="${t.id}"><i class="bi bi-gift me-1"></i>Canjear</button>`
                : '';
        return `<tr>
            <td><div class="fw-semibold">${GF.escapeHtml(t.cliente_nombre)}</div>
                <div class="small text-muted">${GF.escapeHtml(t.cliente_telefono || '')}</div></td>
            <td><code>${GF.escapeHtml(t.numero)}</code></td>
            <td>${t.sellos} / ${total}<div class="small text-muted">${t.sellos_historicos} en total</div></td>
            <td>${premios}<div class="small text-muted">${t.premios_canjeados} canjeados</div></td>
            <td class="text-end">${canjear}
                <button class="btn btn-sm btn-outline-secondary btn-enlace" data-token="${GF.escapeHtml(t.token_publico)}" title="Copiar enlace de la tarjeta"><i class="bi bi-link-45deg"></i></button>
                <button class="btn btn-sm btn-outline-primary btn-historial" data-id="${t.id}" title="Historial"><i class="bi bi-clock-history"></i></button></td>
        </tr>`;
    }

    async function cargarTarjetas() {
        const q = $('filtroTarjetas').value.trim();
        const tbody = $('tbodyTarjetas');
        try {
            tarjetas = await GF.api(
                '/api/fidelizacion/tarjetas' + (q ? `?q=${encodeURIComponent(q)}` : ''),
                {},
                'No se pudieron cargar las tarjetas'
            );
            tbody.innerHTML = tarjetas.length
                ? tarjetas.map(filaTarjeta).join('')
                : '<tr><td colspan="5" class="text-muted text-center py-4">Aún no hay tarjetas. Comparte el QR con tus clientes.</td></tr>';
        } catch (error) {
            GF.tableError(tbody, 5, 'No se pudieron cargar las tarjetas', error);
        }
    }

    async function canjear(id) {
        const ok = await GF.confirmar('Se descontará un premio de esta tarjeta.', { confirmar: 'Canjear premio' });
        if (!ok) return;
        try {
            await GF.api(`/api/fidelizacion/tarjetas/${id}/canjear`, { method: 'POST' }, 'No se pudo canjear el premio');
            GF.toast('Premio canjeado', 'success');
            await cargarTarjetas();
        } catch (error) {
            GF.error(error.message);
        }
    }

    const ETIQUETA = { sello: 'Sello', premio_ganado: 'Premio ganado', canje: 'Premio canjeado' };

    async function verHistorial(id) {
        try {
            const { tarjeta, movimientos } = await GF.api(`/api/fidelizacion/tarjetas/${id}`, {}, 'No se pudo cargar el historial');
            const filas = movimientos.length
                ? movimientos
                      .map(
                          m =>
                              `<tr><td>${new Date(m.created_at).toLocaleString('es-CO')}</td><td>${ETIQUETA[m.tipo] || GF.escapeHtml(m.tipo)}</td><td>${m.factura_id ? '#' + m.factura_id : ''}</td></tr>`
                      )
                      .join('')
                : '<tr><td colspan="3" class="text-muted">Sin movimientos</td></tr>';
            Swal.fire({
                title: GF.escapeHtml(tarjeta.cliente_nombre),
                html: `<div class="text-start small"><table class="table table-sm"><thead><tr><th>Fecha</th><th>Movimiento</th><th>Factura</th></tr></thead><tbody>${filas}</tbody></table></div>`,
                width: 560,
                confirmButtonText: 'Cerrar'
            });
        } catch (error) {
            GF.error(error.message);
        }
    }

    // ---------- Eventos ----------

    $('formPrograma').addEventListener('submit', guardarPrograma);
    $('btnCopiarQr').addEventListener('click', () => copiar($('qrUrl').value));
    $('btnRegenerarQr').addEventListener('click', regenerarQr);
    $('filtroTarjetas').addEventListener('input', () => {
        clearTimeout(temporizador);
        temporizador = setTimeout(cargarTarjetas, 300);
    });
    $('tbodyTarjetas').addEventListener('click', e => {
        const btn = e.target.closest('button');
        if (!btn) return;
        if (btn.classList.contains('btn-canjear')) canjear(btn.dataset.id);
        else if (btn.classList.contains('btn-historial')) verHistorial(btn.dataset.id);
        else if (btn.classList.contains('btn-enlace')) copiar(`${location.origin}/tarjeta/${btn.dataset.token}`);
    });

    cargarPrograma().then(cargarTarjetas);
})();
