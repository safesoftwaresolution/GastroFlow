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
                        <td>${GF.escapeHtml(s.admin_username || '—')}</td>
                        <td>${
                            s.suspendido_por_pago
                                ? '<span class="badge text-bg-warning">Suspendida por pago</span>'
                                : s.activo
                                  ? '<span class="badge text-bg-success">Activa</span>'
                                  : '<span class="badge text-bg-secondary">Inactiva</span>'
                        }</td>
                    </tr>`
                  )
                  .join('')
            : '<tr><td colspan="4" class="text-muted text-center py-4">Aún no has creado sucursales.</td></tr>';
    }

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
            await GF.post(
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
