const SucursalService = require('../../../../services/Shared/SucursalService');
const ConsolidadoSucursalesService = require('../../../../services/Shared/ConsolidadoSucursalesService');

// Solo un tenant que no sea sucursal y tenga cupo habilitado por el superadmin.
const puedeGestionar = tenant => !!tenant && !tenant.tenant_padre_id && tenant.max_sucursales > 0;

const responderError = (res, error, mensajePorDefecto) => {
    if (error.status) {
        return res.status(error.status).json({ error: error.message });
    }
    console.error(mensajePorDefecto, error);
    return res.status(500).json({ error: mensajePorDefecto });
};

// El id de la URL se valida como entero positivo; la pertenencia al padre la verifica el servicio.
const idDe = req => {
    const id = Number(req.params.id);
    return Number.isInteger(id) && id > 0 ? id : null;
};

class SucursalesTenantController {
    // Guard de las rutas: el padre sale de la sesión, nunca del body/params.
    static exigirPadre(req, res, next) {
        if (puedeGestionar(req.tenant)) {
            return next();
        }
        if (req.originalUrl.startsWith('/api/')) {
            return res.status(403).json({ error: 'Tu plan no incluye sucursales' });
        }
        return res.status(403).render('errors/generic', { error: { message: 'Tu plan no incluye sucursales.' } });
    }

    // GET /sucursales
    static index(req, res) {
        res.render('sucursales/index', { user: req.user, tenant: req.tenant });
    }

    // GET /sucursales/consolidado
    static consolidadoPage(req, res) {
        res.render('sucursales/consolidado', { user: req.user, tenant: req.tenant });
    }

    // GET /api/sucursales/consolidado?desde=&hasta=
    static async consolidado(req, res) {
        try {
            const { desde, hasta } = req.query;
            res.json(await ConsolidadoSucursalesService.generar(req.tenant.id, desde, hasta));
        } catch (error) {
            responderError(res, error, 'No se pudo generar el consolidado');
        }
    }

    // GET /api/sucursales
    static async listar(req, res) {
        try {
            res.json(await SucursalService.listarDelPadre(req.tenant.id));
        } catch (error) {
            responderError(res, error, 'No se pudieron cargar las sucursales');
        }
    }

    // POST /api/sucursales
    static async crear(req, res) {
        try {
            const { nombre, ciudad, direccion, telefono, admin } = req.body || {};
            const creada = await SucursalService.crear({
                padreId: req.tenant.id,
                creadoPorUsuarioId: req.user.id,
                nombre,
                ciudad,
                direccion,
                telefono,
                admin
            });
            res.status(201).json(creada);
        } catch (error) {
            responderError(res, error, 'No se pudo crear la sucursal');
        }
    }

    // PATCH /api/sucursales/:id/activo
    static async cambiarEstado(req, res) {
        try {
            const sucursalId = idDe(req);
            if (!sucursalId) {
                return res.status(400).json({ error: 'Sucursal inválida' });
            }
            const activo = req.body?.activo === true || req.body?.activo === 'true' || req.body?.activo === 1;
            res.json(
                await SucursalService.cambiarEstado({
                    padreId: req.tenant.id,
                    sucursalId,
                    activo,
                    userId: req.user.id
                })
            );
        } catch (error) {
            responderError(res, error, 'No se pudo cambiar el estado de la sucursal');
        }
    }

    // POST /api/sucursales/:id/password
    static async resetearPassword(req, res) {
        try {
            const sucursalId = idDe(req);
            if (!sucursalId) {
                return res.status(400).json({ error: 'Sucursal inválida' });
            }
            await SucursalService.resetearPasswordAdmin({
                padreId: req.tenant.id,
                sucursalId,
                password: req.body?.password,
                userId: req.user.id
            });
            res.json({ message: 'Contraseña temporal definida. Deberá cambiarla al ingresar.' });
        } catch (error) {
            responderError(res, error, 'No se pudo restablecer la contraseña');
        }
    }
}

module.exports = SucursalesTenantController;
