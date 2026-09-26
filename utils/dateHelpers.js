/**
 * Fechas y zona horaria del sistema. ÚNICO lugar donde se decide qué es "hoy"
 * o "un día" en Colombia: no calcularlo a mano en otro archivo.
 *
 * Contexto: la BD guarda los TIMESTAMP en UTC y MySQL corre en UTC en
 * producción, así que CURDATE()/NOW()/DATE(columna) y toISOString().slice(0, 10)
 * dan el día UTC, que en Colombia cambia a las 7 p. m. Eso causó varios bugs
 * (numeración de pedidos, filtros de ventas, vencimiento de bonos...).
 * Colombia no tiene horario de verano: UTC-5 fijo todo el año.
 */

const ZONA_COLOMBIA = 'America/Bogota';
const OFFSET_COLOMBIA = '-05:00';
const OFFSET_UTC = '+00:00';

/** Día calendario en Colombia ('YYYY-MM-DD') de un instante. */
function fechaColombia(instante = new Date()) {
    return new Date(instante).toLocaleDateString('en-CA', { timeZone: ZONA_COLOMBIA });
}

/** Hoy en Colombia ('YYYY-MM-DD'). */
function hoyColombia() {
    return fechaColombia(new Date());
}

/** Suma n días (puede ser negativo) a un día 'YYYY-MM-DD'. Aritmética de calendario, sin zona horaria. */
function sumarDias(dia, n) {
    const d = new Date(`${dia}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}

/**
 * Suma n meses a un día 'YYYY-MM-DD' ajustando al último día del mes cuando no
 * existe (31-ene + 1 mes = 28/29-feb, no 3-mar como hace Date.setMonth).
 */
function sumarMeses(dia, n) {
    const [y, m, d] = dia.split('-').map(Number);
    const destino = new Date(Date.UTC(y, m - 1 + n, 1));
    const ultimoDia = new Date(Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth() + 1, 0)).getUTCDate();
    destino.setUTCDate(Math.min(d, ultimoDia));
    return destino.toISOString().slice(0, 10);
}

/**
 * Rango UTC ('YYYY-MM-DD HH:mm:ss', ambos inclusive, para BETWEEN) que cubre los
 * días Colombia de `desde` a `hasta`. Permite filtrar columnas UTC usando el
 * índice (sin funciones sobre la columna).
 */
function rangoUtcColombia(desde, hasta = desde) {
    return { utcDesde: `${desde} 05:00:00`, utcHasta: `${sumarDias(hasta, 1)} 04:59:59` };
}

/**
 * Fragmentos SQL para la misma lógica dentro de las consultas. Úsalos en vez de
 * CURDATE()/NOW()/DATE(col) cuando lo que importa es el día en Colombia.
 */
const SQL_COLOMBIA = {
    /** Hoy en Colombia (DATE) */
    hoy: `DATE(CONVERT_TZ(UTC_TIMESTAMP(), '${OFFSET_UTC}', '${OFFSET_COLOMBIA}'))`,
    /** Instante UTC en que empezó hoy en Colombia (para `col >= ...`, usa índice) */
    inicioHoyUtc: `CONVERT_TZ(DATE(CONVERT_TZ(UTC_TIMESTAMP(), '${OFFSET_UTC}', '${OFFSET_COLOMBIA}')), '${OFFSET_COLOMBIA}', '${OFFSET_UTC}')`,
    /** Columna UTC expresada en hora Colombia (para mostrar/agrupar) */
    aColombia: col => `CONVERT_TZ(${col}, '${OFFSET_UTC}', '${OFFSET_COLOMBIA}')`,
    /** Día Colombia de una columna UTC (para agrupar; no usar en WHERE: no usa índice) */
    dia: col => `DATE(CONVERT_TZ(${col}, '${OFFSET_UTC}', '${OFFSET_COLOMBIA}'))`,
    /** Hora Colombia -> UTC (ej. al guardar una fecha que el usuario escribió en hora local) */
    aUtc: (expr = '?') => `CONVERT_TZ(${expr}, '${OFFSET_COLOMBIA}', '${OFFSET_UTC}')`,
    /** Inicio (UTC) del día Colombia recibido como parámetro: `col >= desdeDia()` */
    desdeDia: (expr = '?') => `CONVERT_TZ(${expr}, '${OFFSET_COLOMBIA}', '${OFFSET_UTC}')`,
    /** Fin exclusivo (UTC) del día Colombia recibido como parámetro: `col < hastaDia()` */
    hastaDia: (expr = '?') => `CONVERT_TZ(DATE_ADD(${expr}, INTERVAL 1 DAY), '${OFFSET_COLOMBIA}', '${OFFSET_UTC}')`
};

/**
 * Convierte una fecha que viene de la BD (Date o string MySQL "YYYY-MM-DD HH:mm:ss")
 * a ISO en UTC, para que el cliente la muestre en su zona horaria.
 * Las fechas guardadas en MySQL TIMESTAMP están en UTC; si llegan como string sin Z,
 * Node las interpreta como hora local del servidor y se muestran mal. Tratarlas como UTC.
 * @param {Date|string|null} fecha
 * @returns {string} ISO string (ej. "2026-02-28T01:33:36.000Z") o ''
 */
function toFechaISOUtc(fecha) {
    if (fecha === null || fecha === undefined) {
        return '';
    }
    if (typeof fecha === 'string') {
        // MySQL devuelve '0000-00-00 00:00:00' para fechas invalidas/vacias
        if (fecha.startsWith('0000-00-00')) {
            return '';
        }
        const mysqlMatch = fecha.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})/);
        if (mysqlMatch) {
            return mysqlMatch[1] + 'T' + mysqlMatch[2] + '.000Z';
        }
        if (fecha.endsWith('Z') || fecha.includes('T')) {
            return new Date(fecha).toISOString();
        }
    }
    if (fecha instanceof Date) {
        if (isNaN(fecha.getTime())) {
            return '';
        }
        return fecha.toISOString();
    }
    try {
        const d = new Date(fecha);
        return isNaN(d.getTime()) ? '' : d.toISOString();
    } catch (e) {
        return '';
    }
}

/**
 * Normaliza una columna DATE (o un DATE(...) calculado en SQL) a 'YYYY-MM-DD'.
 * No usar con DATETIME/TIMESTAMP: para esos, fechaColombia().
 * En producción (MYSQL_URL) mysql2 devuelve las DATE como objetos Date (ver
 * config/database.js: dateStrings nunca aplicó ahí) y en local como string;
 * comparar un Date contra un string 'YYYY-MM-DD' siempre da false. mysql2 arma
 * el Date a medianoche local, así que se leen las partes locales.
 * @param {Date|string|null} valor
 * @returns {string|null}
 */
function toFechaDia(valor) {
    if (valor === null || valor === undefined || valor === '') {
        return null;
    }
    if (valor instanceof Date) {
        if (Number.isNaN(valor.getTime())) {
            return null;
        }
        const m = String(valor.getMonth() + 1).padStart(2, '0');
        const d = String(valor.getDate()).padStart(2, '0');
        return `${valor.getFullYear()}-${m}-${d}`;
    }
    return String(valor).slice(0, 10);
}

module.exports = {
    ZONA_COLOMBIA,
    fechaColombia,
    hoyColombia,
    sumarDias,
    sumarMeses,
    rangoUtcColombia,
    SQL_COLOMBIA,
    toFechaISOUtc,
    toFechaDia
};
