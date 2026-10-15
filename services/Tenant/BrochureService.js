/**
 * BrochureService - Carta/brochure del restaurante para el menú digital.
 * Acepta imágenes (jpg/png/webp) y PDF; cada archivo es una "página" del carrusel.
 */
const BrochureRepository = require('../../repositories/Tenant/BrochureRepository');
const R2StorageService = require('./R2StorageService');

const MAX_PAGINAS = 20;
const CARPETA = 'brochure';

/** Detecta el tipo real por los primeros bytes (no confía en nombre ni mimetype del cliente). */
function detectarTipo(buffer) {
    if (buffer.length < 12) {
        return null;
    }
    if (buffer.subarray(0, 4).toString('latin1') === '%PDF') {
        return { tipo: 'pdf', mime: 'application/pdf', ext: '.pdf' };
    }
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return { tipo: 'imagen', mime: 'image/jpeg', ext: '.jpg' };
    }
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        return { tipo: 'imagen', mime: 'image/png', ext: '.png' };
    }
    if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') {
        return { tipo: 'imagen', mime: 'image/webp', ext: '.webp' };
    }
    return null;
}

class BrochureService {
    static listar(tenantId) {
        return BrochureRepository.listar(tenantId);
    }

    static async subir(tenantId, files) {
        if (!files || files.length === 0) {
            throw new Error('Selecciona al menos un archivo');
        }
        const actuales = await BrochureRepository.contar(tenantId);
        if (actuales + files.length > MAX_PAGINAS) {
            throw new Error(`El brochure admite máximo ${MAX_PAGINAS} páginas (tienes ${actuales})`);
        }

        // Validar todos antes de subir cualquiera: o entran todos o ninguno.
        const validados = files.map(f => {
            const info = detectarTipo(f.buffer);
            if (!info) {
                throw new Error(`"${f.originalname}" no es un formato válido (usa JPG, PNG, WebP o PDF)`);
            }
            return { f, info };
        });

        let orden = await BrochureRepository.siguienteOrden(tenantId);
        for (const { f, info } of validados) {
            const url = await R2StorageService.uploadFile(f.buffer, `brochure${info.ext}`, info.mime, CARPETA);
            await BrochureRepository.crear(tenantId, {
                url,
                tipo: info.tipo,
                nombre: String(f.originalname).slice(0, 150),
                orden: orden++
            });
        }
        return BrochureRepository.listar(tenantId);
    }

    static async eliminar(tenantId, id) {
        const pagina = await BrochureRepository.findById(id, tenantId);
        if (!pagina) {
            throw new Error('Página no encontrada');
        }
        await BrochureRepository.eliminar(id, tenantId);
        // Best-effort: si falla el borrado en R2 no se revierte la baja.
        await R2StorageService.deleteFile(pagina.url).catch(err =>
            console.error('No se pudo borrar el archivo del brochure en R2:', err.message)
        );
    }

    static async reordenar(tenantId, ids) {
        if (!Array.isArray(ids)) {
            throw new Error('Orden inválido');
        }
        const existentes = new Set((await BrochureRepository.listar(tenantId)).map(p => p.id));
        const limpios = ids.map(Number).filter(id => existentes.has(id));
        await BrochureRepository.actualizarOrden(tenantId, limpios);
    }
}

module.exports = BrochureService;
