const jsonSeguro = require('../../../utils/jsonSeguro');

describe('jsonSeguro', () => {
    test('un texto con </script> no puede cerrar la etiqueta', () => {
        const salida = jsonSeguro({ nombre: '</script><script>alert(1)</script>' });
        expect(salida).not.toMatch(/<\/script/i);
        expect(salida).not.toContain('<');
    });

    test('JSON.parse devuelve exactamente los datos originales', () => {
        const datos = {
            nombre: 'Café <Andrés> & "Cía"',
            lista: [1, 'a' + String.fromCharCode(0x2028) + 'b'],
            vacio: null
        };
        expect(JSON.parse(jsonSeguro(datos))).toEqual(datos);
    });

    test('undefined se serializa como null (JSON válido)', () => {
        expect(jsonSeguro(undefined)).toBe('null');
    });
});
