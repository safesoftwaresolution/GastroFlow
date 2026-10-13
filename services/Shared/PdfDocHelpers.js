/**
 * PdfDocHelpers - Piezas reutilizables de docDefinition para armar los
 * reportes PDF (PdfMaker.js) con una identidad visual consistente entre
 * PlanesPdfService, ReporteMensualService y ReporteConsolidadoService.
 */

const { formatMoney } = require('../../utils/money');

function capitalize(text) {
    if (!text) {
        return text;
    }
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Layout de tabla con encabezado sombreado, bordes suaves y zebra striping. */
function zebraTableLayout() {
    return {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => '#e2e8f0',
        vLineColor: () => '#e2e8f0',
        fillColor: (rowIndex, node) => {
            const headerRows = node.table.headerRows || 0;
            if (rowIndex < headerRows) {
                return '#f1f5f9';
            }
            return (rowIndex - headerRows) % 2 === 0 ? '#f8fafc' : null;
        },
        paddingLeft: () => 8,
        paddingRight: () => 8,
        paddingTop: () => 5,
        paddingBottom: () => 5
    };
}

function tableHeaderCell(text, alignment = 'left') {
    return { text, bold: true, fontSize: 9, color: '#334155', alignment };
}

function tableCell(text, alignment = 'left', extra = {}) {
    return { text: text === null || text === undefined ? '' : String(text), fontSize: 9, alignment, ...extra };
}

function emptyRow(text, colSpan) {
    const row = [{ text, colSpan, alignment: 'center', italics: true, fontSize: 9, color: '#64748b' }];
    for (let i = 1; i < colSpan; i += 1) {
        row.push({});
    }
    return row;
}

/** Tarjeta de estadística con acento de color a la izquierda (imita border-left del HTML original). */
function statCard(label, value, { valueColor = '#4f46e5' } = {}) {
    return {
        table: {
            widths: ['*'],
            body: [
                [{ text: label, fontSize: 9, color: '#64748b', bold: true, margin: [0, 0, 0, 6] }],
                [{ text: value, fontSize: 17, bold: true, color: valueColor }]
            ]
        },
        layout: {
            hLineWidth: () => 0,
            vLineWidth: i => (i === 0 ? 3 : 0),
            vLineColor: () => valueColor,
            fillColor: () => '#f8fafc',
            paddingLeft: () => 12,
            paddingRight: () => 12,
            paddingTop: () => 10,
            paddingBottom: () => 10
        }
    };
}

/** Título de sección con barra de color a la izquierda. */
function sectionTitle(text, color = '#10b981') {
    return {
        columns: [
            { canvas: [{ type: 'rect', x: 0, y: 2, w: 3, h: 12, color }], width: 6 },
            { text, bold: true, fontSize: 12, color: '#1e293b' }
        ],
        columnGap: 8,
        margin: [0, 16, 0, 8]
    };
}

function footerText(text) {
    return {
        stack: [
            { text, alignment: 'center', fontSize: 8, color: '#94a3b8', margin: [0, 20, 0, 2] },
            { text: 'Sistema GastroFlow', alignment: 'center', fontSize: 8, bold: true, color: '#94a3b8' }
        ]
    };
}

/** Tabla "Top 5 Productos más Vendidos", reusada por reporte mensual y consolidado. */
function productosTable(topProductos) {
    const body = [
        [
            tableHeaderCell('Producto'),
            tableHeaderCell('Categoría'),
            tableHeaderCell('Cant. Vendida', 'right'),
            tableHeaderCell('Total Ventas', 'right')
        ]
    ];
    if (topProductos && topProductos.length > 0) {
        for (const p of topProductos) {
            body.push([
                tableCell(p.nombre),
                tableCell(p.categoria_nombre),
                tableCell(p.total_cantidad, 'right'),
                tableCell(formatMoney(p.total_ventas), 'right')
            ]);
        }
    } else {
        body.push(emptyRow('No hay datos de productos para este periodo.', 4));
    }
    return { table: { headerRows: 1, widths: ['*', '*', 'auto', 'auto'], body }, layout: zebraTableLayout() };
}

function porcentaje(valor, total) {
    return total ? `${((valor / total) * 100).toFixed(1).replace('.', ',')}%` : '0%';
}

/** Tabla "Ventas por Categoría", reusada por reporte mensual y consolidado. */
function categoriaTable(porCategoria) {
    const body = [
        [
            tableHeaderCell('Categoría'),
            tableHeaderCell('Unidades', 'right'),
            tableHeaderCell('Facturas', 'right'),
            tableHeaderCell('Total Ventas', 'right'),
            tableHeaderCell('%', 'right')
        ]
    ];
    if (porCategoria && porCategoria.length > 0) {
        const total = porCategoria.reduce((s, c) => s + (Number(c.total_ventas) || 0), 0);
        for (const c of porCategoria) {
            body.push([
                tableCell(c.categoria_nombre),
                tableCell(c.total_cantidad ?? '', 'right'),
                tableCell(c.facturas_count, 'right'),
                tableCell(formatMoney(c.total_ventas), 'right'),
                tableCell(porcentaje(Number(c.total_ventas) || 0, total), 'right', { color: '#64748b' })
            ]);
        }
    } else {
        body.push(emptyRow('No hay datos de categorías para este periodo.', 5));
    }
    return {
        table: { headerRows: 1, widths: ['*', 'auto', 'auto', 'auto', 'auto'], body },
        layout: zebraTableLayout()
    };
}

const ETIQUETAS_MEDIO_PAGO = {
    efectivo: 'Efectivo',
    transferencia: 'Transferencia',
    mixto: 'Mixto (efectivo + transferencia)',
    tarjeta: 'Tarjeta'
};

/**
 * Tabla "Facturas por Medio de Pago" a partir de getSalesByPaymentMethod
 * ([{ forma_pago, cantidad, total }]). Une variantes de mayúsculas/espacios.
 */
function medioPagoTable(porMedio) {
    const body = [
        [
            tableHeaderCell('Medio de pago'),
            tableHeaderCell('Facturas', 'right'),
            tableHeaderCell('Total Ventas', 'right'),
            tableHeaderCell('%', 'right')
        ]
    ];
    const agrupado = new Map();
    for (const r of porMedio || []) {
        const clave =
            String(r.forma_pago || '')
                .toLowerCase()
                .trim() || 'sin_especificar';
        const actual = agrupado.get(clave) || { cantidad: 0, total: 0 };
        actual.cantidad += Number(r.cantidad) || 0;
        actual.total += Number(r.total) || 0;
        agrupado.set(clave, actual);
    }
    const filas = [...agrupado.entries()].sort((a, b) => b[1].total - a[1].total);
    if (filas.length === 0) {
        body.push(emptyRow('No hay facturas en este periodo.', 4));
    } else {
        const total = filas.reduce((s, [, v]) => s + v.total, 0);
        const facturas = filas.reduce((s, [, v]) => s + v.cantidad, 0);
        for (const [clave, v] of filas) {
            body.push([
                tableCell(
                    ETIQUETAS_MEDIO_PAGO[clave] || (clave === 'sin_especificar' ? 'Sin especificar' : capitalize(clave))
                ),
                tableCell(v.cantidad, 'right'),
                tableCell(formatMoney(v.total), 'right'),
                tableCell(porcentaje(v.total, total), 'right', { color: '#64748b' })
            ]);
        }
        body.push([
            { text: 'Total', bold: true, fontSize: 9, fillColor: '#eef2ff' },
            { text: String(facturas), bold: true, fontSize: 9, alignment: 'right', fillColor: '#eef2ff' },
            { text: formatMoney(total), bold: true, fontSize: 9, alignment: 'right', fillColor: '#eef2ff' },
            { text: '', fillColor: '#eef2ff' }
        ]);
    }
    return { table: { headerRows: 1, widths: ['*', 'auto', 'auto', 'auto'], body }, layout: zebraTableLayout() };
}

module.exports = {
    formatMoney,
    capitalize,
    zebraTableLayout,
    tableHeaderCell,
    tableCell,
    emptyRow,
    statCard,
    sectionTitle,
    footerText,
    productosTable,
    categoriaTable,
    medioPagoTable
};
