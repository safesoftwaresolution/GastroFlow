jest.mock('../../../repositories/Admin/AnuncioRepository');
jest.mock('../../../utils/dateHelpers', () => ({
    hoyColombia: jest.fn(() => '2026-10-17'),
    toFechaDia: jest.fn(v => String(v).slice(0, 10))
}));

const AnuncioRepository = require('../../../repositories/Admin/AnuncioRepository');
const AnuncioService = require('../../../services/Admin/AnuncioService');

const base = { tipo: 'funcionalidad', titulo: 'Nuevo', items: 'uno\n\n dos ', frecuencia: 'una_vez' };

describe('AnuncioService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        AnuncioRepository.create.mockResolvedValue(5);
    });

    describe('crear (validación)', () => {
        it('normaliza items, deja planes/roles vacíos como NULL (todos)', async () => {
            await AnuncioService.crear({ ...base, planes: [], roles: [] });
            const data = AnuncioRepository.create.mock.calls[0][0];
            expect(JSON.parse(data.items)).toEqual(['uno', 'dos']);
            expect(data.planes).toBeNull();
            expect(data.roles).toBeNull();
            expect(data.activo).toBe(1);
        });

        it('guarda solo roles anunciables y planes enteros válidos', async () => {
            await AnuncioService.crear({ ...base, planes: ['2', 'x', 3], roles: ['admin', 'superadmin', 'cajero'] });
            const data = AnuncioRepository.create.mock.calls[0][0];
            expect(JSON.parse(data.planes)).toEqual([2, 3]);
            expect(JSON.parse(data.roles)).toEqual(['admin', 'cajero']);
        });

        it.each([
            [{ tipo: 'otro' }, /Tipo/],
            [{ titulo: '  ' }, /título/],
            [{ boton_texto: 'Ir', boton_url: 'javascript:alert(1)' }, /enlace/],
            [{ boton_texto: 'Ir', boton_url: '//evil.com' }, /enlace/],
            [{ boton_url: '/productos' }, /texto del botón/],
            [{ color_acento: 'rojo' }, /color/],
            [{ items: Array.from({ length: 11 }, (_, i) => `p${i}`) }, /Máximo/],
            [{ fecha_inicio: '2026-10-10', fecha_fin: '2026-10-01' }, /fecha de fin/]
        ])('rechaza datos inválidos %#', async (cambio, mensaje) => {
            await expect(AnuncioService.crear({ ...base, ...cambio })).rejects.toThrow(mensaje);
            expect(AnuncioRepository.create).not.toHaveBeenCalled();
        });

        it('acepta ruta interna y https en el botón', async () => {
            await AnuncioService.crear({ ...base, boton_texto: 'Ir', boton_url: '/productos' });
            await AnuncioService.crear({ ...base, boton_texto: 'Ir', boton_url: 'https://gastroflow.co' });
            expect(AnuncioRepository.create).toHaveBeenCalledTimes(2);
        });
    });

    describe('getPendiente', () => {
        const fila = (extra = {}) => ({
            id: 1,
            tipo: 'funcionalidad',
            titulo: 'A',
            frecuencia: 'una_vez',
            items: null,
            planes: null,
            roles: null,
            visto_id: null,
            no_mostrar: 0,
            ...extra
        });

        it('segmenta por plan y por rol', async () => {
            AnuncioRepository.findVigentesParaUsuario.mockResolvedValue([fila({ planes: '[1]', roles: '["admin"]' })]);
            expect(await AnuncioService.getPendiente({ usuarioId: 1, rol: 'admin', planId: 1 })).toMatchObject({
                id: 1
            });
            expect(await AnuncioService.getPendiente({ usuarioId: 1, rol: 'cajero', planId: 1 })).toBeNull();
            expect(await AnuncioService.getPendiente({ usuarioId: 1, rol: 'admin', planId: 2 })).toBeNull();
        });

        it('una_vez no vuelve tras verse; cada_login sí, salvo "no mostrar" o excluido en la sesión', async () => {
            AnuncioRepository.findVigentesParaUsuario.mockResolvedValue([fila({ visto_id: 9 })]);
            expect(await AnuncioService.getPendiente({ usuarioId: 1, rol: 'admin', planId: 1 })).toBeNull();

            AnuncioRepository.findVigentesParaUsuario.mockResolvedValue([
                fila({ frecuencia: 'cada_login', visto_id: 9 })
            ]);
            expect(await AnuncioService.getPendiente({ usuarioId: 1, rol: 'admin', planId: 1 })).toMatchObject({
                id: 1
            });
            expect(
                await AnuncioService.getPendiente({ usuarioId: 1, rol: 'admin', planId: 1, excluir: [1] })
            ).toBeNull();

            AnuncioRepository.findVigentesParaUsuario.mockResolvedValue([
                fila({ frecuencia: 'cada_login', visto_id: 9, no_mostrar: 1 })
            ]);
            expect(await AnuncioService.getPendiente({ usuarioId: 1, rol: 'admin', planId: 1 })).toBeNull();
        });

        it('devuelve solo la forma pública (sin planes/roles internos)', async () => {
            AnuncioRepository.findVigentesParaUsuario.mockResolvedValue([fila({ items: '["x"]', planes: '[1]' })]);
            const a = await AnuncioService.getPendiente({ usuarioId: 1, rol: 'admin', planId: 1 });
            expect(a.items).toEqual(['x']);
            expect(a).not.toHaveProperty('planes');
        });
    });

    describe('registrarEvento', () => {
        it('rechaza un anuncio inexistente o un evento inválido', async () => {
            AnuncioRepository.findById.mockResolvedValue(null);
            await expect(
                AnuncioService.registrarEvento({ anuncioId: 1, usuarioId: 1, evento: 'vista' })
            ).rejects.toThrow('no encontrado');
            AnuncioRepository.findById.mockResolvedValue({ id: 1 });
            await expect(
                AnuncioService.registrarEvento({ anuncioId: 1, usuarioId: 1, evento: 'hack' })
            ).rejects.toThrow('Evento inválido');
        });
    });
});
