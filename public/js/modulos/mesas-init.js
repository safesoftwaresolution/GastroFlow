// Handle crear múltiples mesas
$(document).ready(function () {
    const modalCrearMasivas = new bootstrap.Modal(document.getElementById('modalCrearMasivas'));

    $('#btnCrearMasivas').on('click', function () {
        $('#formCrearMasivas')[0].reset();
        $('#cantidadMesas').val(10);
        modalCrearMasivas.show();
    });

    $('#btnConfirmarCrearMasivas').on('click', async function () {
        const cantidad = Number.parseInt($('#cantidadMesas').val());
        const prefijo = $('#prefijoMesas').val().trim();

        if (!cantidad || cantidad < 1 || cantidad > 100) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'La cantidad debe estar entre 1 y 100'
            });
            return;
        }

        $(this).prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-1"></span>Creando...');

        try {
            const data = await GF.api.post('/api/mesas/crear-masivas', { cantidad, prefijo: prefijo || null }, 'Error al crear mesas');

            modalCrearMasivas.hide();

            let message = `Se crearon ${data.creadas} mesas exitosamente`;
            if (data.desde) {
                message += `\nDesde: ${data.desde}`;
            }
            if (data.errores > 0) {
                message += `\n${data.errores} mesas no se pudieron crear (ya existían)`;
            }

            await Swal.fire({
                icon: 'success',
                title: 'Mesas Creadas',
                text: message,
                timer: 3000
            });

            window.location.reload();

        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message
            });
        } finally {
            $(this).prop('disabled', false).html('<i class="bi bi-check-lg me-1"></i>Crear Mesas');
        }
    });
});

// Real-time notifications for new orders (SSE)
(function () {
    if (!window.EventSource) return;

    function getNotificationDetails(isCancelled, isQR, pedidoId) {
        if (isCancelled) {
            return {
                icon: 'warning',
                title: 'Pedido Cancelado',
                text: `El pedido #${pedidoId} ha sido cancelado.`
            };
        }
        return {
            icon: 'info',
            title: isQR ? 'Nuevo pedido QR' : 'Nuevo pedido',
            text: 'Actualizando mesas...'
        };
    }

    function handleOrderCreated(data) {
        const isCancelled = data.action === 'cancelled';
        const isQR = data.origen === 'qr';

        if (typeof window.refreshMesaIfOpen === 'function' && data.mesaId) {
            window.refreshMesaIfOpen(data.mesaId, data.action);
            return;
        }

        const aviso = getNotificationDetails(isCancelled, isQR, data.pedidoId);
        GF.toast(aviso.title, aviso.icon, { text: aviso.text, position: 'bottom-end', timer: 2000, timerProgressBar: false });

        if (!isQR || isCancelled) {
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        }
    }

    function handleMesaSolicitud(data) {
        const texto = data.tipo === 'cuenta'
            ? `Mesa ${data.mesaNumero}: el cliente pide la cuenta`
            : `Mesa ${data.mesaNumero}: el cliente llama al mesero`;

        GF.toast(texto, data.tipo === 'cuenta' ? 'warning' : 'info', {
            showConfirmButton: true,
            confirmButtonText: 'Entendido',
            timer: 15000
        });
    }

    // Cualquier cambio de pedidos/mesas refresca la grilla (reemplaza el polling
    // de 3 s). 'connected' también: tras una reconexión pudimos perdernos eventos.
    const refrescarGrilla = () => {
        if (typeof window.scheduleRefreshMesas === 'function') window.scheduleRefreshMesas();
    };
    GF.tiempoReal.on('connected', refrescarGrilla);
    GF.tiempoReal.on('mesasChanged', refrescarGrilla);
    GF.tiempoReal.on('orderCreated', data => {
        refrescarGrilla();
        handleOrderCreated(data);
    });
    GF.tiempoReal.on('mesaSolicitud', handleMesaSolicitud);
})();
