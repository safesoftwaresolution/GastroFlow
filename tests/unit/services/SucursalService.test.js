jest.mock('../../../repositories/Admin/SucursalRepository');
jest.mock('../../../services/Admin/Tenant/TenantSeederService');
jest.mock('../../../services/Admin/TenantAuditService');
jest.mock('../../../services/Shared/CacheService', () => ({ delete: jest.fn() }));

const SucursalRepository = require('../../../repositories/Admin/SucursalRepository');
const TenantSeederService = require('../../../services/Admin/Tenant/TenantSeederService');
const TenantAuditService = require('../../../services/Admin/TenantAuditService');
const CacheService = require('../../../services/Shared/CacheService');
const SucursalService = require('../../../services/Shared/SucursalService');

const admin = { username: 'norte.admin', password: 'clave1234', email: 'norte@x.co', nombre_completo: 'Ana' };
const datos = { padreId: 1, creadoPorUsuarioId: 9, nombre: 'Sede Norte', admin };
const padre = { id: 1, activo: 1, plan_id: 3, tenant_padre_id: null, max_sucursales: 2 };

describe('SucursalService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        SucursalRepository.obtenerTenant.mockResolvedValue(padre);
        SucursalRepository.usernameExiste.mockResolvedValue(false);
        SucursalRepository.slugExiste.mockResolvedValue(false);
        SucursalRepository.crearConAdmin.mockResolvedValue({ tenantId: 7, usuarioId: 11 });
        TenantSeederService.seedInitialData.mockResolvedValue();
    });

    describe('crear', () => {
        it('crea la sucursal heredando el plan del padre y hashea la contraseña', async () => {
            const res = await SucursalService.crear(datos);
            const arg = SucursalRepository.crearConAdmin.mock.calls[0][0];
            expect(res).toEqual({ id: 7, slug: 'sede-norte', admin_id: 11 });
            expect(arg.padreId).toBe(1);
            expect(arg.aplicarLimite).toBe(true);
            expect(arg.sucursal.plan_id).toBe(3);
            expect(arg.sucursal.creado_por_usuario_id).toBe(9);
            expect(arg.admin.passwordHash).toMatch(/^\$2[aby]\$/);
            expect(arg.admin.password).toBe('clave1234'); // se conserva solo en memoria, no se persiste
            expect(TenantSeederService.seedInitialData).toHaveBeenCalledWith(7);
        });

        it('un tenant no puede elegir plan; el superadmin sí y sin tope de sucursales', async () => {
            await SucursalService.crear({ ...datos, plan_id: 5 });
            expect(SucursalRepository.crearConAdmin.mock.calls[0][0].sucursal.plan_id).toBe(3);

            await SucursalService.crear({ ...datos, esSuperadmin: true, plan_id: '5' });
            const arg = SucursalRepository.crearConAdmin.mock.calls[1][0];
            expect(arg.sucursal.plan_id).toBe(5);
            expect(arg.aplicarLimite).toBe(false);
        });

        it('rechaza que una sucursal cree sucursales', async () => {
            SucursalRepository.obtenerTenant.mockResolvedValue({ ...padre, tenant_padre_id: 4 });
            await expect(SucursalService.crear(datos)).rejects.toMatchObject({ status: 403 });
            expect(SucursalRepository.crearConAdmin).not.toHaveBeenCalled();
        });

        it('rechaza al tenant sin cupo habilitado, pero no al superadmin', async () => {
            SucursalRepository.obtenerTenant.mockResolvedValue({ ...padre, max_sucursales: 0 });
            await expect(SucursalService.crear(datos)).rejects.toMatchObject({ status: 403 });
            await expect(SucursalService.crear({ ...datos, esSuperadmin: true })).resolves.toBeDefined();
        });

        it('rechaza un username ya usado (único global)', async () => {
            SucursalRepository.usernameExiste.mockResolvedValue(true);
            await expect(SucursalService.crear(datos)).rejects.toMatchObject({ status: 409 });
        });

        it('genera un slug libre cuando el base ya existe', async () => {
            SucursalRepository.slugExiste.mockResolvedValueOnce(true).mockResolvedValue(false);
            const res = await SucursalService.crear({ ...datos, nombre: 'Sede Ñandú' });
            expect(res.slug).toBe('sede-nandu-2');
        });

        it('no deshace la sucursal si falla el sembrado inicial', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
            TenantSeederService.seedInitialData.mockRejectedValue(new Error('boom'));
            await expect(SucursalService.crear(datos)).resolves.toMatchObject({ id: 7 });
            spy.mockRestore();
        });

        it.each([
            [{ nombre: '  ' }, /nombre de la sucursal/],
            [{ admin: { ...admin, username: 'ab' } }, /usuario/],
            [{ admin: { ...admin, password: 'corta' } }, /8 caracteres/],
            [{ admin: { ...admin, email: 'sin-arroba' } }, /correo/]
        ])('valida la entrada %#', async (cambio, mensaje) => {
            await expect(SucursalService.crear({ ...datos, ...cambio })).rejects.toThrow(mensaje);
            expect(SucursalRepository.crearConAdmin).not.toHaveBeenCalled();
        });
    });

    describe('auditoría', () => {
        it('registra la creación bajo el padre', async () => {
            await SucursalService.crear(datos);
            expect(TenantAuditService.log).toHaveBeenCalledWith(
                expect.objectContaining({ tenantId: 1, userId: 9, accion: 'sucursal_creada' })
            );
        });

        it('un fallo al auditar no tumba la operación', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
            TenantAuditService.log.mockRejectedValue(new Error('db'));
            await expect(SucursalService.crear(datos)).resolves.toMatchObject({ id: 7 });
            spy.mockRestore();
        });
    });

    describe('cambiarEstado', () => {
        const propia = { id: 7, nombre: 'Norte', activo: 1, suspendido_por_pago: 0 };

        it('desactiva una sucursal propia, invalida el caché y audita', async () => {
            SucursalRepository.obtenerSucursalDelPadre.mockResolvedValue(propia);
            await expect(
                SucursalService.cambiarEstado({ padreId: 1, sucursalId: 7, activo: false, userId: 9 })
            ).resolves.toEqual({ activo: false });
            expect(SucursalRepository.fijarActivo).toHaveBeenCalledWith(7, 1, false);
            expect(CacheService.delete).toHaveBeenCalledWith('tenant:7');
            expect(TenantAuditService.log).toHaveBeenCalledWith(
                expect.objectContaining({ tenantId: 1, accion: 'sucursal_desactivada' })
            );
        });

        it('404 si la sucursal no es de ese padre (no toca nada)', async () => {
            SucursalRepository.obtenerSucursalDelPadre.mockResolvedValue(null);
            await expect(
                SucursalService.cambiarEstado({ padreId: 1, sucursalId: 99, activo: false })
            ).rejects.toMatchObject({ status: 404 });
            expect(SucursalRepository.fijarActivo).not.toHaveBeenCalled();
        });

        it('no reactiva a mano una sucursal suspendida por pago', async () => {
            SucursalRepository.obtenerSucursalDelPadre.mockResolvedValue({
                ...propia,
                activo: 0,
                suspendido_por_pago: 1
            });
            await expect(
                SucursalService.cambiarEstado({ padreId: 1, sucursalId: 7, activo: true })
            ).rejects.toMatchObject({ status: 409 });
            expect(SucursalRepository.fijarActivo).not.toHaveBeenCalled();
        });
    });

    describe('resetearPasswordAdmin', () => {
        it('guarda un hash (obliga a cambiarla) e invalida el contexto del usuario', async () => {
            SucursalRepository.obtenerSucursalDelPadre.mockResolvedValue({ id: 7 });
            SucursalRepository.adminPrincipalId.mockResolvedValue(11);
            await SucursalService.resetearPasswordAdmin({
                padreId: 1,
                sucursalId: 7,
                password: 'temporal123',
                userId: 9
            });
            const [usuarioId, sucursalId, hash] = SucursalRepository.resetearPassword.mock.calls[0];
            expect([usuarioId, sucursalId]).toEqual([11, 7]);
            expect(hash).toMatch(/^\$2[aby]\$/);
            expect(hash).not.toContain('temporal123');
            expect(CacheService.delete).toHaveBeenCalledWith('user:ctx:11');
            expect(TenantAuditService.log).toHaveBeenCalledWith(
                expect.objectContaining({ accion: 'sucursal_password_reset' })
            );
        });

        it('rechaza una contraseña corta y una sucursal ajena', async () => {
            await expect(
                SucursalService.resetearPasswordAdmin({ padreId: 1, sucursalId: 7, password: 'corta' })
            ).rejects.toMatchObject({ status: 400 });
            SucursalRepository.obtenerSucursalDelPadre.mockResolvedValue(null);
            await expect(
                SucursalService.resetearPasswordAdmin({ padreId: 1, sucursalId: 99, password: 'temporal123' })
            ).rejects.toMatchObject({ status: 404 });
            expect(SucursalRepository.resetearPassword).not.toHaveBeenCalled();
        });
    });

    describe('validarEntrada', () => {
        it('deja entrar a una sucursal propia activa y audita el acceso', async () => {
            SucursalRepository.obtenerSucursalDelPadre.mockResolvedValue({ id: 7, nombre: 'Norte', activo: 1 });
            await expect(SucursalService.validarEntrada({ padreId: 1, sucursalId: 7, userId: 9 })).resolves.toEqual({
                id: 7,
                nombre: 'Norte'
            });
            expect(TenantAuditService.log).toHaveBeenCalledWith(
                expect.objectContaining({ tenantId: 1, userId: 9, accion: 'sucursal_acceso' })
            );
        });

        it('404 si la sucursal no es de ese padre', async () => {
            SucursalRepository.obtenerSucursalDelPadre.mockResolvedValue(null);
            await expect(SucursalService.validarEntrada({ padreId: 1, sucursalId: 99 })).rejects.toMatchObject({
                status: 404
            });
            expect(TenantAuditService.log).not.toHaveBeenCalled();
        });

        it('409 si está desactivada o suspendida por pago', async () => {
            SucursalRepository.obtenerSucursalDelPadre.mockResolvedValue({ id: 7, activo: 0, suspendido_por_pago: 0 });
            await expect(SucursalService.validarEntrada({ padreId: 1, sucursalId: 7 })).rejects.toMatchObject({
                status: 409,
                message: expect.stringMatching(/desactivada/)
            });
            SucursalRepository.obtenerSucursalDelPadre.mockResolvedValue({ id: 7, activo: 0, suspendido_por_pago: 1 });
            await expect(SucursalService.validarEntrada({ padreId: 1, sucursalId: 7 })).rejects.toMatchObject({
                message: expect.stringMatching(/falta de pago/)
            });
        });
    });

    describe('fijarLimite', () => {
        it('guarda el límite e invalida el caché del tenant', async () => {
            SucursalRepository.fijarLimite.mockResolvedValue(1);
            await expect(SucursalService.fijarLimite(4, '3')).resolves.toBe(3);
            expect(CacheService.delete).toHaveBeenCalledWith('tenant:4');
        });

        it.each([-1, 101, 'x', 1.5])('rechaza el límite %p', async valor => {
            await expect(SucursalService.fijarLimite(4, valor)).rejects.toMatchObject({ status: 400 });
        });

        it('404 si el tenant no existe o es una sucursal', async () => {
            SucursalRepository.fijarLimite.mockResolvedValue(0);
            await expect(SucursalService.fijarLimite(4, 2)).rejects.toMatchObject({ status: 404 });
        });
    });
});
