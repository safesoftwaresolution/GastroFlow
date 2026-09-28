const ProductoAdminRepository = require('../../repositories/Admin/ProductoAdminRepository');
const ProductoAuditoriaRepository = require('../../repositories/Tenant/ProductoAuditoriaRepository');
const TenantService = require('./TenantService');

class ProductoAdminService {
    static async listar(filtros, page) {
        const [productos, total, tenants] = await Promise.all([
            ProductoAdminRepository.findAll(filtros, page),
            ProductoAdminRepository.count(filtros),
            TenantService.getAllTenants()
        ]);

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
        const auditoria = await ProductoAuditoriaRepository.findByProducto(id);
        return { producto, auditoria };
    }
}

module.exports = ProductoAdminService;
