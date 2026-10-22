/**
 * FidelizacionTarjetaPdf - PDF imprimible con la tarjeta de sellos y el QR de inscripción.
 * La tarjeta ya viene dibujada como imagen (FidelizacionDisenos.aPng, modo 'impreso'), así que
 * el PDF es solo una página del tamaño de la tarjeta (19 x 12 cm) con esa imagen a sangre.
 */
const PdfMaker = require('../Shared/PdfMaker');

// Puntos PDF: mantiene la proporción 1080x680 de la tarjeta.
const ANCHO = 540;
const ALTO = 340;

class FidelizacionTarjetaPdf {
    /** @param {Buffer} png - tarjeta en modo 'impreso' @param {string} restaurante */
    static render(png, restaurante) {
        return PdfMaker.renderPdf({
            pageSize: { width: ANCHO, height: ALTO },
            pageMargins: [0, 0, 0, 0],
            info: { title: `Tarjeta de sellos - ${String(restaurante || '').slice(0, 60)}` },
            content: [
                {
                    image: `data:image/png;base64,${png.toString('base64')}`,
                    width: ANCHO,
                    height: ALTO,
                    absolutePosition: { x: 0, y: 0 }
                }
            ]
        });
    }
}

module.exports = FidelizacionTarjetaPdf;
