/**
 * FinanzasService - Lógica de negocio para el control de gastos y ganancias.
 */

const FinanzasRepository = require('../../repositories/Tenant/FinanzasRepository');
const CajaRepository = require('../../repositories/Tenant/CajaRepository');
const ProveedorFacturaRepository = require('../../repositories/Tenant/ProveedorFacturaRepository');
const db = require('../../config/database');
const { hoyColombia, sumarDias, rangoUtcColombia } = require('../../utils/dateHelpers');
const PdfMaker = require('../Shared/PdfMaker');
const {
    formatMoney,
    statCard,
    sectionTitle,
    footerText,
    tableHeaderCell,
    tableCell,
    emptyRow,
    zebraTableLayout
} = require('../Shared/PdfDocHelpers');

/** Variación porcentual de `actual` frente a `anterior` (null si no hay base de comparación). */
function variacionPct(actual, anterior) {
    if (!anterior) {
        return actual > 0 ? 100 : 0;
    }
    return ((actual - anterior) / Math.abs(anterior)) * 100;
}

class FinanzasService {
    /**
     * Registra un ingreso por venta (automático)
     */
    static async registrarIngresoVenta(tenantId, { monto, factura_id, detalle, esCeramica = false, usuario_id }) {
        // Intentar obtener sesión de caja abierta
        const sesion = await CajaRepository.getSesionAbierta(tenantId);

        // Prioridad de usuario: 1. El que viene en la req, 2. El de la sesión de caja, 3. Usuario 1 (admin)
        const finalUsuarioId = usuario_id || (sesion ? sesion.usuario_id : 1);

        return await FinanzasRepository.createMovimiento(tenantId, {
            sesion_id: sesion ? sesion.id : null,
            usuario_id: finalUsuarioId,
            tipo: 'entrada',
            monto: Number.parseFloat(monto) || 0,
            motivo: detalle || `Venta Factura #${factura_id}`,
            categoria_gasto: esCeramica ? 'Venta Cerámica' : 'Venta General',
            referencia_tipo: 'venta',
            referencia_id: factura_id
        });
    }

    /**
     * Registra un egreso por compra de inventario (automático)
     */
    static async registrarGastoInventario(tenantId, { monto, insumo_nombre, mov_id, categoria_nombre }) {
        const sesion = await CajaRepository.getSesionAbierta(tenantId);

        return await FinanzasRepository.createMovimiento(tenantId, {
            sesion_id: sesion ? sesion.id : null,
            usuario_id: 1,
            tipo: 'salida',
            monto: monto,
            motivo: `Compra de insumo: ${insumo_nombre}`,
            categoria_gasto: categoria_nombre === 'Cerámicas' ? 'Inventario Cerámica' : 'Insumos Generales',
            referencia_tipo: 'compra_inventario',
            referencia_id: mov_id
        });
    }

    /**
     * Registra un movimiento manual (ingreso/egreso) desde el módulo de Finanzas.
     * No requiere una sesión de caja abierta (movimiento administrativo, fuera de turno).
     */
    static async registrarMovimientoManual(tenantId, { monto, motivo, categoria, tipo, usuario_id }) {
        const montoNum = Number.parseFloat(monto);
        if (!montoNum || montoNum <= 0) {
            throw new Error('El monto debe ser mayor a 0');
        }
        if (!['entrada', 'salida'].includes(tipo)) {
            throw new Error('Tipo de operación inválido');
        }

        const sesion = await CajaRepository.getSesionAbierta(tenantId);

        return await FinanzasRepository.createMovimiento(tenantId, {
            sesion_id: sesion ? sesion.id : null,
            usuario_id: usuario_id || (sesion ? sesion.usuario_id : 1),
            tipo,
            monto: montoNum,
            motivo: motivo || (tipo === 'salida' ? 'Egreso manual' : 'Ingreso manual'),
            categoria_gasto: categoria || 'General',
            referencia_tipo: 'manual',
            referencia_id: null
        });
    }

    /**
     * Obtiene el resumen para el dashboard financiero.
     *
     * "egresos"/"utilidad" son las cifras REALES: además de los egresos de caja
     * (caja_movimientos) incluyen los costos fijos activos (prorrateados sobre
     * 30 días -- costos_fijos no tiene fecha, es un valor mensual recurrente) y
     * las facturas de proveedor emitidas en el periodo (proveedor_facturas).
     * Antes de este cambio esos dos se ignoraban por completo y la "utilidad"
     * mostrada podía ser positiva aunque el restaurante estuviera en rojo.
     */
    static async getDashboardData(tenantId, dias = 30) {
        const hoyDia = hoyColombia();
        const inicioDia = sumarDias(hoyDia, -(dias - 1));
        const { utcDesde, utcHasta } = rangoUtcColombia(inicioDia, hoyDia);

        // Periodo anterior, de la misma longitud, inmediatamente antes -- para las comparativas.
        const finAnteriorDia = sumarDias(inicioDia, -1);
        const inicioAnteriorDia = sumarDias(finAnteriorDia, -(dias - 1));
        const { utcDesde: utcDesdeAnt, utcHasta: utcHastaAnt } = rangoUtcColombia(inicioAnteriorDia, finAnteriorDia);

        const [
            resumen,
            resumenAnterior,
            porCategoria,
            historico,
            costosFijosMensual,
            proveedoresPeriodo,
            proveedoresPeriodoAnterior,
            desglosePago,
            cuentasPorPagar,
            [movimientos]
        ] = await Promise.all([
            FinanzasRepository.getResumenPeriodo(tenantId, utcDesde, utcHasta),
            FinanzasRepository.getResumenPeriodo(tenantId, utcDesdeAnt, utcHastaAnt),
            FinanzasRepository.getPorCategoria(tenantId, 'salida', utcDesde, utcHasta),
            FinanzasRepository.getHistoricoDiario(tenantId, utcDesde, utcHasta),
            FinanzasRepository.getCostosFijosActivosMensual(tenantId),
            ProveedorFacturaRepository.sumaPorPeriodo(tenantId, inicioDia, hoyDia),
            ProveedorFacturaRepository.sumaPorPeriodo(tenantId, inicioAnteriorDia, finAnteriorDia),
            FinanzasRepository.getDesglosePorFormaPago(tenantId, utcDesde, utcHasta),
            ProveedorFacturaRepository.findPendientes(tenantId),
            db.query(`SELECT * FROM caja_movimientos WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 10`, [tenantId])
        ]);

        const costosFijosPeriodo = (costosFijosMensual / 30) * dias;

        const ingresos = Number.parseFloat((resumen || []).find(r => r.tipo === 'entrada')?.total) || 0;
        const egresosCaja = Number.parseFloat((resumen || []).find(r => r.tipo === 'salida')?.total) || 0;
        const egresos = egresosCaja + costosFijosPeriodo + proveedoresPeriodo;
        const utilidad = ingresos - egresos;

        const ingresosAnt = Number.parseFloat((resumenAnterior || []).find(r => r.tipo === 'entrada')?.total) || 0;
        const egresosCajaAnt = Number.parseFloat((resumenAnterior || []).find(r => r.tipo === 'salida')?.total) || 0;
        const egresosAnt = egresosCajaAnt + costosFijosPeriodo + proveedoresPeriodoAnterior;
        const utilidadAnt = ingresosAnt - egresosAnt;

        return {
            ingresos,
            egresosCaja,
            costosFijosPeriodo,
            proveedoresPeriodo,
            egresos,
            utilidad,
            variacionIngresos: variacionPct(ingresos, ingresosAnt),
            variacionEgresos: variacionPct(egresos, egresosAnt),
            variacionUtilidad: variacionPct(utilidad, utilidadAnt),
            desglosePago,
            cuentasPorPagar,
            gastosPorCategoria: porCategoria,
            historico,
            movimientos,
            dias
        };
    }

    /**
     * Genera el PDF del estado financiero del periodo (pdfmake, sin Chromium).
     */
    static async generarPdfMensual(tenant, dias) {
        const data = await this.getDashboardData(tenant.id, dias);
        const hoyStr = new Date().toLocaleDateString('es-CO');

        const variacionTexto = pct => {
            if (pct === null) {
                return '';
            }
            const signo = pct >= 0 ? '+' : '';
            return ` (${signo}${pct.toFixed(1)}% vs. periodo anterior)`;
        };

        const categoriaTable = () => {
            const body = [[tableHeaderCell('Categoría'), tableHeaderCell('Total', 'right')]];
            if (data.gastosPorCategoria && data.gastosPorCategoria.length > 0) {
                for (const c of data.gastosPorCategoria) {
                    body.push([tableCell(c.categoria_gasto), tableCell(formatMoney(c.total), 'right')]);
                }
            } else {
                body.push(emptyRow('Sin egresos de caja en el periodo.', 2));
            }
            return { table: { headerRows: 1, widths: ['*', 'auto'], body }, layout: zebraTableLayout() };
        };

        const cuentasPorPagarTable = () => {
            const body = [
                [
                    tableHeaderCell('Proveedor'),
                    tableHeaderCell('N° Factura'),
                    tableHeaderCell('Vence'),
                    tableHeaderCell('Monto', 'right')
                ]
            ];
            if (data.cuentasPorPagar && data.cuentasPorPagar.length > 0) {
                for (const f of data.cuentasPorPagar) {
                    body.push([
                        tableCell(f.proveedor_nombre),
                        tableCell(f.numero_factura || '-'),
                        tableCell(
                            f.fecha_vencimiento ? new Date(f.fecha_vencimiento).toLocaleDateString('es-CO') : '-'
                        ),
                        tableCell(formatMoney(f.monto_total), 'right')
                    ]);
                }
            } else {
                body.push(emptyRow('No hay cuentas por pagar pendientes.', 4));
            }
            return {
                table: { headerRows: 1, widths: ['*', 'auto', 'auto', 'auto'], body },
                layout: zebraTableLayout()
            };
        };

        const docDefinition = {
            content: [
                { text: tenant.nombre, alignment: 'center', fontSize: 20, bold: true, color: '#4f46e5' },
                {
                    text: `Estado Financiero - Últimos ${dias} días (al ${hoyStr})`,
                    alignment: 'center',
                    fontSize: 12,
                    color: '#666666',
                    margin: [0, 4, 0, 20]
                },
                {
                    columns: [
                        statCard('Ingresos', formatMoney(data.ingresos) + variacionTexto(data.variacionIngresos), {
                            valueColor: '#16a34a'
                        }),
                        statCard('Egresos Totales', formatMoney(data.egresos) + variacionTexto(data.variacionEgresos), {
                            valueColor: '#dc2626'
                        }),
                        statCard('Utilidad', formatMoney(data.utilidad) + variacionTexto(data.variacionUtilidad), {
                            valueColor: data.utilidad >= 0 ? '#4f46e5' : '#dc2626'
                        })
                    ],
                    columnGap: 12,
                    margin: [0, 0, 0, 10]
                },
                sectionTitle('Desglose de Egresos', '#4f46e5'),
                {
                    ul: [
                        `Caja (compras de inventario, gastos manuales): ${formatMoney(data.egresosCaja)}`,
                        `Costos fijos del periodo (prorrateado): ${formatMoney(data.costosFijosPeriodo)}`,
                        `Facturas de proveedor del periodo: ${formatMoney(data.proveedoresPeriodo)}`
                    ],
                    margin: [0, 0, 0, 10]
                },
                sectionTitle('Ingresos por Forma de Pago', '#4f46e5'),
                {
                    ul: [
                        `Efectivo: ${formatMoney(data.desglosePago.efectivo)}`,
                        `Transferencia: ${formatMoney(data.desglosePago.transferencia)}`,
                        `Bonos redimidos: ${formatMoney(data.desglosePago.bono)}`
                    ],
                    margin: [0, 0, 0, 10]
                },
                sectionTitle('Egresos de Caja por Categoría', '#4f46e5'),
                categoriaTable(),
                sectionTitle('Cuentas por Pagar Pendientes', '#4f46e5'),
                cuentasPorPagarTable(),
                footerText('Este reporte fue generado de forma automática.')
            ]
        };

        return PdfMaker.renderPdf(docDefinition);
    }
}

module.exports = FinanzasService;
