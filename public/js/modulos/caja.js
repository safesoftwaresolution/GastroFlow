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
                text: 'Ya no podrás registrar más ventas ni movimientos en este turno. ¿Ya contaste los billetes?',
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

    // Resultado del arqueo en vivo: muestra si sobra, falta o cuadra mientras se escribe
    const inputReal = document.getElementById('monto_final_real');
    const esperadoEl = document.getElementById('efectivoEsperado');
    const resultadoEl = document.getElementById('arqueoResultado');
    if (inputReal && esperadoEl && resultadoEl) {
        inputReal.addEventListener('input', () => {
            const texto = inputReal.value.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
            if (texto === '') {
                resultadoEl.hidden = true;
                return;
            }
            const diferencia = (Number.parseFloat(texto) || 0) - Number(esperadoEl.dataset.valor);
            resultadoEl.hidden = false;
            if (diferencia === 0) {
                resultadoEl.className = 'arqueo-res arqueo-ok mt-2';
                resultadoEl.textContent = '✔ Cuadra perfecto';
            } else if (diferencia > 0) {
                resultadoEl.className = 'arqueo-res arqueo-sobra mt-2';
                resultadoEl.textContent = `Sobra ${GF.dinero(diferencia)} (hay más plata de la esperada)`;
            } else {
                resultadoEl.className = 'arqueo-res arqueo-falta mt-2';
                resultadoEl.textContent = `Falta ${GF.dinero(-diferencia)} (hay menos plata de la esperada)`;
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
    document.getElementById('titleMov').innerText = tipo === 'entrada' ? 'Metí plata a la caja' : 'Pagué algo con la caja';
    document.getElementById('ayudaMov').textContent =
        tipo === 'entrada'
            ? 'Úsalo cuando pones dinero tuyo en la caja (ej: para comprar pollo). No es una venta ni una ganancia.'
            : 'Úsalo cuando sacas plata de la caja para pagar un gasto.';
    const btn = document.querySelector('#formMovimiento button[type="submit"]');
    btn.className = tipo === 'entrada' ? 'btn btn-success px-4' : 'btn btn-danger px-4';
}
