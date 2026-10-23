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

const ejecutar = async ({ xhr = false, ctx, tokenTenant = 2 } = {}) => {
    CacheService.set('user:ctx:5', ctx, 45);
    const req = {
        user: { id: 5, rol: 'admin', tenant_id: tokenTenant },
        headers: {},
        xhr,
        query: {},
        baseUrl: '',
        path: ''
    };
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

    describe('contexto de sucursal (dueño entra a una sucursal con su mismo usuario)', () => {
        // Usuario de la BD: pertenece al restaurante 1 (padre). El token dice tenant 2 (la sucursal).
        const dueno = (extra = {}) =>
            usuario({ tenant_id: 1, permisos: ['productos.ver', 'analitica.ver', 'facturacion.ver'], ...extra });
        const padre = {
            id: 1,
            nombre: 'Matriz',
            activo: true,
            tenant_padre_id: null,
            plan: { slug: 'premium', caracteristicas: [] }
        };
        const hija = (extra = {}) => ({
            id: 2,
            nombre: 'Norte',
            activo: true,
            tenant_padre_id: 1,
            plan: { slug: 'basico', nombre: 'Basico', caracteristicas: ['productos'] },
            ...extra
        });
        const repo = (...tenants) =>
            TenantRepository.findById.mockImplementation(async id => tenants.find(t => t.id === id) || null);

        it('permite operar la sucursal hija y marca el contexto', async () => {
            repo(padre, hija());
            const { req, res, next } = await ejecutar({ ctx: dueno() });
            expect(next).toHaveBeenCalled();
            expect(req.tenant.id).toBe(2);
            expect(req.contextoSucursal).toEqual({ principalNombre: 'Matriz' });
            expect(res.locals.contextoSucursal).toEqual({ nombre: 'Norte', principalNombre: 'Matriz' });
        });

        it('en la sucursal solo valen los permisos de módulos de SU plan', async () => {
            repo(padre, hija());
            const { req } = await ejecutar({ ctx: dueno() });
            // analitica no está en el plan de la sucursal; productos y facturacion.ver (sin módulo) sí
            expect(req.user.permisos).toEqual(['productos.ver', 'facturacion.ver']);
        });

        it('no muta el arreglo de permisos cacheado del usuario', async () => {
            repo(padre, hija());
            const ctx = dueno();
            await ejecutar({ ctx });
            expect(ctx.permisos).toEqual(['productos.ver', 'analitica.ver', 'facturacion.ver']);
        });

        it('rechaza un tenant que no es hijo del restaurante del usuario (JSON)', async () => {
            const ajena = hija({ tenant_padre_id: 99 });
            repo(padre, ajena);
            const { res, next } = await ejecutar({ xhr: true, ctx: dueno() });
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.clearCookie).toHaveBeenCalledWith('auth_token');
            expect(next).not.toHaveBeenCalled();
        });

        it('rechaza un tenant independiente distinto al propio (redirect a login)', async () => {
            repo(padre, { id: 2, nombre: 'Otro', activo: true, tenant_padre_id: null, plan: null });
            const { res, next } = await ejecutar({ ctx: dueno() });
            expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('/auth/login?mensaje='));
            expect(next).not.toHaveBeenCalled();
        });

        it('sin contexto (token = tenant propio) no marca contexto ni filtra permisos', async () => {
            repo(padre);
            const { req, res, next } = await ejecutar({ ctx: dueno(), tokenTenant: 1 });
            expect(next).toHaveBeenCalled();
            expect(req.contextoSucursal).toBeUndefined();
            expect(res.locals.contextoSucursal).toBeUndefined();
            expect(req.user.permisos).toContain('analitica.ver');
        });

        it('la sucursal desactivada sigue bloqueada aunque entre el dueño', async () => {
            repo(padre, hija({ activo: false }));
            const { res, next } = await ejecutar({ xhr: true, ctx: dueno() });
            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });
    });
});
