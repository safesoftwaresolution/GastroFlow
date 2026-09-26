document.addEventListener('DOMContentLoaded', () => {
    // Abrir Caja
    const formAbrir = document.getElementById('formAbrirCaja');
    if (formAbrir) {
        formAbrir.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = Object.fromEntries(new FormData(formAbrir));

            try {
                await GF.api.post('/caja/abrir', formData, 'No se pudo abrir caja');
                Swal.fire('Éxito', 'Turno abierto correctamente', 'success').then(() => location.reload());
            } catch (error) {
                GF.error(error.message);
            }
        });
    }

    // Cerrar Caja
    const formCerrar = document.getElementById('formCerrarCaja');
    if (formCerrar) {
        formCerrar.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = formCerrar.dataset.id;
            const formData = Object.fromEntries(new FormData(formCerrar));

            const result = await Swal.fire({
                title: '¿Estás seguro?',
                text: "Una vez cerrada la caja, no podrás registrar más movimientos en este turno.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                confirmButtonText: 'Sí, cerrar turno'
            });

            if (result.isConfirmed) {
                try {
                    // Antes, si el servidor rechazaba el cierre no se mostraba nada.
                    await GF.api.post(`/caja/${id}/cerrar`, formData, 'No se pudo cerrar el turno');
                    Swal.fire('Turno Cerrado', 'Arqueo guardado exitosamente', 'success').then(() => location.reload());
                } catch (error) {
                    GF.error(error.message);
                }
            }
        });
    }

    // Registrar Movimiento
    const formMov = document.getElementById('formMovimiento');
    if (formMov) {
        formMov.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = formMov.dataset.id;
            const formData = Object.fromEntries(new FormData(formMov));

            try {
                await GF.api.post(`/caja/${id}/movimiento`, formData, 'Error al registrar');
                GF.cerrarModal('modalMovimiento');
                Swal.fire('Éxito', 'Movimiento registrado', 'success').then(() => location.reload());
            } catch (error) {
                GF.error(error.message);
            }
        });
    }
});

function setTipoMov(tipo) {
    document.getElementById('tipoMov').value = tipo;
    document.getElementById('titleMov').innerText = tipo === 'entrada' ? 'Registrar Ingreso de Efectivo' : 'Registrar Gasto / Salida';
    const btn = document.querySelector('#formMovimiento button[type="submit"]');
    btn.className = tipo === 'entrada' ? 'btn btn-success px-4' : 'btn btn-danger px-4';
}
