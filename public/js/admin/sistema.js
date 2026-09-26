/**
 * Admin Sistema - Temas y parámetros por tenant (superadmin).
 * API base: /admin/sistema, todas las llamadas requieren tenant_id.
 */
(function () {
    'use strict';

    const BASE = '/admin/sistema';

    function getTenantId() {
        const el = document.getElementById('tenantId');
        if (!el || !el.value) return null;
        return parseInt(el.value, 10);
    }

    function apiRequest(path, opts = {}) {
        const tenantId = getTenantId();
        if (!tenantId) return Promise.reject(new Error('Seleccioná un restaurante.'));
        const sep = path.indexOf('?') !== -1 ? '&' : '?';
        const url = BASE + path + sep + 'tenant_id=' + tenantId;
        const options = {
            headers: { 'Content-Type': 'application/json' },
            ...opts
        };
        if (opts.body !== undefined && (opts.method === 'POST' || opts.method === 'PUT')) {
            const body = typeof opts.body === 'string' ? JSON.parse(opts.body) : opts.body;
            body.tenant_id = tenantId;
            options.body = JSON.stringify(body);
        }
        return fetch(url, options).then(res => {
            if (!res.ok) return res.json().then(j => Promise.reject(new Error(j.error || res.statusText)));
            return res.json();
        });
    }



    function loadTemas() {
        const ul = document.getElementById('listaTemas');
        if (!ul) return Promise.resolve([]);
        return apiRequest('/api/temas').then(list => {
            ul.innerHTML = '';
            (list || []).forEach(t => {
                const li = document.createElement('li');
                li.className = 'list-group-item d-flex justify-content-between align-items-center';
                li.innerHTML = `
                    <span>${GF.escapeHtml(t.name)}</span>
                    <span>
                        <button type="button" class="btn btn-sm btn-outline-primary me-1 btnAsignarParametrosTema" data-id="${t.id}" data-name="${GF.escapeHtml(t.name)}">Parámetros</button>
                        <button type="button" class="btn btn-sm btn-outline-secondary me-1 btnEditTema" data-id="${t.id}">Editar</button>
                        <button type="button" class="btn btn-sm btn-outline-danger btnElimTema" data-id="${t.id}">Eliminar</button>
                    </span>`;
                ul.appendChild(li);
            });
            return list;
        }).catch(err => { GF.toast(err.message, 'danger'); return []; });
    }

    function loadParametros() {
        const ul = document.getElementById('listaParametros');
        const ul2 = document.getElementById('listaParametros2');
        return apiRequest('/api/parametros').then(list => {
            [ul, ul2].filter(Boolean).forEach(u => {
                if (!u) return;
                u.innerHTML = '';
                (list || []).forEach(p => {
                    const li = document.createElement('li');
                    li.className = 'list-group-item d-flex justify-content-between align-items-center';
                    li.innerHTML = `
                        <span>${GF.escapeHtml(p.name)}</span>
                        <span>
                            <button type="button" class="btn btn-sm btn-outline-secondary me-1 btnEditParametro" data-id="${p.id}">Editar</button>
                            <button type="button" class="btn btn-sm btn-outline-danger btnElimParametro" data-id="${p.id}">Eliminar</button>
                        </span>`;
                    u.appendChild(li);
                });
            });
            return list;
        }).catch(err => { GF.toast(err.message, 'danger'); return []; });
    }

    // Selector tenant: recargar página con tenant_id
    document.getElementById('selectorTenant')?.addEventListener('change', function () {
        const id = this.value;
        if (id) window.location.href = BASE + '?tenant_id=' + id;
    });

    // Nuevo tema
    document.getElementById('btnNuevoTema')?.addEventListener('click', () => {
        document.getElementById('temaId').value = '';
        document.getElementById('temaNombre').value = '';
        document.getElementById('modalTemaTitle').textContent = 'Nuevo tema';
        new bootstrap.Modal(document.getElementById('modalTema')).show();
    });

    document.getElementById('btnGuardarTema')?.addEventListener('click', () => {
        const id = document.getElementById('temaId').value;
        const name = document.getElementById('temaNombre').value.trim();
        if (!name) { GF.toast('Nombre requerido', 'warning'); return; }
        const promise = id
            ? apiRequest('/api/temas/' + id, { method: 'PUT', body: JSON.stringify({ name }) })
            : apiRequest('/api/temas', { method: 'POST', body: JSON.stringify({ name }) });
        promise.then(() => {
            bootstrap.Modal.getInstance(document.getElementById('modalTema')).hide();
            loadTemas();
            GF.toast('Tema guardado', 'success');
        }).catch(err => GF.toast(err.message, 'danger'));
    });

    // Editar / Eliminar tema
    document.getElementById('listaTemas')?.addEventListener('click', (e) => {
        const id = e.target.closest('[data-id]')?.getAttribute('data-id');
        if (!id) return;
        if (e.target.classList.contains('btnEditTema')) {
            apiRequest('/api/temas/' + id).then(t => {
                document.getElementById('temaId').value = t.id;
                document.getElementById('temaNombre').value = t.name || '';
                document.getElementById('modalTemaTitle').textContent = 'Editar tema';
                new bootstrap.Modal(document.getElementById('modalTema')).show();
            }).catch(err => GF.toast(err.message, 'danger'));
        } else if (e.target.classList.contains('btnElimTema')) {
            (typeof Swal !== 'undefined' ? Swal.fire({ title: '¿Eliminar este tema?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar' }).then(r => r.isConfirmed) : Promise.resolve(confirm('¿Eliminar este tema?')))
                .then(ok => { if (!ok) return; return apiRequest('/api/temas/' + id, { method: 'DELETE' }); })
                .then(() => { loadTemas(); GF.toast('Tema eliminado', 'success'); })
                .catch(err => err && GF.toast(err.message, 'danger'));
        } else if (e.target.classList.contains('btnAsignarParametrosTema')) {
            const name = e.target.getAttribute('data-name') || '';
            document.getElementById('temaParametrosNombre').textContent = name;
            document.getElementById('cardTemaParametros').classList.remove('d-none');
            document.getElementById('cardTemaParametros').dataset.temaId = id;
            apiRequest('/api/parametros').then(allParams => {
                return apiRequest('/api/temas/' + id + '/parametros').then(assigned => {
                    const assignedIds = new Set((assigned || []).map(p => p.id));
                    const div = document.getElementById('checkboxesParametrosTema');
                    div.innerHTML = '';
                    (allParams || []).forEach(p => {
                        const label = document.createElement('label');
                        label.className = 'd-block me-3';
                        label.innerHTML = `<input type="checkbox" class="form-check-input me-2" value="${p.id}" ${assignedIds.has(p.id) ? 'checked' : ''}> ${GF.escapeHtml(p.name)}`;
                        div.appendChild(label);
                    });
                });
            }).catch(err => GF.toast(err.message, 'danger'));
        }
    });

    document.getElementById('btnGuardarTemaParametros')?.addEventListener('click', () => {
        const temaId = document.getElementById('cardTemaParametros')?.dataset?.temaId;
        if (!temaId) return;
        const checkboxes = document.querySelectorAll('#checkboxesParametrosTema input[type="checkbox"]:checked');
        const parametro_ids = Array.from(checkboxes).map(cb => parseInt(cb.value, 10));
        apiRequest('/api/temas/' + temaId + '/parametros', { method: 'PUT', body: JSON.stringify({ parametro_ids }) })
            .then(() => { GF.toast('Parámetros del tema actualizados', 'success'); loadTemas(); })
            .catch(err => GF.toast(err.message, 'danger'));
    });

    // Parámetros: nuevo (ambos botones)
    function openModalParametro(title) {
        document.getElementById('parametroId').value = '';
        document.getElementById('parametroNombre').value = '';
        document.getElementById('modalParametroTitle').textContent = title;
        new bootstrap.Modal(document.getElementById('modalParametro')).show();
    }
    document.getElementById('btnNuevoParametro')?.addEventListener('click', () => openModalParametro('Nuevo parámetro'));
    document.getElementById('btnNuevoParametro2')?.addEventListener('click', () => openModalParametro('Nuevo parámetro'));

    document.getElementById('btnGuardarParametro')?.addEventListener('click', () => {
        const id = document.getElementById('parametroId').value;
        const name = document.getElementById('parametroNombre').value.trim();
        if (!name) { GF.toast('Nombre requerido', 'warning'); return; }
        const promise = id
            ? apiRequest('/api/parametros/' + id, { method: 'PUT', body: JSON.stringify({ name }) })
            : apiRequest('/api/parametros', { method: 'POST', body: JSON.stringify({ name }) });
        promise.then(() => {
            bootstrap.Modal.getInstance(document.getElementById('modalParametro')).hide();
            loadParametros();
            GF.toast('Parámetro guardado', 'success');
        }).catch(err => GF.toast(err.message, 'danger'));
    });

    // Editar / Eliminar parámetro (lista 1 y 2)
    function handleParametroListClick(e) {
        const id = e.target.closest('[data-id]')?.getAttribute('data-id');
        if (!id) return;
        if (e.target.classList.contains('btnEditParametro')) {
            apiRequest('/api/parametros/' + id).then(p => {
                document.getElementById('parametroId').value = p.id;
                document.getElementById('parametroNombre').value = p.name || '';
                document.getElementById('modalParametroTitle').textContent = 'Editar parámetro';
                new bootstrap.Modal(document.getElementById('modalParametro')).show();
            }).catch(err => GF.toast(err.message, 'danger'));
        } else if (e.target.classList.contains('btnElimParametro')) {
            (typeof Swal !== 'undefined' ? Swal.fire({ title: '¿Eliminar este parámetro?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar' }).then(r => r.isConfirmed) : Promise.resolve(confirm('¿Eliminar este parámetro?')))
                .then(ok => { if (!ok) return; return apiRequest('/api/parametros/' + id, { method: 'DELETE' }); })
                .then(() => { loadParametros(); GF.toast('Parámetro eliminado', 'success'); })
                .catch(err => err && GF.toast(err.message, 'danger'));
        }
    }
    document.getElementById('listaParametros')?.addEventListener('click', handleParametroListClick);
    document.getElementById('listaParametros2')?.addEventListener('click', handleParametroListClick);

    // Al mostrar tab Temas, cargar listas
    document.getElementById('temas-tab')?.addEventListener('shown.bs.tab', () => { loadTemas(); loadParametros(); });
    document.getElementById('parametros-tab')?.addEventListener('shown.bs.tab', () => loadParametros());

    // Init: si hay tenant, cargar
    if (getTenantId()) {
        loadTemas();
        loadParametros();
    }
})();
