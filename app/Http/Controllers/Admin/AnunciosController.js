const AnuncioService = require('../../../../services/Admin/AnuncioService');
const PlanService = require('../../../../services/Admin/PlanService');

function responderError(res, error, mensajeGenerico) {
    if (error.status) {
        return res.status(error.status).json({ error: error.message });
    }
    // Errores de validación del servicio (mensajes pensados para el superadmin)
    if (/obligatorio|inválido|superar|Máximo|debe |Escribe|no puede/.test(error.message)) {
        return res.status(400).json({ error: error.message });
    }
    console.error(mensajeGenerico, error);
    return res.status(500).json({ error: mensajeGenerico });
}

class AnunciosAdminController {
    static async index(req, res) {
        try {
            const [anuncios, planes] = await Promise.all([AnuncioService.listar(), PlanService.getAll()]);
            res.render('admin/anuncios/index', {
                user: req.user,
                anuncios,
                planes: planes.map(p => ({ id: p.id, nombre: p.nombre })),
                title: 'Anuncios',
                currentAdminPage: 'anuncios'
            });
        } catch (error) {
            console.error('Error cargando anuncios:', error);
            res.status(500).render('errors/generic', { error: { message: 'Error al cargar los anuncios' } });
        }
    }

    static async crear(req, res) {
        try {
            const id = await AnuncioService.crear(req.body);
            res.status(201).json({ id });
        } catch (error) {
            responderError(res, error, 'No se pudo crear el anuncio');
        }
    }

    static async actualizar(req, res) {
        try {
            await AnuncioService.actualizar(Number.parseInt(req.params.id, 10), req.body);
            res.json({ message: 'Anuncio actualizado' });
        } catch (error) {
            responderError(res, error, 'No se pudo actualizar el anuncio');
        }
    }

    static async setActivo(req, res) {
        try {
            const activo = req.body.activo === true || req.body.activo === 1 || req.body.activo === '1';
            await AnuncioService.setActivo(Number.parseInt(req.params.id, 10), activo);
            res.json({ message: activo ? 'Anuncio activado' : 'Anuncio desactivado', activo });
        } catch (error) {
            responderError(res, error, 'No se pudo cambiar el estado');
        }
    }

    static async eliminar(req, res) {
        try {
            await AnuncioService.eliminar(Number.parseInt(req.params.id, 10));
            res.json({ message: 'Anuncio eliminado' });
        } catch (error) {
            responderError(res, error, 'No se pudo eliminar el anuncio');
        }
    }
}

module.exports = AnunciosAdminController;
