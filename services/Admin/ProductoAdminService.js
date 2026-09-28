const ProductoAdminRepository = require('../../repositories/Admin/ProductoAdminRepository');
const ProductoAuditoriaRepository = require('../../repositories/Tenant/ProductoAuditoriaRepository');
const TenantService = require('./TenantService');
const { toFechaISOUtc } = require('../../utils/dateHelpers');

class ProductoAdminService {
    static async listar(filtros, page) {
        const [productos, total, tenants] = await Promise.all([
            ProductoAdminRepository.findAll(filtros, page),
            ProductoAdminRepository.count(filtros),
            TenantService.getAllTenants()
        ]);

        // Normaliza a ISO UTC explícito: en dev, mysql2 devuelve string sin
        // zona; en prod, Date "local" del server (Railway corre en UTC). Sin
        // esto, formatear con toLocaleString() usa la hora del servidor, no
        // la de Colombia (bug reportado: la tabla mostraba ~4-5h adelantada).
        productos.forEach(p => {
            p.updated_at_iso = toFechaISOUtc(p.updated_at);
            p.created_at_iso = toFechaISOUtc(p.created_at);
        });

        return {
            productos,
            tenants,
            total,
            page: Math.max(page, 1),
            totalPaginas: Math.max(1, Math.ceil(total / ProductoAdminRepository.PAGE_SIZE))
        };
    }

    static async getDetalle(id) {
        const producto = await ProductoAdminRepository.findById(id);
        if (!producto) {
            throw new Error('Producto no encontrado');
        }
        producto.created_at_iso = toFechaISOUtc(producto.created_at);
        producto.updated_at_iso = toFechaISOUtc(producto.updated_at);

        const auditoria = await ProductoAuditoriaRepository.findByProducto(id);
        auditoria.forEach(ev => {
            ev.created_at_iso = toFechaISOUtc(ev.created_at);
        });

        return { producto, auditoria };
    }
}

module.exports = ProductoAdminService;
