const bcrypt = require('bcrypt');
const SucursalRepository = require('../../repositories/Admin/SucursalRepository');
const TenantSeederService = require('../Admin/Tenant/TenantSeederService');
const CacheService = require('./CacheService');

const error = (mensaje, status = 400) => Object.assign(new Error(mensaje), { status });

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
    const password = String(admin?.password ?? '');
    const email = texto(admin?.email, 100);
    if (!/^[a-zA-Z0-9._-]{4,30}$/.test(username)) {
        throw error('El usuario debe tener entre 4 y 30 caracteres (letras, números, punto, guion)');
    }
    if (password.length < 8) {
        throw error('La contraseña debe tener al menos 8 caracteres');
    }
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

        return { id: tenantId, slug, admin_id: usuarioId };
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

    static async fijarLimite(tenantId, max) {
        const n = Number(max);
        if (!Number.isInteger(n) || n < 0 || n > 100) {
            throw error('El límite debe ser un entero entre 0 y 100');
        }
        const filas = await SucursalRepository.fijarLimite(tenantId, n);
        if (!filas) {
            throw error('Restaurante no encontrado o es una sucursal', 404);
        }
        CacheService.delete(`tenant:${tenantId}`);
        return n;
    }
}

module.exports = SucursalService;
