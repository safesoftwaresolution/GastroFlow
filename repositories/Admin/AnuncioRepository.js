/**
 * AnuncioRepository - Acceso a datos de los anuncios (modales informativos) y de quién los ha visto.
 */

const db = require('../../config/database');

const CAMPOS = [
    'tipo',
    'titulo',
    'cuerpo',
    'items',
    'version',
    'boton_texto',
    'boton_url',
    'color_acento',
    'frecuencia',
    'planes',
    'roles',
    'fecha_inicio',
    'fecha_fin',
    'activo'
];

class AnuncioRepository {
    /** Listado para el panel de superadmin, con métricas de alcance. */
    static async findAllConEstadisticas() {
        const [rows] = await db.query(
            `SELECT a.*,
                    COALESCE(v.usuarios_vistos, 0) AS usuarios_vistos,
                    COALESCE(v.total_clics, 0) AS total_clics
             FROM anuncios a
             LEFT JOIN (
                 SELECT anuncio_id, COUNT(*) AS usuarios_vistos, SUM(clics) AS total_clics
                 FROM anuncios_vistos
                 GROUP BY anuncio_id
             ) v ON v.anuncio_id = a.id
             ORDER BY a.created_at DESC, a.id DESC`
        );
        return rows;
    }

    static async findById(id) {
        const [rows] = await db.query('SELECT * FROM anuncios WHERE id = ?', [id]);
        return rows[0] || null;
    }

    static async create(data) {
        const [result] = await db.query(
            `INSERT INTO anuncios (${CAMPOS.join(', ')}) VALUES (${CAMPOS.map(() => '?').join(', ')})`,
            CAMPOS.map(c => data[c])
        );
        return result.insertId;
    }

    static async update(id, data) {
        const [result] = await db.query(`UPDATE anuncios SET ${CAMPOS.map(c => `${c} = ?`).join(', ')} WHERE id = ?`, [
            ...CAMPOS.map(c => data[c]),
            id
        ]);
        return result;
    }

    static async setActivo(id, activo) {
        const [result] = await db.query('UPDATE anuncios SET activo = ? WHERE id = ?', [activo ? 1 : 0, id]);
        return result;
    }

    static async delete(id) {
        const [result] = await db.query('DELETE FROM anuncios WHERE id = ?', [id]);
        return result;
    }

    /**
     * Anuncios activos y dentro de su ventana de fechas, con la fila de "visto" de ese usuario
     * (si existe). La segmentación por plan/rol y las reglas de frecuencia se aplican en el servicio.
     */
    static async findVigentesParaUsuario(usuarioId, hoyDia) {
        const [rows] = await db.query(
            `SELECT a.*, v.id AS visto_id, v.no_mostrar
             FROM anuncios a
             LEFT JOIN anuncios_vistos v ON v.anuncio_id = a.id AND v.usuario_id = ?
             WHERE a.activo = 1
               AND (a.fecha_inicio IS NULL OR a.fecha_inicio <= ?)
               AND (a.fecha_fin IS NULL OR a.fecha_fin >= ?)
             ORDER BY a.id ASC`,
            [usuarioId, hoyDia, hoyDia]
        );
        return rows;
    }

    static async registrarVista(anuncioId, usuarioId, tenantId) {
        await db.query(
            `INSERT INTO anuncios_vistos (anuncio_id, usuario_id, tenant_id)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE vistas = vistas + 1, ultima_vista = CURRENT_TIMESTAMP`,
            [anuncioId, usuarioId, tenantId || null]
        );
    }

    static async registrarClic(anuncioId, usuarioId, tenantId) {
        await db.query(
            `INSERT INTO anuncios_vistos (anuncio_id, usuario_id, tenant_id, clics)
             VALUES (?, ?, ?, 1)
             ON DUPLICATE KEY UPDATE clics = clics + 1`,
            [anuncioId, usuarioId, tenantId || null]
        );
    }

    static async registrarNoMostrar(anuncioId, usuarioId, tenantId) {
        await db.query(
            `INSERT INTO anuncios_vistos (anuncio_id, usuario_id, tenant_id, no_mostrar)
             VALUES (?, ?, ?, 1)
             ON DUPLICATE KEY UPDATE no_mostrar = 1`,
            [anuncioId, usuarioId, tenantId || null]
        );
    }
}

module.exports = AnuncioRepository;
