/**
 * Prueba de la tarjeta de sellos en Google Wallet (modo Demo).
 *
 * Uso (desde la raíz del proyecto):
 *   node scripts/wallet-demo.js clase                       crea/actualiza la clase del programa
 *   node scripts/wallet-demo.js crear "Samuel" [total]      crea una tarjeta y muestra el enlace para guardarla
 *   node scripts/wallet-demo.js sellar GF123456 [n]         suma n sellos (por defecto 1); al completar avisa
 *   node scripts/wallet-demo.js fijar GF123456 5            deja la tarjeta en 5 sellos
 *   node scripts/wallet-demo.js aviso GF123456 "texto"      mensaje con notificación al teléfono
 *   node scripts/wallet-demo.js enlace GF123456             vuelve a imprimir el enlace de guardado
 *
 * Requiere GOOGLE_WALLET_ISSUER_ID y GOOGLE_WALLET_KEY_PATH (ver .env.example).
 * En modo Demo solo pueden guardar el pase los correos agregados como "cuentas de prueba".
 */
require('dotenv').config();
const crypto = require('crypto');
const Wallet = require('../services/Shared/GoogleWalletService');

const PREMIO = 'Un postre de la casa';

async function main() {
    const [comando, a, b] = process.argv.slice(2);
    switch (comando) {
        case 'clase': {
            const r = await Wallet.asegurarClase();
            console.log(`Clase ${r.accion}: ${r.classId}`);
            break;
        }
        case 'crear': {
            const nombre = a || 'Cliente de prueba';
            const total = parseInt(b, 10) || 8;
            const numeroTarjeta = `GF${crypto.randomInt(100000, 999999)}`;
            const token = crypto.randomBytes(12).toString('hex');
            const r = await Wallet.crearTarjeta({ numeroTarjeta, nombre, token, sellos: 0, total, premio: PREMIO });
            console.log(`Tarjeta ${numeroTarjeta} creada para ${nombre} (0 / ${total}).`);
            console.log('Ábrela en el teléfono (con el correo de prueba) para guardarla:');
            console.log(r.enlace);
            break;
        }
        case 'sellar': {
            const actual = await Wallet.obtenerTarjeta(a);
            const r = await Wallet.fijarSellos(a, actual.sellos + (parseInt(b, 10) || 1), PREMIO);
            console.log(`Sellos: ${r.sellos} / ${r.total}`);
            if (r.completa) {
                await Wallet.enviarMensaje(a, '¡Tarjeta completa!', `Reclama tu premio: ${PREMIO}.`, true);
                console.log('Tarjeta completa: se envió el aviso de premio.');
            }
            break;
        }
        case 'fijar': {
            const r = await Wallet.fijarSellos(a, parseInt(b, 10) || 0, PREMIO);
            console.log(`Sellos: ${r.sellos} / ${r.total}`);
            break;
        }
        case 'aviso': {
            await Wallet.enviarMensaje(a, 'GastroFlow', b || 'Mensaje de prueba', true);
            console.log('Mensaje enviado con aviso.');
            break;
        }
        case 'enlace': {
            console.log(Wallet.enlaceDeTarjeta(a));
            break;
        }
        default:
            console.log(
                'Comandos: clase | crear "Nombre" [total] | sellar NUM [n] | fijar NUM n | aviso NUM "texto" | enlace NUM'
            );
    }
}

main().catch(err => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
});
