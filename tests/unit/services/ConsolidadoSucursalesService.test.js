jest.mock('../../../repositories/Admin/SucursalRepository');
jest.mock('../../../repositories/Admin/ConsolidadoSucursalesRepository');
jest.mock('../../../utils/dateHelpers', () => ({
    hoyColombia: jest.fn(() => '2026-10-21'),
    sumarDias: jest.fn((dia, n) => {
        const [y, m, d] = dia.split('-').map(Number);
        return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
    })
}));

const SucursalRepository = require('../../../repositories/Admin/SucursalRepository');
const Repo = require('../../../repositories/Admin/ConsolidadoSucursalesRepository');
const ConsolidadoSucursalesService = require('../../../services/Shared/ConsolidadoSucursalesService');

describe('ConsolidadoSucursalesService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        SucursalRepository.obtenerTenant.mockResolvedValue({
            id: 1,
            nombre: 'Matriz',
            activo: 1,
            tenant_padre_id: null
        });
        SucursalRepository.listarPorPadre.mockResolvedValue([
            { id: 2, nombre: 'Norte', activo: 1 },
            { id: 3, nombre: 'Sur', activo: 0 }
        ]);
        Repo.ventasPorLocal.mockResolvedValue([
            { tenant_id: 1, facturas: 10, ventas: 100000 },
            { tenant_id: 2, facturas: 30, ventas: 300000 }
        ]);
        Repo.ventasPorMedio.mockResolvedValue([
            { forma_pago: 'efectivo', cantidad: 10, total: 100000 },
            { forma_pago: 'tarjeta', cantidad: 30, total: 300000 }
        ]);
        Repo.ventasPorDia.mockResolvedValue([{ dia: '2026-10-02', facturas: 40, ventas: 400000 }]);
    });

    it('consolida el padre y todas sus sucursales (incluida la inactiva y la que no vendió)', async () => {
        const r = await ConsolidadoSucursalesService.generar(1, '2026-10-01', '2026-10-03');
        expect(Repo.ventasPorLocal).toHaveBeenCalledWith([1, 2, 3], '2026-10-01', '2026-10-03');
        expect(r.totales).toEqual({ ventas: 400000, facturas: 40, ticket_promedio: 10000 });
        expect(r.locales.map(l => l.nombre)).toEqual(['Norte', 'Matriz', 'Sur']); // por ventas desc
        expect(r.locales.find(l => l.id === 2)).toMatchObject({ participacion: 75, ticket_promedio: 10000 });
        expect(r.locales.find(l => l.id === 3)).toMatchObject({
            ventas: 0,
            facturas: 0,
            activo: false,
            participacion: 0
        });
        expect(r.locales.find(l => l.id === 1).es_padre).toBe(true);
        expect(r.porMedio[0].forma_pago).toBe('tarjeta');
    });

    it('rellena con ceros los días sin ventas', async () => {
        const r = await ConsolidadoSucursalesService.generar(1, '2026-10-01', '2026-10-03');
        expect(r.diario).toEqual([
            { fecha: '2026-10-01', facturas: 0, ventas: 0 },
            { fecha: '2026-10-02', facturas: 40, ventas: 400000 },
            { fecha: '2026-10-03', facturas: 0, ventas: 0 }
        ]);
    });

    it('sin ventas no divide entre cero', async () => {
        Repo.ventasPorLocal.mockResolvedValue([]);
        const r = await ConsolidadoSucursalesService.generar(1, '2026-10-01', '2026-10-01');
        expect(r.totales).toEqual({ ventas: 0, facturas: 0, ticket_promedio: 0 });
        expect(r.locales.every(l => l.participacion === 0)).toBe(true);
    });

    it('por defecto va del día 1 del mes a hoy (Colombia)', async () => {
        const r = await ConsolidadoSucursalesService.generar(1);
        expect([r.desde, r.hasta]).toEqual(['2026-10-01', '2026-10-21']);
    });

    it('una sucursal no puede pedir un consolidado (404) ni se consulta nada', async () => {
        SucursalRepository.obtenerTenant.mockResolvedValue({ id: 2, nombre: 'Norte', tenant_padre_id: 1 });
        await expect(ConsolidadoSucursalesService.generar(2)).rejects.toMatchObject({ status: 404 });
        expect(Repo.ventasPorLocal).not.toHaveBeenCalled();
    });

    it.each([
        ['2026-13-01', '2026-10-01', /inválidas/],
        ['2026-02-30', '2026-03-01', /inválidas/],
        ['ayer', '2026-10-01', /inválidas/],
        ['2026-10-05', '2026-10-01', /posterior/],
        ['2025-01-01', '2026-10-01', /366/]
    ])('rechaza el rango %s → %s', async (desde, hasta, mensaje) => {
        await expect(ConsolidadoSucursalesService.generar(1, desde, hasta)).rejects.toMatchObject({
            status: 400,
            message: expect.stringMatching(mensaje)
        });
        expect(Repo.ventasPorLocal).not.toHaveBeenCalled();
    });
});
