const ProductoAdminService = require('../../../../services/Admin/ProductoAdminService');

class ProductosController {
    // GET /admin/productos
    static async index(req, res) {
        try {
            const filtros = {
                tenantId: req.query.tenantId ? Number(req.query.tenantId) : null,
                estado: ['activo', 'inactivo'].includes(req.query.estado) ? req.query.estado : null,
                q: (req.query.q || '').trim() || null
            };
            const page = Number.parseInt(req.query.page, 10) || 1;

            const data = await ProductoAdminService.listar(filtros, page);

            res.render('admin/productos/index', {
                user: req.user,
                ...data,
                filtros
            });
        } catch (error) {
            console.error('Error al cargar catálogo de productos (admin):', error);
            res.status(500).render('errors/internal', { error });
        }
    }

    // GET /admin/productos/:id - Detalle + historial de auditoría (para el modal)
    static async show(req, res) {
        try {
            const id = Number.parseInt(req.params.id, 10);
            if (!id) {
                return res.status(400).json({ error: 'ID inválido' });
            }
            const data = await ProductoAdminService.getDetalle(id);
            res.json(data);
        } catch (error) {
            console.error('Error al cargar detalle de producto (admin):', error);
            res.status(error.message === 'Producto no encontrado' ? 404 : 500).json({ error: error.message });
        }
    }
}

module.exports = ProductosController;
