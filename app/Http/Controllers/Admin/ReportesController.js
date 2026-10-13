const TenantService = require('../../../../services/Admin/TenantService');
const JobQueueRepository = require('../../../../repositories/Shared/JobQueueRepository');

class ReportesController {
    // GET /admin/reportes
    static async index(req, res) {
        try {
            const allTenants = await TenantService.getAllTenants();
            const activeTenants = (allTenants || []).filter(t => t.activo);

            res.render('admin/reportes', {
                user: req.user,
                tenants: activeTenants,
                currentAdminPage: 'reportes'
            });
        } catch (error) {
            console.error('Error al cargar la sección de reportes:', error);
            res.status(500).render('errors/internal', { error });
        }
    }

    // GET /admin/reportes/exportar-pdf - encola la generación (puppeteer es pesado,
    // no debe bloquear el request). El frontend hace polling a /admin/jobs/:id y
    // descarga desde /admin/jobs/:id/download cuando el worker termina.
    static async exportPdf(req, res) {
        try {
            const {
                tenantId,
                mesDesde,
                anioDesde,
                mesHasta,
                anioHasta,
                historico,
                incluirResumenMensual,
                incluirTopProductos,
                incluirDesglosePorMes
            } = req.query;
            const esHistorico = historico === '1' || historico === 'true';

            if (!esHistorico && (!mesDesde || !anioDesde)) {
                return res.status(400).json({ error: 'Mes y año iniciales son requeridos.' });
            }

            // En modo histórico el rango real lo calcula el servicio (primera venta -> hoy);
            // estos valores solo pasan la validación.
            const hoy = new Date();
            const mesDesdeInt = esHistorico ? hoy.getMonth() + 1 : parseInt(mesDesde, 10);
            const anioDesdeInt = esHistorico ? hoy.getFullYear() : parseInt(anioDesde, 10);
            const mesHastaInt = mesHasta && !esHistorico ? parseInt(mesHasta, 10) : mesDesdeInt;
            const anioHastaInt = anioHasta && !esHistorico ? parseInt(anioHasta, 10) : anioDesdeInt;

            if (isNaN(mesDesdeInt) || mesDesdeInt < 1 || mesDesdeInt > 12) {
                return res.status(400).json({ error: 'Mes inicial inválido.' });
            }
            if (isNaN(mesHastaInt) || mesHastaInt < 1 || mesHastaInt > 12) {
                return res.status(400).json({ error: 'Mes final inválido.' });
            }
            if (isNaN(anioDesdeInt) || anioDesdeInt < 2000 || anioDesdeInt > 2100) {
                return res.status(400).json({ error: 'Año inicial inválido.' });
            }
            if (isNaN(anioHastaInt) || anioHastaInt < 2000 || anioHastaInt > 2100) {
                return res.status(400).json({ error: 'Año final inválido.' });
            }

            let tenantIdVal = 'all';
            if (tenantId && tenantId !== 'all') {
                const tenantIdInt = parseInt(tenantId, 10);
                if (isNaN(tenantIdInt)) {
                    return res.status(400).json({ error: 'Restaurante inválido.' });
                }
                tenantIdVal = tenantIdInt;
            }

            const jobId = await JobQueueRepository.encolar('pdf_reporte_consolidado', {
                tenantId: tenantIdVal,
                mesDesde: mesDesdeInt,
                anioDesde: anioDesdeInt,
                mesHasta: mesHastaInt,
                anioHasta: anioHastaInt,
                historico: esHistorico,
                incluirResumenMensual,
                incluirTopProductos,
                incluirDesglosePorMes
            });
            res.json({ jobId });
        } catch (error) {
            console.error('[PDF_CONSOLIDADO_EXPORT_ERROR]:', error);
            res.status(500).json({ error: 'Error al encolar la generación del reporte consolidado.' });
        }
    }
}

module.exports = ReportesController;
