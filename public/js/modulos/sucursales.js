// Pantalla de Sucursales del tenant: listado y alta de sucursal con su administrador.
// Sin onclick inline, consistente con la convención CSP.

(function () {
    const app = document.getElementById('sucursalesApp');
    if (!app) return;
    const $ = id => document.getElementById(id);

    function pintar(data) {
        const { sucursales, max } = data;
        $('cupo').textContent = sucursales.length + ' de ' + max + ' sucursales';
        $('btnCrear').disabled = sucursales.length >= max;

        $('tbodySucursales').innerHTML = sucursales.length
            ? sucursales
                  .map(
                      s => `<tr>
                        <td class="fw-semibold">${GF.escapeHtml(s.nombre)}</td>
                        <td>${GF.escapeHtml(s.ciudad || '—')}</td>
                        <td>${GF.escapeHtml(s.admin_username || '—')}${
                            Number(s.admin_debe_cambiar)
                                ? '<div class="small text-warning">Pendiente de cambiar contraseña</div>'
                                : ''
                        }</td>
                        <td>${
                            s.suspendido_por_pago
                                ? '<span class="badge text-bg-warning">Suspendida por pago</span>'
                                : s.activo
                                  ? '<span class="badge text-bg-success">Activa</span>'
                                  : '<span class="badge text-bg-secondary">Inactiva</span>'
                        }</td>
                        <td class="text-end text-nowrap">
                            ${
                                s.activo
                                    ? `<button type="button" class="btn btn-sm btn-primary js-entrar" data-id="${s.id}"><i class="bi bi-box-arrow-in-right me-1"></i>Entrar</button>`
                                    : ''
                            }
                            <button type="button" class="btn btn-sm btn-outline-secondary js-password" data-id="${s.id}" data-nombre="${GF.escapeHtml(s.nombre)}" title="Definir contraseña temporal"><i class="bi bi-key"></i></button>
                            ${
                                s.suspendido_por_pago
                                    ? ''
                                    : `<button type="button" class="btn btn-sm ${s.activo ? 'btn-outline-danger' : 'btn-outline-success'} js-estado" data-id="${s.id}" data-nombre="${GF.escapeHtml(s.nombre)}" data-activo="${s.activo ? 1 : 0}">${s.activo ? 'Desactivar' : 'Activar'}</button>`
                            }
                        </td>
                    </tr>`
                  )
                  .join('')
            : '<tr><td colspan="5" class="text-muted text-center py-4">Aún no has creado sucursales.</td></tr>';
    }

    // Acciones por fila (delegación de eventos, sin onclick inline)
    $('tbodySucursales').addEventListener('click', async ev => {
        const btnEstado = ev.target.closest('.js-estado');
        const btnPass = ev.target.closest('.js-password');
        const btnEntrar = ev.target.closest('.js-entrar');
        try {
            if (btnEntrar) {
                GF.cargando(btnEntrar, true);
                try {
                    const r = await GF.api.post(
                        `/api/sucursales/${btnEntrar.dataset.id}/entrar`,
                        {},
                        'No se pudo entrar a la sucursal'
                    );
                    window.location.href = r.redirect || '/';
                } catch (e) {
                    GF.cargando(btnEntrar, false);
                    throw e;
                }
            } else if (btnEstado) {
                const activar = btnEstado.dataset.activo !== '1';
                const ok = await GF.confirmar(
                    activar
                        ? `"${btnEstado.dataset.nombre}" volverá a poder operar.`
                        : `"${btnEstado.dataset.nombre}" y sus usuarios no podrán iniciar sesión hasta que la actives de nuevo.`,
                    { titulo: activar ? 'Activar sucursal' : 'Desactivar sucursal' }
                );
                if (!ok) return;
                await GF.api.patch(
                    `/api/sucursales/${btnEstado.dataset.id}/activo`,
                    { activo: activar },
                    'No se pudo cambiar el estado'
                );
                GF.toast(activar ? 'Sucursal activada' : 'Sucursal desactivada');
                await cargar();
            } else if (btnPass) {
                const r = await Swal.fire({
                    title: 'Contraseña temporal',
                    text: `Administrador de "${btnPass.dataset.nombre}". Deberá cambiarla al ingresar.`,
                    input: 'password',
                    inputAttributes: { autocomplete: 'new-password', minlength: 8 },
                    inputPlaceholder: 'Mínimo 8 caracteres',
                    showCancelButton: true,
                    confirmButtonText: 'Guardar',
                    cancelButtonText: 'Cancelar',
                    inputValidator: v => (!v || v.length < 8 ? 'Mínimo 8 caracteres' : undefined)
                });
                if (!r.isConfirmed) return;
                await GF.api.post(
                    `/api/sucursales/${btnPass.dataset.id}/password`,
                    { password: r.value },
                    'No se pudo definir la contraseña'
                );
                GF.toast('Contraseña temporal definida');
                await cargar();
            }
        } catch (e) {
            GF.error(e.message);
        }
    });

    async function cargar() {
        try {
            pintar(await GF.api('/api/sucursales', {}, 'No se pudieron cargar las sucursales'));
        } catch (e) {
            GF.error(e.message);
        }
    }

    $('formSucursal').addEventListener('submit', async ev => {
        ev.preventDefault();
        const btn = $('btnCrear');
        GF.cargando(btn, true);
        try {
            await GF.api.post(
                '/api/sucursales',
                {
                    nombre: $('sNombre').value,
                    ciudad: $('sCiudad').value,
                    telefono: $('sTelefono').value,
                    direccion: $('sDireccion').value,
                    admin: {
                        nombre_completo: $('aNombre').value,
                        username: $('aUsername').value,
                        password: $('aPassword').value,
                        email: $('aEmail').value
                    }
                },
                'No se pudo crear la sucursal'
            );
            $('formSucursal').reset();
            GF.exito('Sucursal creada', 'Ya puede iniciar sesión con el usuario que definiste.');
        } catch (e) {
            GF.error(e.message);
        } finally {
            GF.cargando(btn, false);
        }
        await cargar();
    });

    cargar();
})();
