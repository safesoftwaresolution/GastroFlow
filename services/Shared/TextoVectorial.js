/**
 * TextoVectorial - Convierte texto en trazos SVG (<path>) usando las fuentes Roboto que ya
 * trae pdfmake. Sirve para dibujar texto en imágenes que sharp rasteriza en el servidor sin
 * depender de las fuentes instaladas en el sistema (en un contenedor mínimo no hay ninguna).
 */
const path = require('node:path');
const fontkit = require('fontkit');

const PESOS = { normal: 'Roboto-Regular.ttf', bold: 'Roboto-Medium.ttf' };
const fuentes = {};

function fuente(peso) {
    const archivo = PESOS[peso] || PESOS.normal;
    if (!fuentes[archivo]) {
        const dir = path.join(path.dirname(require.resolve('pdfmake/package.json')), 'fonts', 'Roboto');
        fuentes[archivo] = fontkit.openSync(path.join(dir, archivo));
    }
    return fuentes[archivo];
}

const num = n => Number(n.toFixed(2));

/** Quita lo que la fuente no puede dibujar (emojis, controles) para no mostrar recuadros vacíos. */
function limpiar(font, texto) {
    return Array.from(
        String(texto ?? '')
            .replace(/\s+/g, ' ')
            .trim()
    )
        .filter(c => font.hasGlyphForCodePoint(c.codePointAt(0)))
        .join('');
}

function medir(font, texto, tamano) {
    const run = font.layout(texto);
    const ancho = run.positions.reduce((suma, p) => suma + p.xAdvance, 0);
    return (ancho * tamano) / font.unitsPerEm;
}

/**
 * Texto como trazos. `y` es la línea base.
 * Si no cabe en `maxAncho` primero reduce el tamaño (hasta el 70 %) y luego recorta con "…".
 * @returns {{ svg: string, ancho: number }}
 */
function textoVectorial(texto, { x, y, tamano, color, peso = 'normal', ancla = 'start', maxAncho = Infinity }) {
    const font = fuente(peso);
    let contenido = limpiar(font, texto);
    if (!contenido) {
        return { svg: '', ancho: 0 };
    }
    let size = tamano;
    let ancho = medir(font, contenido, size);
    if (ancho > maxAncho) {
        size = Math.max(tamano * 0.7, (tamano * maxAncho) / ancho);
        ancho = medir(font, contenido, size);
    }
    while (ancho > maxAncho && contenido.length > 1) {
        contenido = `${contenido.slice(0, -2).trimEnd()}…`;
        ancho = medir(font, contenido, size);
    }

    const escala = size / font.unitsPerEm;
    const inicio = ancla === 'middle' ? x - ancho / 2 : ancla === 'end' ? x - ancho : x;
    const run = font.layout(contenido);
    let cursor = 0;
    let trazos = '';
    run.glyphs.forEach((glyph, i) => {
        const pos = run.positions[i];
        const d = glyph.path.toSVG();
        if (d) {
            const gx = inicio + (cursor + pos.xOffset) * escala;
            const gy = y - pos.yOffset * escala;
            trazos += `<path transform="translate(${num(gx)} ${num(gy)}) scale(${escala.toFixed(6)} ${(-escala).toFixed(6)})" d="${d}"/>`;
        }
        cursor += pos.xAdvance;
    });
    return { svg: `<g fill="${color}">${trazos}</g>`, ancho };
}

module.exports = { textoVectorial };
