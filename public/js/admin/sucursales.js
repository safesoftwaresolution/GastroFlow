(function () {
    'use strict';

    var $ = function (id) {
        return document.getElementById(id);
    };

    document.addEventListener('click', function (ev) {
        var btn = ev.target.closest('.js-guardar-limite');
        if (!btn) return;
        var id = btn.dataset.id;
        var input = document.querySelector('.js-limite[data-id="' + id + '"]');
        GF.cargando(btn, true);
        GF.api.put('/admin/sucursales/limite/' + id, { max_sucursales: Number(input.value) }, 'No se pudo guardar el límite')
            .then(function () {
                GF.toast('Límite guardado');
            })
            .catch(function (e) {
                GF.error(e.message);
            })
            .finally(function () {
                GF.cargando(btn, false);
            });
    });

    $('formSucursal').addEventListener('submit', function (ev) {
        ev.preventDefault();
        var btn = $('btnCrear');
        GF.cargando(btn, true);
        GF.api.post(
            '/admin/sucursales',
            {
                padre_id: $('sPadre').value,
                plan_id: $('sPlan').value,
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
        )
            .then(function () {
                window.location.reload();
            })
            .catch(function (e) {
                GF.cargando(btn, false);
                GF.error(e.message);
            });
    });
})();
