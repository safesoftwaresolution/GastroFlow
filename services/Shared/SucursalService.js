const bcrypt = require('bcrypt');
const SucursalRepository = require('../../repositories/Admin/SucursalRepository');
const TenantSeederService = require('../Admin/Tenant/TenantSeederService');
const TenantAuditService = require('../Admin/TenantAuditService');
const CacheService = require('./CacheService');

const error = (mensaje, status = 400) => Object.assign(new Error(mensaje), { status });

// Los registros de auditoría se guardan bajo el padre: sobreviven aunque se elimine la sucursal.
// Un fallo al auditar nunca debe tumbar la operación ya hecha.
async function auditar(tenantId, userId, accion, detalles) {
    try {
        await TenantAuditService.log({ tenantId, userId, accion, detalles });
    } catch (e) {
        console.error(`No se pudo auditar ${accion}:`, e.message);
    }
}

function validarPassword(password) {
    if (String(password ?? '').length < 8) {
        throw error('La contraseña debe tener al menos 8 caracteres');
    }
    return String(password);
}

const texto = (v, max) => (v === undefined || v === null ? '' : String(v).trim().slice(0, max));

function slugificar(nombre) {
    const base = String(nombre)
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
    return base || 'sucursal';
}

async function slugDisponible(nombre) {
    const base = slugificar(nombre);
    for (let i = 1; i <= 20; i++) {
        const candidato = i === 1 ? base : `${base}-${i}`;
        if (!(await SucursalRepository.slugExiste(candidato))) {
            return candidato;
        }
    }
    return `${base}-${Date.now().toString(36)}`;
}

function validarAdmin(admin) {
    const username = texto(admin?.username, 50);
    const email = texto(admin?.email, 100);
    if (!/^[a-zA-Z0-9._-]{4,30}$/.test(username)) {
        throw error('El usuario debe tener entre 4 y 30 caracteres (letras, números, punto, guion)');
    }
    const password = validarPassword(admin?.password);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw error('El correo del administrador no es válido');
    }
    return { username, password, email, nombre_completo: texto(admin?.nombre_completo, 100) || null };
}

class SucursalService {
    /**
     * Crea una sucursal (tenant hijo) con su usuario administrador.
     * - Tenant: padreId sale SIEMPRE de la sesión, se aplica el límite max_sucursales y la
     *   sucursal hereda el plan del padre.
     * - Superadmin (esSuperadmin): puede elegir padre y plan, sin tope de sucursales.
     */
    static async crear({ padreId, creadoPorUsuarioId = null, esSuperadmin = false, plan_id, ...datos }) {
        const nombre = texto(datos.nombre, 100);
        if (!nombre) {
            throw error('El nombre de la sucursal es obligatorio');
        }
        const admin = validarAdmin(datos.admin);

        const padre = await SucursalRepository.obtenerTenant(padreId);
        if (!padre) {
            throw error('Restaurante no encontrado', 404);
        }
        if (padre.tenant_padre_id !== null) {
            throw error('Una sucursal no puede tener sucursales', 403);
        }
        if (!padre.activo) {
            throw error('El restaurante está inactivo', 403);
        }
        if (!esSuperadmin && Number(padre.max_sucursales) <= 0) {
            throw error('Tu plan no incluye sucursales. Contacta a soporte para habilitarlas.', 403);
        }
        if (await SucursalRepository.usernameExiste(admin.username)) {
            throw error('Ya existe un usuario con ese nombre de usuario', 409);
        }

        const planElegido = esSuperadmin && plan_id ? Number.parseInt(plan_id, 10) : null;
        const slug = await slugDisponible(nombre);
        const passwordHash = await bcrypt.hash(admin.password, 10);

        const { tenantId, usuarioId } = await SucursalRepository.crearConAdmin({
            padreId,
            aplicarLimite: !esSuperadmin,
            sucursal: {
                nombre,
                slug,
                plan_id: Number.isInteger(planElegido) ? planElegido : padre.plan_id,
                ciudad: texto(datos.ciudad, 100) || null,
                direccion: texto(datos.direccion, 255) || null,
                telefono: texto(datos.telefono, 30) || null,
                creado_por_usuario_id: creadoPorUsuarioId
            },
            admin: { ...admin, passwordHash }
        });

        // Igual que TenantCRUDService.createTenant: un fallo del sembrado no deshace la sucursal.
        try {
            await TenantSeederService.seedInitialData(tenantId);
        } catch (e) {
            console.error(`Error al sembrar datos iniciales de la sucursal ${tenantId}:`, e.message);
        }

        await auditar(
            padreId,
            creadoPorUsuarioId,
            'sucursal_creada',
            `sucursal_id=${tenantId} slug=${slug} admin=${admin.username}`
        );

        return { id: tenantId, slug, admin_id: usuarioId };
    }

    /**
     * El padre activa o desactiva una de SUS sucursales. Una sucursal suspendida por falta de
     * pago no se reactiva a mano: se reactiva sola al regularizar el cobro.
     */
    static async cambiarEstado({ padreId, sucursalId, activo, userId = null }) {
        const sucursal = await SucursalRepository.obtenerSucursalDelPadre(padreId, sucursalId);
        if (!sucursal) {
            throw error('Sucursal no encontrada', 404);
        }
        if (activo && sucursal.suspendido_por_pago) {
            throw error('La sucursal está suspendida por falta de pago y no se puede reactivar manualmente', 409);
        }
        await SucursalRepository.fijarActivo(sucursalId, padreId, activo);
        CacheService.delete(`tenant:${sucursalId}`);
        await auditar(
            padreId,
            userId,
            activo ? 'sucursal_activada' : 'sucursal_desactivada',
            `sucursal_id=${sucursalId}`
        );
        return { activo: Boolean(activo) };
    }

    /**
     * Valida que el padre pueda entrar a esa sucursal con su propio usuario (cambio de contexto).
     * No emite el token: eso lo hace el controlador.
     */
    static async validarEntrada({ padreId, sucursalId, userId = null }) {
        const sucursal = await SucursalRepository.obtenerSucursalDelPadre(padreId, sucursalId);
        if (!sucursal) {
            throw error('Sucursal no encontrada', 404);
        }
        if (!sucursal.activo) {
            throw error(
                sucursal.suspendido_por_pago
                    ? 'La sucursal está suspendida por falta de pago'
                    : 'La sucursal está desactivada. Actívala para entrar.',
                409
            );
        }
        await auditar(padreId, userId, 'sucursal_acceso', `sucursal_id=${sucursalId}`);
        return { id: sucursal.id, nombre: sucursal.nombre };
    }

    /**
     * El padre define una contraseña temporal para el administrador de una de sus sucursales.
     * Queda obligado a cambiarla en su próximo ingreso.
     */
    static async resetearPasswordAdmin({ padreId, sucursalId, password, userId = null }) {
        const nueva = validarPassword(password);
        const sucursal = await SucursalRepository.obtenerSucursalDelPadre(padreId, sucursalId);
        if (!sucursal) {
            throw error('Sucursal no encontrada', 404);
        }
        const adminId = await SucursalRepository.adminPrincipalId(sucursalId);
        if (!adminId) {
            throw error('La sucursal no tiene administrador', 404);
        }
        await SucursalRepository.resetearPassword(adminId, sucursalId, await bcrypt.hash(nueva, 10));
        CacheService.delete(`user:ctx:${adminId}`);
        await auditar(padreId, userId, 'sucursal_password_reset', `sucursal_id=${sucursalId} usuario_id=${adminId}`);
    }

    static async listarDelPadre(padreId) {
        const [sucursales, padre] = await Promise.all([
            SucursalRepository.listarPorPadre(padreId),
            SucursalRepository.obtenerTenant(padreId)
        ]);
        return { sucursales, max: Number(padre?.max_sucursales) || 0 };
    }

    static listarTodas() {
        return SucursalRepository.listarTodas();
    }

    static listarPadres() {
        return SucursalRepository.listarPadres();
    }

    static async fijarLimite(tenantId, max, userId = null) {
        const n = Number(max);
        if (!Number.isInteger(n) || n < 0 || n > 100) {
            throw error('El límite debe ser un entero entre 0 y 100');
        }
        const filas = await SucursalRepository.fijarLimite(tenantId, n);
        if (!filas) {
            throw error('Restaurante no encontrado o es una sucursal', 404);
        }
        CacheService.delete(`tenant:${tenantId}`);
        await auditar(tenantId, userId, 'sucursales_limite', `max_sucursales=${n}`);
        return n;
    }
}

module.exports = SucursalService;
