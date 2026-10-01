function removeRow(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (row) row.remove();
}

async function aprobarLocal(id, nombre) {
    const confirm = await Swal.fire({
        icon: 'question',
        title: `¿Aprobar "${GF.escapeHtml(nombre)}"?`,
        text: 'El dueño podrá iniciar sesión de inmediato.',
        showCancelButton: true,
        confirmButtonText: 'Aprobar',
        cancelButtonText: 'Cancelar'
    });
    if (!confirm.isConfirmed) return;

    try {
        const data = await GF.api(`/admin/onboarding/tenants/${id}/aprobar`, { method: 'POST' }, 'No se pudo aprobar');
        Swal.fire({ icon: 'success', title: 'Local aprobado', timer: 1500, showConfirmButton: false });
        removeRow(id);
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    }
}

async function rechazarLocal(id, nombre) {
    const { value: motivo, isConfirmed } = await Swal.fire({
        icon: 'warning',
        title: `¿Rechazar "${GF.escapeHtml(nombre)}"?`,
        input: 'text',
        inputLabel: 'Motivo (opcional, se lo enviamos al dueño)',
        inputPlaceholder: 'Ej: datos incompletos',
        showCancelButton: true,
        confirmButtonText: 'Rechazar',
        cancelButtonText: 'Cancelar'
    });
    if (!isConfirmed) return;

    try {
        const data = await GF.api(`/admin/onboarding/tenants/${id}/rechazar`, {
            method: 'POST',
            credentials: 'same-origin',
            body: { motivo }
        }, 'No se pudo rechazar');
        Swal.fire({ icon: 'success', title: 'Local rechazado', timer: 1500, showConfirmButton: false });
        removeRow(id);
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    }
}

// El nombre del local lo elige quien se registra: va en data-* (escapado por EJS) y se lee con
// dataset, nunca dentro de un onclick="...('nombre')".
document.addEventListener('click', e => {
    const aprobar = e.target.closest('.js-aprobar-local');
    if (aprobar) return aprobarLocal(aprobar.dataset.id, aprobar.dataset.nombre);
    const rechazar = e.target.closest('.js-rechazar-local');
    if (rechazar) return rechazarLocal(rechazar.dataset.id, rechazar.dataset.nombre);
});

async function reenviarVerificacion(id) {
    try {
        const data = await GF.api(`/admin/onboarding/usuarios/${id}/reenviar`, { method: 'POST' }, 'No se pudo reenviar');
        Swal.fire({ icon: 'success', title: 'Correo reenviado', timer: 1500, showConfirmButton: false });
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    }
}

async function eliminarUsuarioPendiente(id, username) {
    const confirm = await Swal.fire({
        icon: 'warning',
        title: `¿Eliminar a "${username}"?`,
        text: 'Esta acción no se puede deshacer.',
        showCancelButton: true,
        confirmButtonText: 'Eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#dc3545'
    });
    if (!confirm.isConfirmed) return;

    try {
        const data = await GF.api(`/admin/onboarding/usuarios/${id}`, { method: 'DELETE' }, 'No se pudo eliminar');
        Swal.fire({ icon: 'success', title: 'Usuario eliminado', timer: 1500, showConfirmButton: false });
        removeRow(id);
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    }
}
