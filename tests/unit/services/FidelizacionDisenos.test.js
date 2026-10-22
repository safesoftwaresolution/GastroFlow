const FidelizacionDisenos = require('../../../services/Tenant/FidelizacionDisenos');
const { textoVectorial } = require('../../../services/Shared/TextoVectorial');

const IDS = ['cafe', 'neon', 'ticket', 'minimal', 'pizarra', 'pop', 'elegante', 'fresco', 'retro'];

describe('FidelizacionDisenos', () => {
    test('colorValido solo acepta #RRGGBB', () => {
        expect(FidelizacionDisenos.colorValido('#a1B2c3')).toBe(true);
        expect(FidelizacionDisenos.colorValido('rojo')).toBe(false);
        expect(FidelizacionDisenos.colorValido('#fff')).toBe(false);
        expect(FidelizacionDisenos.colorValido(null)).toBe(false);
    });

    test('disenoValido cae en el de por defecto si el id no existe (p. ej. las plantillas de bonos)', () => {
        expect(FidelizacionDisenos.disenoValido('neon')).toBe('neon');
        expect(FidelizacionDisenos.disenoValido('navidad')).toBe(FidelizacionDisenos.DISENO_DEFECTO);
        expect(FidelizacionDisenos.disenoValido('<script>')).toBe(FidelizacionDisenos.DISENO_DEFECTO);
    });

    test('colorAcento usa el del local o, si no hay, el propio del diseño', () => {
        expect(FidelizacionDisenos.colorAcento('cafe', '#112233')).toBe('#112233');
        expect(FidelizacionDisenos.colorAcento('cafe', 'rojo')).toBe('#7c3f1d');
    });

    test('fondoWallet: Pop usa el acento, los demás su color base', () => {
        expect(FidelizacionDisenos.fondoWallet('pop', '#7c3aed')).toBe('#7c3aed');
        expect(FidelizacionDisenos.fondoWallet('neon')).toBe('#12081f');
    });

    test.each(IDS)('%s: dibuja los sellos ganados con check y el resto pendientes', id => {
        const svg = FidelizacionDisenos.componer({
            diseno: id,
            sellos: 3,
            total: 8,
            restaurante: 'Don Pepe',
            premio: 'Postre'
        });
        expect(svg.match(/<polyline/g)).toHaveLength(3);
        expect(svg).toContain('stroke-dasharray');
        expect(svg).toContain('width="1032" height="336"');
    });

    test('el último sello es el premio (regalo) y se marca al completar', () => {
        const completo = FidelizacionDisenos.componer({ diseno: 'minimal', sellos: 8, total: 8 });
        expect(completo.match(/<polyline/g)).toHaveLength(7);
        expect(completo).not.toContain('stroke-dasharray');
    });

    test('acota total y sellos a valores razonables', () => {
        const svg = FidelizacionDisenos.componer({ diseno: 'retro', sellos: 99, total: 500 });
        // 20 sellos: 19 checks + el regalo del premio
        expect(svg.match(/<polyline/g)).toHaveLength(19);
    });

    test('el logo se incrusta como imagen y sin logo no hay medallón', () => {
        const logo = 'data:image/png;base64,AAAA';
        expect(FidelizacionDisenos.componer({ diseno: 'cafe', logo })).toContain(`xlink:href="${logo}"`);
        expect(FidelizacionDisenos.componer({ diseno: 'cafe' })).not.toContain('<image');
    });

    test('modo impreso trae el QR en su panel', () => {
        const qr = 'data:image/png;base64,BBBB';
        const svg = FidelizacionDisenos.componer({ diseno: 'cafe', modo: 'impreso', qr, programa: 'Club' });
        expect(svg).toContain(`xlink:href="${qr}"`);
        expect(svg).toContain('width="1080" height="680"');
    });

    test('un texto con caracteres raros no rompe el SVG (todo va como trazos)', () => {
        const svg = FidelizacionDisenos.componer({
            diseno: 'cafe',
            restaurante: '<script>alert(1)</script> "Pepe" & Hijos 🍕',
            lema: "l'ema"
        });
        expect(svg).not.toContain('<script');
        expect(svg).not.toContain('alert');
    });

    test('aPng devuelve un PNG de las medidas del pase y del impreso', async () => {
        const pase = await FidelizacionDisenos.aPng({ diseno: 'neon', sellos: 2, total: 12, restaurante: 'Don Pepe' });
        expect(pase.subarray(1, 4).toString()).toBe('PNG');
        expect(pase.readUInt32BE(16)).toBe(FidelizacionDisenos.HERO_ANCHO);
        expect(pase.readUInt32BE(20)).toBe(FidelizacionDisenos.HERO_ALTO);
        const impreso = await FidelizacionDisenos.aPng({ diseno: 'pop', modo: 'impreso' }, 2);
        expect(impreso.readUInt32BE(16)).toBe(FidelizacionDisenos.IMPRESO_ANCHO * 2);
    });

    test('cargarLogo rechaza fuentes que no son https ni data URI', async () => {
        expect(await FidelizacionDisenos.cargarLogo('http://ejemplo.com/logo.png')).toBeNull();
        expect(await FidelizacionDisenos.cargarLogo('file:///etc/passwd')).toBeNull();
        expect(await FidelizacionDisenos.cargarLogo(null)).toBeNull();
    });

    test('listarParaUI trae todos los diseños con su miniatura', () => {
        const lista = FidelizacionDisenos.listarParaUI({ restaurante: 'Don Pepe', total: 8 });
        expect(lista.map(d => d.id)).toEqual(IDS);
        expect(lista.every(d => d.svg.startsWith('<svg'))).toBe(true);
    });
});

describe('TextoVectorial', () => {
    test('dibuja trazos, respeta el ancho máximo y descarta lo que la fuente no tiene', () => {
        const libre = textoVectorial('Postre de la casa', { x: 0, y: 40, tamano: 30, color: '#000' });
        const acotado = textoVectorial('Postre de la casa', { x: 0, y: 40, tamano: 30, color: '#000', maxAncho: 100 });
        expect(libre.svg).toContain('<path');
        expect(acotado.ancho).toBeLessThanOrEqual(100);
        expect(textoVectorial('🍕🍕', { x: 0, y: 0, tamano: 20, color: '#000' }).svg).toBe('');
    });

    test('alinea al final y al centro', () => {
        const fin = textoVectorial('Hola', { x: 200, y: 20, tamano: 20, color: '#000', ancla: 'end' });
        expect(fin.ancho).toBeGreaterThan(0);
        expect(fin.svg).toMatch(/translate\((1\d\d|\d\d)\./);
    });
});
