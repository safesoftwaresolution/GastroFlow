(function () {
    var form = document.getElementById('exportForm');
    var btn = document.getElementById('exportSubmitBtn');
    var label = document.getElementById('exportSubmitLabel');
    var tenantSelect = document.getElementById('tenantId');
    var tenantsListPanel = document.getElementById('tenantsListPanel');
    var contenidoReporteBox = document.getElementById('contenidoReporteBox');
    var incluirTopProductos = document.getElementById('incluirTopProductos');
    var incluirDesglosePorMes = document.getElementById('incluirDesglosePorMes');
    if (!form) return;

    function syncActiveRow() {
        if (!tenantsListPanel) return;
        var rows = tenantsListPanel.querySelectorAll('.tenant-pick-row');
        rows.forEach(function (row) {
            row.classList.toggle('tenant-pick-row-active', row.dataset.tenantId === tenantSelect.value);
        });
    }

    // El desglose "por restaurante" (resumen mensual, top de productos) solo aplica
    // cuando se elige un restaurante específico -- para "Todos" el PDF ya trae todo.
    function syncContenidoBox() {
        if (!contenidoReporteBox) return;
        contenidoReporteBox.hidden = tenantSelect.value === 'all';
    }

    // El desglose mes a mes es una variante del top de productos: no tiene sentido
    // activado si esa tabla está desactivada.
    function syncDesgloseState() {
        if (!incluirTopProductos || !incluirDesglosePorMes) return;
        incluirDesglosePorMes.disabled = !incluirTopProductos.checked;
        if (!incluirTopProductos.checked) {
            incluirDesglosePorMes.checked = false;
        }
    }

    if (tenantsListPanel && tenantSelect) {
        tenantsListPanel.addEventListener('click', function (evt) {
            var row = evt.target.closest('.tenant-pick-row');
            if (!row) return;
            tenantSelect.value = row.dataset.tenantId;
            syncActiveRow();
            syncContenidoBox();
        });
        tenantSelect.addEventListener('change', function () {
            syncActiveRow();
            syncContenidoBox();
        });
        syncActiveRow();
        syncContenidoBox();
    }

    if (incluirTopProductos) {
        incluirTopProductos.addEventListener('change', syncDesgloseState);
        syncDesgloseState();
    }

    // En modo histórico los selectores de mes/año no aplican (el rango lo calcula el servidor).
    var historicoChk = document.getElementById('historico');
    var periodoSelects = document.getElementById('periodoSelects');
    function syncHistorico() {
        if (!historicoChk || !periodoSelects) return;
        periodoSelects.querySelectorAll('select').forEach(function (s) {
            s.disabled = historicoChk.checked;
        });
    }
    if (historicoChk) {
        historicoChk.addEventListener('change', syncHistorico);
        syncHistorico();
    }

    form.addEventListener('submit', function (evt) {
        evt.preventDefault();
        var tenantId = tenantSelect.value;
        var esHistorico = !!(historicoChk && historicoChk.checked);

        var params = new URLSearchParams({ tenantId: tenantId });
        if (esHistorico) {
            params.set('historico', '1');
        } else {
            params.set('mesDesde', document.getElementById('mesDesde').value);
            params.set('anioDesde', document.getElementById('anioDesde').value);
            params.set('mesHasta', document.getElementById('mesHasta').value);
            params.set('anioHasta', document.getElementById('anioHasta').value);
        }

        if (tenantId !== 'all') {
            params.set('incluirResumenMensual', document.getElementById('incluirResumenMensual').checked ? '1' : '0');
            params.set('incluirTopProductos', incluirTopProductos.checked ? '1' : '0');
            params.set('incluirDesglosePorMes', incluirDesglosePorMes.checked ? '1' : '0');
        }

        var url = '/admin/reportes/exportar-pdf?' + params.toString();

        pollJobAndDownload(url, {
            onStart: function () {
                btn.disabled = true;
                label.textContent = 'Generando reporte...';
            },
            onDone: function () {
                btn.disabled = false;
                label.textContent = 'Generar y Descargar PDF';
            }
        });
    });
})();
