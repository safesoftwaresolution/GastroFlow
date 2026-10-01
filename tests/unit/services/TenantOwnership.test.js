/**
 * Tests unitarios para services/Tenant/TenantOwnership.js (db mockeada)
 */

jest.mock('../../../config/database', () => ({ query: jest.fn() }));

const db = require('../../../config/database');
const TenantOwnership = require('../../../services/Tenant/TenantOwnership');

describe('TenantOwnership', () => {
    beforeEach(() => jest.clearAllMocks());

    it('acepta ids que pertenecen al tenant y consulta con tenant_id', async () => {
        db.query.mockResolvedValue([[{ id: 3 }, { id: 5 }]]);
        await expect(TenantOwnership.clientes(1, [3, 5, 3])).resolves.toBeUndefined();
        expect(db.query).toHaveBeenCalledWith('SELECT id FROM clientes WHERE tenant_id = ? AND id IN (?)', [1, [3, 5]]);
    });

    it('rechaza si algún id no es del tenant', async () => {
        db.query.mockResolvedValue([[{ id: 3 }]]);
        await expect(TenantOwnership.productos(1, [3, 99])).rejects.toThrow('Producto no encontrado');
    });

    it('ignora null, undefined y vacío (campos opcionales) sin consultar la BD', async () => {
        await TenantOwnership.eventos(1, null);
        await TenantOwnership.servicios(1, undefined);
        await TenantOwnership.insumos(1, ['', null]);
        expect(db.query).not.toHaveBeenCalled();
    });

    it('rechaza ids no enteros o no positivos sin consultar la BD', async () => {
        await expect(TenantOwnership.clientes(1, '1; DROP TABLE x')).rejects.toThrow('Cliente inválido');
        await expect(TenantOwnership.clientes(1, -4)).rejects.toThrow('Cliente inválido');
        await expect(TenantOwnership.clientes(1, 1.5)).rejects.toThrow('Cliente inválido');
        expect(db.query).not.toHaveBeenCalled();
    });

    it('acepta un id suelto además de un arreglo', async () => {
        db.query.mockResolvedValue([[{ id: 8 }]]);
        await expect(TenantOwnership.insumos(2, 8)).resolves.toBeUndefined();
        expect(db.query).toHaveBeenCalledWith('SELECT id FROM insumos WHERE tenant_id = ? AND id IN (?)', [2, [8]]);
    });
});
