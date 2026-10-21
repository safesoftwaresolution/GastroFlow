/**
 * middleware/tenant.js con sucursales: cambio de contraseña obligatorio y bloqueo en cascada.
 */

jest.mock('../../../repositories/Admin/TenantRepository', () => ({
    getDefault: jest.fn(),
    findById: jest.fn()
}));
jest.mock('../../../repositories/Admin/AddonRepository', () => ({
    getByTenant: jest.fn().mockResolvedValue([])
}));

const TenantRepository = require('../../../repositories/Admin/TenantRepository');
const CacheService = require('../../../services/Shared/CacheService');
const { attachTenantContext } = require('../../../middleware/tenant');
const { getBloqueoPorPadre } = require('../../../utils/tenantMessages');

const createRes = () => {
    const res = { locals: {} };
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.redirect = jest.fn().mockReturnValue(res);
    res.render = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn();
    return res;
};

const usuario = (extra = {}) => ({
    id: 5,
    username: 'norte',
    rol: 'admin',
    roles: ['admin'],
    permisos: [],
    tenant_id: 2,
    debe_cambiar_password: false,
    ...extra
});

const ejecutar = async ({ xhr = false, ctx } = {}) => {
    CacheService.set('user:ctx:5', ctx, 45);
    const req = { user: { id: 5, rol: 'admin', tenant_id: 2 }, headers: {}, xhr, query: {}, baseUrl: '', path: '' };
    const res = createRes();
    const next = jest.fn();
    await attachTenantContext(req, res, next);
    return { req, res, next };
};

describe('middleware/tenant con sucursales', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        CacheService.clear();
    });

    describe('contraseña temporal', () => {
        it('redirige a cambiar la contraseña y no deja pasar (página)', async () => {
            const { res, next } = await ejecutar({ ctx: usuario({ debe_cambiar_password: true }) });
            expect(res.redirect).toHaveBeenCalledWith('/auth/cambiar-password?obligatorio=1');
            expect(next).not.toHaveBeenCalled();
            expect(TenantRepository.findById).not.toHaveBeenCalled();
        });

        it('responde 403 con redirect para peticiones JSON', async () => {
            const { res, next } = await ejecutar({ xhr: true, ctx: usuario({ debe_cambiar_password: true }) });
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ redirect: '/auth/cambiar-password?obligatorio=1' })
            );
            expect(next).not.toHaveBeenCalled();
        });

        it('deja pasar a quien ya la cambió', async () => {
            TenantRepository.findById.mockResolvedValue({ id: 2, nombre: 'Norte', activo: true, plan: null });
            const { next } = await ejecutar({ ctx: usuario() });
            expect(next).toHaveBeenCalled();
        });
    });

    describe('suspensión en cascada', () => {
        const hija = { id: 2, nombre: 'Norte', activo: true, tenant_padre_id: 1, plan: null };

        it('bloquea la sucursal activa si el padre está suspendido por pago', async () => {
            TenantRepository.findById.mockImplementation(async id =>
                id === 2 ? hija : { id: 1, nombre: 'Casa Matriz', activo: false, suspendido_por_pago: true }
            );
            const { res, next } = await ejecutar({ xhr: true, ctx: usuario() });
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json.mock.calls[0][0].error).toMatch(/Casa Matriz.*falta de pago/);
            expect(res.clearCookie).toHaveBeenCalledWith('auth_token');
            expect(next).not.toHaveBeenCalled();
        });

        it('deja operar a la sucursal si el padre está activo', async () => {
            TenantRepository.findById.mockImplementation(async id =>
                id === 2 ? hija : { id: 1, nombre: 'Casa Matriz', activo: true }
            );
            const { next } = await ejecutar({ ctx: usuario() });
            expect(next).toHaveBeenCalled();
        });
    });

    describe('getBloqueoPorPadre', () => {
        it('null para un tenant independiente (no consulta nada)', async () => {
            const buscar = jest.fn();
            await expect(getBloqueoPorPadre({ id: 1, tenant_padre_id: null }, buscar)).resolves.toBeNull();
            expect(buscar).not.toHaveBeenCalled();
        });

        it('el padre desactivado a mano y el padre inexistente también bloquean', async () => {
            const hijaX = { nombre: 'Norte', tenant_padre_id: 1 };
            await expect(getBloqueoPorPadre(hijaX, async () => ({ nombre: 'Matriz', activo: false }))).resolves.toMatch(
                /desactivada/
            );
            await expect(getBloqueoPorPadre(hijaX, async () => null)).resolves.toMatch(/no existe/);
        });
    });
});
