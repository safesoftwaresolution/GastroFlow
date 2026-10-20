const SucursalService = require('../../../../services/Shared/SucursalService');
const PlanService = require('../../../../services/Admin/PlanService');

const responderError = (res, error, mensajePorDefecto) => {
    if (error.status) {
        return res.status(error.status).json({ error: error.message });
    }
    console.error(mensajePorDefecto, error);
    return res.status(500).json({ error: mensajePorDefecto });
};

class SucursalesAdminController {
    // GET /admin/sucursales
    static async index(req, res) {
        try {
            const [sucursales, padres, planes] = await Promise.all([
                SucursalService.listarTodas(),
                SucursalService.listarPadres(),
                PlanService.getAll()
            ]);
            res.render('admin/sucursales/index', {
                user: req.user,
                sucursales,
                padres,
                planes: planes.map(p => ({ id: p.id, nombre: p.nombre })),
                title: 'Sucursales',
                currentAdminPage: 'sucursales'
            });
        } catch (error) {
            console.error('Error cargando sucursales:', error);
            res.status(500).render('errors/generic', { error: { message: 'Error al cargar las sucursales' } });
        }
    }

    // POST /admin/sucursales
    static async crear(req, res) {
        try {
            const { padre_id, plan_id, nombre, ciudad, direccion, telefono, admin } = req.body || {};
            const creada = await SucursalService.crear({
                padreId: Number.parseInt(padre_id, 10),
                creadoPorUsuarioId: req.user.id,
                esSuperadmin: true,
                plan_id,
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

    // PUT /admin/sucursales/limite/:id
    static async fijarLimite(req, res) {
        try {
            const max = await SucursalService.fijarLimite(Number.parseInt(req.params.id, 10), req.body?.max_sucursales);
            res.json({ max_sucursales: max });
        } catch (error) {
            responderError(res, error, 'No se pudo guardar el límite');
        }
    }
}

module.exports = SucursalesAdminController;
