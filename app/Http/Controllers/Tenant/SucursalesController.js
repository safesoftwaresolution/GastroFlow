const SucursalService = require('../../../../services/Shared/SucursalService');

// Solo un tenant que no sea sucursal y tenga cupo habilitado por el superadmin.
const puedeGestionar = tenant => !!tenant && !tenant.tenant_padre_id && tenant.max_sucursales > 0;

const responderError = (res, error, mensajePorDefecto) => {
    if (error.status) {
        return res.status(error.status).json({ error: error.message });
    }
    console.error(mensajePorDefecto, error);
    return res.status(500).json({ error: mensajePorDefecto });
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
}

module.exports = SucursalesTenantController;
