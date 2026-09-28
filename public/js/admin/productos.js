(function () {
    'use strict';

    const CAMPO_LABELS = {
        codigo: 'Código',
        nombre: 'Nombre',
        precio_unidad: 'Precio',
        categoria_id: 'Categoría (ID)',
        descripcion: 'Descripción',
        imagen_url: 'Imagen',
        tributo: 'Tributo',
        tasa_impuesto: 'Tasa de impuesto',
        es_favorito: 'Favorito',
        pide_nota: 'Pide nota'
    };

    const ACCION_LABELS = {
        creado: { texto: 'Producto creado', icono: 'bi-plus-circle', color: 'success' },
        actualizado: { texto: 'Producto editado', icono: 'bi-pencil', color: 'info' },
        desactivado: { texto: 'Producto eliminado (desactivado)', icono: 'bi-trash3', color: 'danger' },
        reactivado: { texto: 'Producto reactivado', icono: 'bi-arrow-counterclockwise', color: 'success' }
    };

    function formatValor(campo, valor) {
        if (valor === null || valor === undefined || valor === '') return '(vacío)';
        if (campo === 'precio_unidad') return GF.dinero(valor);
        if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
        return GF.escapeHtml(String(valor));
    }

    function renderDetalle(data) {
        const p = data.producto;
        const grid = `
            <div class="detalle-producto-grid">
                <div><div class="campo-label">Nombre</div><div class="campo-valor">${GF.escapeHtml(p.nombre)}</div></div>
                <div><div class="campo-label">Código</div><div class="campo-valor">${GF.escapeHtml(p.codigo || '—')}</div></div>
                <div><div class="campo-label">Restaurante</div><div class="campo-valor">${GF.escapeHtml(p.tenant_nombre)}</div></div>
                <div><div class="campo-label">Categoría</div><div class="campo-valor">${GF.escapeHtml(p.categoria_nombre || '—')}</div></div>
                <div><div class="campo-label">Precio</div><div class="campo-valor">${GF.dinero(p.precio_unidad)}</div></div>
                <div><div class="campo-label">Estado</div><div class="campo-valor">${p.activo ? '<span class="badge-estado activo">Activo</span>' : '<span class="badge-estado inactivo">Eliminado</span>'}</div></div>
                <div><div class="campo-label">Creado</div><div class="campo-valor">${new Date(p.created_at).toLocaleString('es-CO')}</div></div>
                <div><div class="campo-label">Última modificación</div><div class="campo-valor">${new Date(p.updated_at).toLocaleString('es-CO')}</div></div>
            </div>
        `;

        let timeline = '<p class="text-muted small">Sin historial de auditoría (el producto no ha sido editado desde que este módulo empezó a registrar cambios).</p>';
        if (data.auditoria && data.auditoria.length > 0) {
            timeline = '<div class="auditoria-timeline">' + data.auditoria.map(ev => {
                const info = ACCION_LABELS[ev.accion] || { texto: ev.accion, icono: 'bi-circle', color: 'secondary' };
                const usuario = ev.usuario_nombre ? GF.escapeHtml(ev.usuario_nombre) : 'Usuario eliminado / desconocido';
                const fecha = new Date(ev.created_at).toLocaleString('es-CO');
                let cambiosHtml = '';
                if (ev.cambios && Object.keys(ev.cambios).length > 0) {
                    cambiosHtml = Object.entries(ev.cambios).map(([campo, { antes, despues }]) => `
                        <div class="cambio-campo">
                            <strong>${CAMPO_LABELS[campo] || campo}:</strong>
                            <span class="valor-antes">${formatValor(campo, antes)}</span>
                            →
                            <span class="valor-despues">${formatValor(campo, despues)}</span>
                        </div>
                    `).join('');
                }
                return `
                    <div class="auditoria-evento">
                        <div class="evento-titulo"><i class="bi ${info.icono} text-${info.color} me-1"></i>${info.texto}</div>
                        <div class="evento-meta">${fecha} · ${usuario}</div>
                        ${cambiosHtml}
                    </div>
                `;
            }).join('') + '</div>';
        }

        document.getElementById('detalleProductoBody').innerHTML = grid + '<hr>' + '<h6 class="fw-bold mb-3">Historial de auditoría</h6>' + timeline;
    }

    window.verDetalleProducto = async function (id) {
        const modalEl = document.getElementById('modalDetalleProducto');
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        document.getElementById('detalleProductoBody').innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';
        modal.show();

        try {
            const data = await GF.api(`/admin/productos/${id}`, {}, 'No se pudo cargar el detalle del producto');
            renderDetalle(data);
        } catch (error) {
            document.getElementById('detalleProductoBody').innerHTML = `<div class="text-center text-danger py-4">${GF.escapeHtml(error.message)}</div>`;
        }
    };
})();
