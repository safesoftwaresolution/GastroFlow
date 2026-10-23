/**
 * GoogleWalletService - Tarjeta de sellos en Google Wallet (prueba de concepto).
 *
 * Habla con la API REST de Google Wallet usando una cuenta de servicio, sin
 * dependencias nuevas (jsonwebtoken ya está en el proyecto y Node trae fetch).
 *
 *  - Clase  = la plantilla del programa de sellos (una por restaurante en producción).
 *  - Objeto = la tarjeta de UN cliente (su conteo de sellos, su QR).
 *
 * Variables de entorno (ver .env.example):
 *   GOOGLE_WALLET_ISSUER_ID     ID del emisor (consola de Google Pay y Wallet)
 *   GOOGLE_WALLET_KEY_PATH      ruta al JSON de la cuenta de servicio (FUERA del repo)
 *   GOOGLE_WALLET_KEY_JSON      alternativa: el mismo JSON como texto (útil en el servidor)
 *   GOOGLE_WALLET_CLASS_SUFFIX  sufijo de la clase (por defecto gastroflow_sellos_demo)
 *   GOOGLE_WALLET_LOGO_URL      logo PNG público por HTTPS (la clase lo necesita)
 *
 * La llave privada solo se usa en el servidor: nunca se envía al navegador ni se imprime.
 */
const fs = require('fs');
const jwt = require('jsonwebtoken');

const SCOPE = 'https://www.googleapis.com/auth/wallet_object.issuer';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API_URL = 'https://walletobjects.googleapis.com/walletobjects/v1';
const SAVE_URL = 'https://pay.google.com/gp/v/save/';
const COLOR_POR_DEFECTO = '#0B6E4F';

let tokenCache = { value: null, expiraEn: 0 };

class GoogleWalletService {
    // ---- Configuración ---------------------------------------------------------

    static config() {
        const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
        if (!issuerId) {
            throw new Error('Falta GOOGLE_WALLET_ISSUER_ID');
        }
        let key;
        if (process.env.GOOGLE_WALLET_KEY_JSON) {
            key = GoogleWalletService.leerClaveJson(process.env.GOOGLE_WALLET_KEY_JSON);
        } else if (process.env.GOOGLE_WALLET_KEY_PATH) {
            key = JSON.parse(fs.readFileSync(process.env.GOOGLE_WALLET_KEY_PATH, 'utf8'));
        } else {
            throw new Error(
                'Falta GOOGLE_WALLET_KEY_PATH (ruta al JSON de la cuenta de servicio) o GOOGLE_WALLET_KEY_JSON'
            );
        }
        if (!key.client_email || !key.private_key) {
            throw new Error('El JSON de la cuenta de servicio no tiene client_email o private_key');
        }
        const suffix = process.env.GOOGLE_WALLET_CLASS_SUFFIX || 'gastroflow_sellos_demo';
        return {
            issuerId,
            clientEmail: key.client_email,
            privateKey: GoogleWalletService.normalizarLlavePrivada(key.private_key),
            classId: `${issuerId}.${suffix}`,
            logoUrl: process.env.GOOGLE_WALLET_LOGO_URL || null
        };
    }

    /**
     * Lee el JSON de la cuenta de servicio pegado en una variable de entorno. Algunos paneles
     * convierten los \\n de la llave en saltos de línea reales, lo que vuelve inválido el JSON:
     * en ese caso se reintenta escapándolos (en un JSON de una sola línea cualquier salto real
     * está dentro de un texto, así que es seguro).
     */
    static leerClaveJson(texto) {
        const limpio = String(texto).trim().replace(/^'|'$/g, '');
        try {
            return JSON.parse(limpio);
        } catch {
            try {
                return JSON.parse(limpio.replace(/\r?\n/g, '\\n'));
            } catch {
                throw new Error('GOOGLE_WALLET_KEY_JSON no es un JSON válido (pega el archivo completo de la clave)');
            }
        }
    }

    /** Si la llave llegó con "\\n" como texto en vez de saltos de línea, los restaura. */
    static normalizarLlavePrivada(llave) {
        return String(llave).includes('\\n') ? String(llave).replace(/\\n/g, '\n') : llave;
    }

    /**
     * Clase propia de cada restaurante: así cada local tiene su color, logo e imagen en el pase.
     * Sin tenantId devuelve la clase compartida de la prueba de concepto (wallet-demo).
     */
    static classIdPara(cfg, tenantId) {
        if (!tenantId) {
            return cfg.classId;
        }
        const sufijo = process.env.GOOGLE_WALLET_CLASS_SUFFIX || 'gastroflow_sellos';
        return `${cfg.issuerId}.${sufijo}_t${Number.parseInt(tenantId, 10)}`;
    }

    /** Id del objeto (tarjeta de un cliente). Solo letras, números, punto, guion y guion bajo. */
    static objectId(cfg, numeroTarjeta) {
        const limpio = String(numeroTarjeta)
            .toLowerCase()
            .replace(/[^a-z0-9._-]/g, '');
        if (!limpio) {
            throw new Error('Número de tarjeta inválido');
        }
        return `${cfg.issuerId}.${limpio}`;
    }

    // ---- Autenticación y llamadas ----------------------------------------------

    static async accessToken(cfg) {
        const ahora = Math.floor(Date.now() / 1000);
        if (tokenCache.value && tokenCache.expiraEn - 60 > ahora) {
            return tokenCache.value;
        }
        const assertion = jwt.sign(
            { iss: cfg.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat: ahora, exp: ahora + 3600 },
            cfg.privateKey,
            { algorithm: 'RS256' }
        );
        const res = await fetch(TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.access_token) {
            throw new Error(
                `Google rechazó la cuenta de servicio (${res.status}): ${data.error_description || data.error || 'sin detalle'}`
            );
        }
        tokenCache = { value: data.access_token, expiraEn: ahora + (data.expires_in || 3600) };
        return data.access_token;
    }

    /** Devuelve { status, data }. No lanza en 404/409: el llamador decide. */
    static async llamar(cfg, metodo, ruta, cuerpo) {
        const token = await GoogleWalletService.accessToken(cfg);
        const res = await fetch(`${API_URL}${ruta}`, {
            method: metodo,
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: cuerpo ? JSON.stringify(cuerpo) : undefined
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok && res.status !== 404 && res.status !== 409) {
            const detalle = data.error?.message || JSON.stringify(data).slice(0, 300);
            throw new Error(`Google Wallet ${metodo} ${ruta} falló (${res.status}): ${detalle}`);
        }
        return { status: res.status, data };
    }

    // ---- Clase (plantilla del programa) ----------------------------------------

    static cuerpoClase(cfg, opciones = {}) {
        const cuerpo = {
            id: opciones.classId || cfg.classId,
            issuerName: opciones.restaurante || 'GastroFlow',
            programName: opciones.programa || 'Tarjeta de sellos',
            countryCode: 'CO',
            hexBackgroundColor: opciones.color || COLOR_POR_DEFECTO,
            multipleDevicesAndHoldersAllowedStatus: 'MULTIPLE_HOLDERS',
            localizedAccountNameLabel: { defaultValue: { language: 'es', value: 'Cliente' } },
            localizedAccountIdLabel: { defaultValue: { language: 'es', value: 'Tarjeta' } }
        };
        const logo = opciones.logoUrl || cfg.logoUrl;
        if (logo) {
            cuerpo.programLogo = {
                sourceUri: { uri: logo },
                contentDescription: { defaultValue: { language: 'es', value: 'Logo del restaurante' } }
            };
        }
        if (opciones.heroUrl) {
            cuerpo.heroImage = {
                sourceUri: { uri: opciones.heroUrl },
                contentDescription: { defaultValue: { language: 'es', value: 'Diseño de la tarjeta de sellos' } }
            };
        }
        return cuerpo;
    }

    /** Crea la clase si no existe; si existe, la actualiza (PATCH). No toca reviewStatus. */
    static async asegurarClase(opciones = {}) {
        const cfg = GoogleWalletService.config();
        const cuerpo = GoogleWalletService.cuerpoClase(cfg, opciones);
        const ruta = `/loyaltyClass/${encodeURIComponent(cuerpo.id)}`;
        const existe = await GoogleWalletService.llamar(cfg, 'GET', ruta);
        if (existe.status === 404) {
            const creada = await GoogleWalletService.llamar(cfg, 'POST', '/loyaltyClass', {
                ...cuerpo,
                reviewStatus: 'UNDER_REVIEW'
            });
            return { accion: 'creada', status: creada.status, classId: cuerpo.id };
        }
        await GoogleWalletService.llamar(cfg, 'PATCH', ruta, cuerpo);
        return { accion: 'actualizada', status: 200, classId: cuerpo.id };
    }

    // ---- Objeto (tarjeta de un cliente) ----------------------------------------

    static modulosTexto({ sellos, total, premio, premiosDisponibles = 0, restaurante }) {
        const faltan = Math.max(total - sellos, 0);
        let progreso;
        if (premiosDisponibles > 0) {
            progreso = `¡Tienes ${premiosDisponibles} premio${premiosDisponibles === 1 ? '' : 's'} para canjear! Pídelo en caja.`;
        } else if (faltan === 0) {
            progreso = '¡Tarjeta completa! Pide tu premio en caja.';
        } else {
            progreso = `Te faltan ${faltan} sello${faltan === 1 ? '' : 's'}.`;
        }
        const modulos = [
            { id: 'progreso', header: 'Progreso', body: progreso },
            { id: 'premio', header: 'Tu premio', body: premio || 'Premio de la casa' }
        ];
        if (restaurante) {
            modulos.unshift({ id: 'restaurante', header: 'Restaurante', body: restaurante });
        }
        return modulos;
    }

    static cuerpoObjeto(cfg, datos) {
        const {
            numeroTarjeta,
            nombre,
            token,
            sellos = 0,
            total = 8,
            premio,
            urlTarjeta,
            premiosDisponibles = 0,
            restaurante,
            classId,
            heroUrl
        } = datos;
        const cuerpo = {
            id: GoogleWalletService.objectId(cfg, numeroTarjeta),
            classId: classId || cfg.classId,
            state: 'ACTIVE',
            accountId: String(numeroTarjeta),
            accountName: nombre || 'Cliente',
            loyaltyPoints: { label: 'Sellos', balance: { string: `${sellos} / ${total}` } },
            barcode: { type: 'QR_CODE', value: token || String(numeroTarjeta), alternateText: String(numeroTarjeta) },
            textModulesData: GoogleWalletService.modulosTexto({
                sellos,
                total,
                premio,
                premiosDisponibles,
                restaurante
            })
        };
        if (urlTarjeta) {
            cuerpo.linksModuleData = { uris: [{ id: 'tarjeta', uri: urlTarjeta, description: 'Ver mi tarjeta' }] };
        }
        if (heroUrl) {
            cuerpo.heroImage = GoogleWalletService.imagenHero(heroUrl);
        }
        return cuerpo;
    }

    /** Imagen grande del pase (la que muestra los sellos). */
    static imagenHero(uri) {
        return {
            sourceUri: { uri },
            contentDescription: { defaultValue: { language: 'es', value: 'Sellos de tu tarjeta' } }
        };
    }

    /** Crea la tarjeta de un cliente (o la actualiza si ya existía). */
    static async crearTarjeta(datos) {
        const cfg = GoogleWalletService.config();
        const cuerpo = GoogleWalletService.cuerpoObjeto(cfg, datos);
        const r = await GoogleWalletService.llamar(cfg, 'POST', '/loyaltyObject', cuerpo);
        if (r.status === 409) {
            // La clase de un objeto ya creado no se cambia: se actualiza el resto.
            const { classId: _classId, ...sinClase } = cuerpo;
            await GoogleWalletService.llamar(cfg, 'PATCH', `/loyaltyObject/${encodeURIComponent(cuerpo.id)}`, sinClase);
        }
        return { objectId: cuerpo.id, enlace: GoogleWalletService.enlaceGuardar(cfg, cuerpo.id) };
    }

    static async obtenerTarjeta(numeroTarjeta) {
        const cfg = GoogleWalletService.config();
        const id = GoogleWalletService.objectId(cfg, numeroTarjeta);
        const r = await GoogleWalletService.llamar(cfg, 'GET', `/loyaltyObject/${encodeURIComponent(id)}`);
        if (r.status === 404) {
            throw new Error(`No existe la tarjeta ${numeroTarjeta}`);
        }
        const [sellos, total] = String(r.data.loyaltyPoints?.balance?.string || '0 / 8')
            .split('/')
            .map(n => parseInt(n, 10));
        return { id, sellos: sellos || 0, total: total || 8, objeto: r.data };
    }

    /**
     * Actualiza el contador de una tarjeta ya creada sin consultarla antes: la base de datos
     * de GastroFlow es la fuente de verdad, Wallet solo refleja lo que ya sabemos.
     */
    static async actualizarTarjeta(
        numeroTarjeta,
        { sellos, total, premio, premiosDisponibles = 0, restaurante, heroUrl }
    ) {
        const cfg = GoogleWalletService.config();
        const id = GoogleWalletService.objectId(cfg, numeroTarjeta);
        const cuerpo = {
            loyaltyPoints: { label: 'Sellos', balance: { string: `${sellos} / ${total}` } },
            textModulesData: GoogleWalletService.modulosTexto({
                sellos,
                total,
                premio,
                premiosDisponibles,
                restaurante
            })
        };
        if (heroUrl) {
            cuerpo.heroImage = GoogleWalletService.imagenHero(heroUrl);
        }
        const r = await GoogleWalletService.llamar(cfg, 'PATCH', `/loyaltyObject/${encodeURIComponent(id)}`, cuerpo);
        if (r.status === 404) {
            throw new Error(`No existe la tarjeta ${numeroTarjeta} en Wallet`);
        }
        return { actualizada: true };
    }

    /** Cambia el conteo de sellos. Si la tarjeta se completa, avisa con notificación. */
    static async fijarSellos(numeroTarjeta, sellos, premio) {
        const cfg = GoogleWalletService.config();
        const actual = await GoogleWalletService.obtenerTarjeta(numeroTarjeta);
        const total = actual.total;
        const nuevo = Math.min(Math.max(sellos, 0), total);
        await GoogleWalletService.llamar(cfg, 'PATCH', `/loyaltyObject/${encodeURIComponent(actual.id)}`, {
            loyaltyPoints: { label: 'Sellos', balance: { string: `${nuevo} / ${total}` } },
            textModulesData: GoogleWalletService.modulosTexto({ sellos: nuevo, total, premio })
        });
        return { sellos: nuevo, total, completa: nuevo >= total };
    }

    /**
     * Mensaje en el reverso del pase. Con notificar=true además llega aviso al teléfono
     * (Google permite 3 avisos por pase cada 24 horas).
     */
    static async enviarMensaje(numeroTarjeta, encabezado, cuerpo, notificar = true) {
        const cfg = GoogleWalletService.config();
        const id = GoogleWalletService.objectId(cfg, numeroTarjeta);
        const r = await GoogleWalletService.llamar(cfg, 'POST', `/loyaltyObject/${encodeURIComponent(id)}/addMessage`, {
            message: { header: encabezado, body: cuerpo, messageType: notificar ? 'TEXT_AND_NOTIFY' : 'TEXT' }
        });
        if (r.status === 404) {
            throw new Error(`No existe la tarjeta ${numeroTarjeta}`);
        }
        return { enviado: true, conAviso: notificar };
    }

    // ---- Enlace "Guardar en Google Wallet" -------------------------------------

    /** El objeto ya existe en Google, así que el token solo lleva su id (queda muy por debajo de 1.800 caracteres). */
    static enlaceGuardar(cfg, objectId) {
        const token = jwt.sign(
            {
                iss: cfg.clientEmail,
                aud: 'google',
                typ: 'savetowallet',
                origins: [],
                payload: { loyaltyObjects: [{ id: objectId }] }
            },
            cfg.privateKey,
            { algorithm: 'RS256' }
        );
        return `${SAVE_URL}${token}`;
    }

    static enlaceDeTarjeta(numeroTarjeta) {
        const cfg = GoogleWalletService.config();
        return GoogleWalletService.enlaceGuardar(cfg, GoogleWalletService.objectId(cfg, numeroTarjeta));
    }
}

module.exports = GoogleWalletService;
