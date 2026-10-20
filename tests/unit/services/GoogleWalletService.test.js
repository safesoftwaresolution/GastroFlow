/**
 * Tests unitarios para GoogleWalletService (sin red: fetch simulado, llave RSA generada al vuelo)
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Wallet = require('../../../services/Shared/GoogleWalletService');

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

const respuesta = (status, data) => ({ ok: status >= 200 && status < 300, status, json: async () => data });

describe('GoogleWalletService', () => {
    const entornoOriginal = { ...process.env };
    let llamadas;

    beforeEach(() => {
        process.env.GOOGLE_WALLET_ISSUER_ID = '3388000000000000001';
        process.env.GOOGLE_WALLET_KEY_JSON = JSON.stringify({
            client_email: 'wallet@proyecto.iam.gserviceaccount.com',
            private_key: privateKey
        });
        process.env.GOOGLE_WALLET_LOGO_URL = 'https://ejemplo.com/logo.png';
        llamadas = [];
        global.fetch = jest.fn(async (url, opts = {}) => {
            llamadas.push({ url, metodo: opts.method, cuerpo: opts.body && String(opts.body) });
            if (url.includes('oauth2.googleapis.com')) {
                return respuesta(200, { access_token: 'tok', expires_in: 3600 });
            }
            return respuesta(200, {});
        });
    });

    afterAll(() => {
        process.env = entornoOriginal;
    });

    test('config falla sin ID de emisor', () => {
        delete process.env.GOOGLE_WALLET_ISSUER_ID;
        expect(() => Wallet.config()).toThrow('GOOGLE_WALLET_ISSUER_ID');
    });

    test('objectId limpia caracteres no permitidos y antepone el emisor', () => {
        const cfg = Wallet.config();
        expect(Wallet.objectId(cfg, 'GF 12/34')).toBe('3388000000000000001.gf1234');
        expect(() => Wallet.objectId(cfg, '###')).toThrow('inválido');
    });

    test('el enlace de guardado es un JWT firmado que solo lleva el id del objeto', () => {
        const cfg = Wallet.config();
        const enlace = Wallet.enlaceGuardar(cfg, `${cfg.issuerId}.gf1234`);
        expect(enlace.startsWith('https://pay.google.com/gp/v/save/')).toBe(true);
        const token = enlace.split('/save/')[1];
        expect(token.length).toBeLessThan(1800);
        const datos = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
        expect(datos.typ).toBe('savetowallet');
        expect(datos.aud).toBe('google');
        expect(datos.iss).toBe('wallet@proyecto.iam.gserviceaccount.com');
        expect(datos.payload.loyaltyObjects).toEqual([{ id: `${cfg.issuerId}.gf1234` }]);
    });

    test('crearTarjeta envía conteo, QR y texto del premio', async () => {
        const r = await Wallet.crearTarjeta({
            numeroTarjeta: 'GF1234',
            nombre: 'Samuel',
            token: 'abc123',
            sellos: 0,
            total: 8,
            premio: 'Postre'
        });
        const post = llamadas.find(l => l.metodo === 'POST' && l.url.endsWith('/loyaltyObject'));
        const cuerpo = JSON.parse(post.cuerpo);
        expect(cuerpo.loyaltyPoints.balance.string).toBe('0 / 8');
        expect(cuerpo.barcode).toMatchObject({ type: 'QR_CODE', value: 'abc123' });
        expect(cuerpo.textModulesData[0].body).toBe('Te faltan 8 sellos.');
        expect(r.enlace).toContain('/gp/v/save/');
    });

    test('crearTarjeta actualiza (PATCH) si Google responde 409', async () => {
        global.fetch.mockImplementation(async (url, opts = {}) => {
            llamadas.push({ url, metodo: opts.method });
            if (url.includes('oauth2')) return respuesta(200, { access_token: 'tok', expires_in: 3600 });
            return respuesta(opts.method === 'POST' ? 409 : 200, {});
        });
        await Wallet.crearTarjeta({ numeroTarjeta: 'GF1234', nombre: 'Samuel' });
        expect(llamadas.some(l => l.metodo === 'PATCH')).toBe(true);
    });

    test('fijarSellos limita al total y marca la tarjeta completa', async () => {
        global.fetch.mockImplementation(async (url, opts = {}) => {
            llamadas.push({ url, metodo: opts.method, cuerpo: opts.body && String(opts.body) });
            if (url.includes('oauth2')) return respuesta(200, { access_token: 'tok', expires_in: 3600 });
            if (opts.method === 'GET') return respuesta(200, { loyaltyPoints: { balance: { string: '7 / 8' } } });
            return respuesta(200, {});
        });
        const r = await Wallet.fijarSellos('GF1234', 99, 'Postre');
        expect(r).toEqual({ sellos: 8, total: 8, completa: true });
        const patch = llamadas.find(l => l.metodo === 'PATCH');
        expect(JSON.parse(patch.cuerpo).textModulesData[0].body).toContain('Tarjeta completa');
    });

    test('enviarMensaje usa TEXT_AND_NOTIFY solo si se pide aviso', async () => {
        await Wallet.enviarMensaje('GF1234', 'Hola', 'Cuerpo', true);
        await Wallet.enviarMensaje('GF1234', 'Hola', 'Cuerpo', false);
        const mensajes = llamadas.filter(l => l.url.endsWith('/addMessage')).map(l => JSON.parse(l.cuerpo).message);
        expect(mensajes.map(m => m.messageType)).toEqual(['TEXT_AND_NOTIFY', 'TEXT']);
    });

    test('un error de Google se propaga con su detalle', async () => {
        global.fetch.mockImplementation(async url =>
            url.includes('oauth2')
                ? respuesta(200, { access_token: 'tok', expires_in: 3600 })
                : respuesta(400, { error: { message: 'logo inválido' } })
        );
        await expect(Wallet.crearTarjeta({ numeroTarjeta: 'GF1', nombre: 'X' })).rejects.toThrow('logo inválido');
    });
});
