const SucursalRepository = require('../../repositories/Admin/SucursalRepository');
const ConsolidadoSucursalesRepository = require('../../repositories/Admin/ConsolidadoSucursalesRepository');
const { hoyColombia, sumarDias } = require('../../utils/dateHelpers');

const MAX_DIAS = 366;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const error = (mensaje, status = 400) => Object.assign(new Error(mensaje), { status });

const esFechaReal = s => {
    if (!FECHA.test(s)) {
        return false;
    }
    const [y, m, d] = s.split('-').map(Number);
    const f = new Date(Date.UTC(y, m - 1, d));
    return f.getUTCFullYear() === y && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
};

const diasEntre = (desde, hasta) => {
    const [y1, m1, d1] = desde.split('-').map(Number);
    const [y2, m2, d2] = hasta.split('-').map(Number);
    return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000) + 1;
};

/** Por defecto: del día 1 del mes en curso (Colombia) a hoy. */
function resolverRango(desde, hasta) {
    const hoy = hoyColombia();
    const h = hasta || hoy;
    const d = desde || `${h.slice(0, 7)}-01`;
    if (!esFechaReal(d) || !esFechaReal(h)) {
        throw error('Fechas inválidas (usa AAAA-MM-DD)');
    }
    if (d > h) {
        throw error('La fecha inicial no puede ser posterior a la final');
    }
    if (diasEntre(d, h) > MAX_DIAS) {
        throw error(`El rango no puede superar ${MAX_DIAS} días`);
    }
    return { desde: d, hasta: h };
}

class ConsolidadoSucursalesService {
    /**
     * Ventas consolidadas del restaurante padre y todas sus sucursales (solo lectura, solo totales).
     * Los locales salen únicamente de padreId (la sesión): jamás de parámetros del cliente.
     */
    static async generar(padreId, desdeParam, hastaParam) {
        const { desde, hasta } = resolverRango(desdeParam, hastaParam);

        const padre = await SucursalRepository.obtenerTenant(padreId);
        if (!padre || padre.tenant_padre_id !== null) {
            throw error('Restaurante no encontrado', 404);
        }
        const sucursales = await SucursalRepository.listarPorPadre(padreId);
        const locales = [
            { id: padre.id, nombre: padre.nombre, es_padre: true, activo: Boolean(padre.activo) },
            ...sucursales.map(s => ({ id: s.id, nombre: s.nombre, es_padre: false, activo: Boolean(s.activo) }))
        ];
        const ids = locales.map(l => l.id);

        const [porLocal, porMedio, porDia] = await Promise.all([
            ConsolidadoSucursalesRepository.ventasPorLocal(ids, desde, hasta),
            ConsolidadoSucursalesRepository.ventasPorMedio(ids, desde, hasta),
            ConsolidadoSucursalesRepository.ventasPorDia(ids, desde, hasta)
        ]);

        const mapa = new Map(porLocal.map(r => [r.tenant_id, r]));
        const totalVentas = porLocal.reduce((a, r) => a + r.ventas, 0);
        const totalFacturas = porLocal.reduce((a, r) => a + r.facturas, 0);

        const detalle = locales
            .map(l => {
                const r = mapa.get(l.id) || { ventas: 0, facturas: 0 };
                return {
                    ...l,
                    ventas: r.ventas,
                    facturas: r.facturas,
                    ticket_promedio: r.facturas ? Math.round(r.ventas / r.facturas) : 0,
                    participacion: totalVentas ? Math.round((r.ventas / totalVentas) * 1000) / 10 : 0
                };
            })
            .sort((a, b) => b.ventas - a.ventas);

        const diaMapa = new Map(porDia.map(r => [r.dia, r]));
        const diario = [];
        for (let dia = desde; dia <= hasta; dia = sumarDias(dia, 1)) {
            const r = diaMapa.get(dia);
            diario.push({ fecha: dia, facturas: r?.facturas || 0, ventas: r?.ventas || 0 });
        }

        return {
            desde,
            hasta,
            totales: {
                ventas: totalVentas,
                facturas: totalFacturas,
                ticket_promedio: totalFacturas ? Math.round(totalVentas / totalFacturas) : 0
            },
            locales: detalle,
            porMedio: porMedio.sort((a, b) => b.total - a.total),
            diario
        };
    }
}

module.exports = ConsolidadoSucursalesService;
