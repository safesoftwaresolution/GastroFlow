/**
 * Tests unitarios para services/Tenant/RecetaService.js: los insumos de los ingredientes
 * deben ser del tenant (repositorios y TenantOwnership mockeados).
 */

jest.mock('../../../repositories/Tenant/RecetaRepository', () => ({
    findById: jest.fn(),
    findByProductoId: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    setIngredientes: jest.fn()
}));
jest.mock('../../../repositories/Tenant/ProductRepository', () => ({ findById: jest.fn() }));
jest.mock('../../../services/Tenant/TenantOwnership', () => ({ insumos: jest.fn().mockResolvedValue() }));

const RecetaRepository = require('../../../repositories/Tenant/RecetaRepository');
const ProductRepository = require('../../../repositories/Tenant/ProductRepository');
const TenantOwnership = require('../../../services/Tenant/TenantOwnership');
const RecetaService = require('../../../services/Tenant/RecetaService');

describe('RecetaService - ownership de insumos', () => {
    beforeEach(() => jest.clearAllMocks());

    it('create valida los insumo_id contra el tenant antes de guardar ingredientes', async () => {
        ProductRepository.findById.mockResolvedValue({ id: 1 });
        RecetaRepository.findByProductoId.mockResolvedValue(null);
        RecetaRepository.create.mockResolvedValue(9);

        const ingredientes = [
            { insumo_id: 4, cantidad: 1 },
            { insumo_id: 6, cantidad: 2 }
        ];
        await RecetaService.create(1, { producto_id: 1, nombre_receta: 'R', ingredientes });

        expect(TenantOwnership.insumos).toHaveBeenCalledWith(1, [4, 6]);
        expect(RecetaRepository.setIngredientes).toHaveBeenCalledWith(9, ingredientes);
    });

    it('create no guarda ingredientes si un insumo es de otro tenant', async () => {
        ProductRepository.findById.mockResolvedValue({ id: 1 });
        RecetaRepository.findByProductoId.mockResolvedValue(null);
        RecetaRepository.create.mockResolvedValue(9);
        TenantOwnership.insumos.mockRejectedValueOnce(new Error('Insumo no encontrado'));

        await expect(
            RecetaService.create(1, { producto_id: 1, nombre_receta: 'R', ingredientes: [{ insumo_id: 999 }] })
        ).rejects.toThrow('Insumo no encontrado');
        expect(RecetaRepository.setIngredientes).not.toHaveBeenCalled();
    });

    it('update valida los insumo_id y no toca la receta si alguno es ajeno', async () => {
        RecetaRepository.findById.mockResolvedValue({ id: 3, nombre_receta: 'R', porciones: 1 });
        TenantOwnership.insumos.mockRejectedValueOnce(new Error('Insumo no encontrado'));

        await expect(RecetaService.update(3, 1, { ingredientes: [{ insumo_id: 999 }] })).rejects.toThrow(
            'Insumo no encontrado'
        );
        expect(RecetaRepository.update).not.toHaveBeenCalled();
        expect(RecetaRepository.setIngredientes).not.toHaveBeenCalled();
    });
});
