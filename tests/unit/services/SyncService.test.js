/**
 * Tests unitarios para services/Tenant/SyncService.js (repositorios y servicios de mesas mockeados)
 */

jest.mock('../../../repositories/Tenant/SyncRepository', () => ({
    findLoggedOperation: jest.fn().mockResolvedValue(null),
    logOperation: jest.fn().mockResolvedValue(),
    findTenantRow: jest.fn(),
    findAll: jest.fn().mockResolvedValue([]),
    findChanged: jest.fn().mockResolvedValue([]),
    findChangedByTenant: jest.fn().mockResolvedValue([]),
    findAllByTenant: jest.fn().mockResolvedValue([]),
    serverNow: jest.fn().mockResolvedValue('2026-01-01 00:00:00')
}));
jest.mock('../../../services/Tenant/Mesas/AbrirPedidoService', () => ({ execute: jest.fn() }));
jest.mock('../../../services/Tenant/Mesas/AgregarItemService', () => ({ execute: jest.fn() }));
jest.mock('../../../services/Tenant/Mesas/AgregarServicioService', () => ({ execute: jest.fn() }));
jest.mock('../../../services/Tenant/Mesas/UpdateItemCantidadService', () => ({ execute: jest.fn() }));
jest.mock('../../../services/Tenant/Mesas/EliminarItemService', () => ({ execute: jest.fn() }));
jest.mock('../../../services/Tenant/Mesas/UpdatePropinaService', () => ({ execute: jest.fn() }));

const SyncRepository = require('../../../repositories/Tenant/SyncRepository');
const UpdatePropinaService = require('../../../services/Tenant/Mesas/UpdatePropinaService');
const SyncService = require('../../../services/Tenant/SyncService');

describe('SyncService', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('push', () => {
        it('params.tenantId del cliente no puede sustituir al tenant autenticado', async () => {
            UpdatePropinaService.execute.mockResolvedValue({ id: 10 });
            SyncRepository.findLoggedOperation.mockResolvedValue(null);

            const [result] = await SyncService.push(1, [
                {
                    clientUuid: 'u1',
                    action: 'pedidos.actualizar_propina',
                    params: { tenantId: 2, pedidoId: 50, propina: 9 }
                }
            ]);

            expect(result.status).toBe('applied');
            expect(UpdatePropinaService.execute).toHaveBeenCalledWith({ tenantId: 1, pedidoId: 50, propina: 9 });
            expect(SyncRepository.logOperation).toHaveBeenCalledWith(
                1,
                'u1',
                'pedidos.actualizar_propina',
                'applied',
                10
            );
        });
    });

    describe('pull', () => {
        it('no expone wompi_payment_source_id ni tokens de verificación', async () => {
            SyncRepository.findTenantRow.mockResolvedValue([
                { id: 1, nombre: 'T', wompi_payment_source_id: 'src_secret' }
            ]);
            SyncRepository.findChangedByTenant.mockImplementation(async table =>
                table === 'usuarios'
                    ? [
                          {
                              id: 3,
                              username: 'admin',
                              password_hash: 'hash',
                              verificacion_token_hash: 'tok',
                              verificacion_token_expira: '2026-01-01'
                          }
                      ]
                    : []
            );

            const data = await SyncService.pull(1, null);

            expect(data.tenants[0]).toEqual({ id: 1, nombre: 'T' });
            expect(data.usuarios[0]).toEqual({ id: 3, username: 'admin', password_hash: 'hash' });
        });
    });
});
