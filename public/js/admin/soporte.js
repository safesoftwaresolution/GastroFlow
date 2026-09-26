// Cambiar estado directo
document.querySelectorAll('.status-select').forEach(select => {
    select.addEventListener('change', async (e) => {
        const id = e.target.dataset.id;
        const estado = e.target.value;
        try {
            await GF.api.post(`/admin/soporte/${id}/estado`, { estado }, 'No se pudo actualizar el estado');
            GF.toast('Estado actualizado', 'success', { timer: 1500 });
        } catch (error) {
            Swal.fire('Error', error.message, 'error');
        }
    });
});

// Modal Responder
document.querySelectorAll('.btn-responder').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const b = e.currentTarget;
        document.getElementById('modalTicketId').textContent = b.dataset.id;
        document.getElementById('modalTenantName').textContent = b.dataset.tenant;
        document.getElementById('modalTicketDesc').textContent = b.dataset.desc;
        document.getElementById('replyTicketId').value = b.dataset.id;
        document.getElementById('replyText').value = b.dataset.resp;
    });
});

// Enviar Respuesta
document.getElementById('replyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSendReply');
    const id = document.getElementById('replyTicketId').value;
    const respuesta = document.getElementById('replyText').value;

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Enviando...';

    try {
        const data = await GF.api.post(`/admin/soporte/${id}/responder`, { respuesta }, 'No se pudo enviar la respuesta');
        await Swal.fire('Enviado', data.message, 'success');
        window.location.reload();
    } catch (error) {
        Swal.fire('Error', error.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-send me-1"></i> Enviar y Marcar Resuelto';
    }
});
