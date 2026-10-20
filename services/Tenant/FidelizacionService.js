/**
 * FidelizacionService - Tarjetas de sellos digitales.
 *
 * - La base de datos de GastroFlow es la fuente de verdad (sellos, premios, historial).
 * - Google Wallet solo refleja el estado: si falla, la venta y el sello NO se pierden;
 *   el siguiente sello o canje vuelve a escribir el estado completo en Wallet.
 * - Un cliente solo tiene tarjeta si la pidió (consentimiento explícito, Ley 1581/2012).
 */
const crypto = require('crypto');
const db = require('../../config/database');
const FidelizacionRepository = require('../../repositories/Tenant/FidelizacionRepository');
const GoogleWalletService = require('../Shared/GoogleWalletService');
const TenantOwnership = require('./TenantOwnership');

const PROGRAMA_POR_DEFECTO = {
    nombre: 'Tarjeta de sellos',
    sellos_requeridos: 8,
    monto_minimo: 0,
    premio: 'Premio de la casa',
    activo: 0
};

const walletConfigurado = () => {
    try {
        GoogleWalletService.config();
        return true;
    } catch {
        return false;
    }
};

class FidelizacionService {
    // ---- Programa ----------------------------------------------------------

    static async obtenerPrograma(tenantId) {
        const programa = await FidelizacionRepository.obtenerPrograma(tenantId);
        return programa || { ...PROGRAMA_POR_DEFECTO, tenant_id: tenantId, configurado: false };
    }

    static async guardarPrograma(tenantId, datos = {}) {
        const sellosRequeridos = Number.parseInt(datos.sellos_requeridos, 10);
        const montoMinimo = Number.parseFloat(datos.monto_minimo || 0);
        const nombre = String(datos.nombre || PROGRAMA_POR_DEFECTO.nombre)
            .trim()
            .slice(0, 80);
        const premio = String(datos.premio || '')
            .trim()
            .slice(0, 120);
        if (!Number.isInteger(sellosRequeridos) || sellosRequeridos < 2 || sellosRequeridos > 20) {
            throw new Error('Los sellos requeridos deben ser un número entre 2 y 20');
        }
        if (!Number.isFinite(montoMinimo) || montoMinimo < 0) {
            throw new Error('El monto mínimo no puede ser negativo');
        }
        if (!premio) {
            throw new Error('Indica cuál es el premio');
        }
        if (!nombre) {
            throw new Error('Indica el nombre del programa');
        }
        return FidelizacionRepository.guardarPrograma(tenantId, {
            nombre,
            sellosRequeridos,
            montoMinimo,
            premio,
            activo: datos.activo === undefined ? true : Boolean(datos.activo)
        });
    }

    // ---- Tarjetas ----------------------------------------------------------

    static async inscribir(tenantId, { clienteId, consentimiento }) {
        if (!consentimiento) {
            throw new Error('El cliente debe autorizar el tratamiento de sus datos para tener la tarjeta');
        }
        await TenantOwnership.clientes(tenantId, clienteId);
        const programa = await FidelizacionRepository.obtenerPrograma(tenantId);
        if (!programa || !programa.activo) {
            throw new Error('Primero configura y activa el programa de sellos');
        }
        const existente = await FidelizacionRepository.obtenerTarjetaPorCliente(tenantId, clienteId);
        if (existente) {
            return { tarjeta: FidelizacionService._publica(existente), nueva: false };
        }

        for (let intento = 0; intento < 5; intento++) {
            const numero = `GF${crypto.randomInt(10000000, 99999999)}`;
            const tokenPublico = crypto.randomBytes(18).toString('hex');
            try {
                const id = await FidelizacionRepository.crearTarjeta({ tenantId, clienteId, numero, tokenPublico });
                const tarjeta = await FidelizacionRepository.obtenerTarjetaPorId(tenantId, id);
                return { tarjeta: FidelizacionService._publica(tarjeta), nueva: true };
            } catch (error) {
                if (error.code !== 'ER_DUP_ENTRY') {
                    throw error;
                }
                const yaCreada = await FidelizacionRepository.obtenerTarjetaPorCliente(tenantId, clienteId);
                if (yaCreada) {
                    return { tarjeta: FidelizacionService._publica(yaCreada), nueva: false };
                }
            }
        }
        throw new Error('No se pudo generar la tarjeta, intenta de nuevo');
    }

    static async listar(tenantId, filtros = {}) {
        const tarjetas = await FidelizacionRepository.listarTarjetas(tenantId, filtros);
        return tarjetas.map(FidelizacionService._publica);
    }

    static async obtenerPorCliente(tenantId, clienteId) {
        const t = await FidelizacionRepository.obtenerTarjetaPorCliente(tenantId, clienteId);
        return t ? FidelizacionService._publica(t) : null;
    }

    static async detalle(tenantId, tarjetaId) {
        const t = await FidelizacionRepository.obtenerTarjetaPorId(tenantId, tarjetaId);
        if (!t) {
            throw new Error('Tarjeta no encontrada');
        }
        const movimientos = await FidelizacionRepository.listarMovimientos(tenantId, tarjetaId);
        return { tarjeta: FidelizacionService._publica(t), movimientos };
    }

    // ---- Sello por factura ---------------------------------------------------

    /**
     * Suma el sello de una factura. Seguro de llamar varias veces para la misma factura
     * (idempotente). Nunca lanza: una falla aquí no debe afectar la venta ya cobrada.
     */
    static async sellarPorFactura({ tenantId, facturaId, clienteId, total, usuarioId = null }) {
        try {
            if (!clienteId) {
                return { sellado: false, motivo: 'sin_cliente' };
            }
            const programa = await FidelizacionRepository.obtenerPrograma(tenantId);
            if (!programa || !programa.activo) {
                return { sellado: false, motivo: 'programa_inactivo' };
            }
            if (Number(total) < Number(programa.monto_minimo)) {
                return { sellado: false, motivo: 'monto_insuficiente' };
            }

            const resultado = await FidelizacionService._aplicarSello({
                tenantId,
                facturaId,
                clienteId,
                usuarioId,
                programa
            });
            if (resultado.sellado) {
                FidelizacionService.sincronizarWallet(tenantId, resultado.tarjetaId, {
                    avisar: resultado.premioGanado
                }).catch(() => {});
            }
            return resultado;
        } catch (error) {
            console.error('Fidelización: no se pudo sellar la factura', facturaId, error.message);
            return { sellado: false, motivo: 'error' };
        }
    }

    static async _aplicarSello({ tenantId, facturaId, clienteId, usuarioId, programa }) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            const tarjeta = await FidelizacionRepository.obtenerTarjetaPorCliente(
                tenantId,
                clienteId,
                connection,
                true
            );
            if (!tarjeta || tarjeta.estado !== 'activa') {
                await connection.rollback();
                return { sellado: false, motivo: 'sin_tarjeta' };
            }
            const nuevo = await FidelizacionRepository.registrarMovimiento(connection, {
                tenantId,
                tarjetaId: tarjeta.id,
                tipo: 'sello',
                facturaId,
                usuarioId
            });
            if (!nuevo) {
                await connection.rollback();
                return { sellado: false, motivo: 'ya_sellada' };
            }

            let sellos = tarjeta.sellos + 1;
            let premiosDisponibles = tarjeta.premios_disponibles;
            let premioGanado = false;
            if (sellos >= programa.sellos_requeridos) {
                sellos = 0;
                premiosDisponibles += 1;
                premioGanado = true;
                await FidelizacionRepository.registrarMovimiento(connection, {
                    tenantId,
                    tarjetaId: tarjeta.id,
                    tipo: 'premio_ganado',
                    facturaId,
                    usuarioId
                });
            }
            await FidelizacionRepository.actualizarContadores(connection, tarjeta.id, {
                sellos,
                sellosHistoricos: tarjeta.sellos_historicos + 1,
                premiosDisponibles,
                premiosCanjeados: tarjeta.premios_canjeados
            });
            await connection.commit();
            return { sellado: true, tarjetaId: tarjeta.id, sellos, premiosDisponibles, premioGanado };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // ---- Canje ---------------------------------------------------------------

    static async canjear(tenantId, tarjetaId, usuarioId = null) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            const tarjeta = await FidelizacionRepository.obtenerTarjetaPorId(tenantId, tarjetaId, connection, true);
            if (!tarjeta) {
                throw new Error('Tarjeta no encontrada');
            }
            if (tarjeta.estado !== 'activa') {
                throw new Error('La tarjeta está anulada');
            }
            if (tarjeta.premios_disponibles < 1) {
                throw new Error('Esta tarjeta no tiene premios por canjear');
            }
            await FidelizacionRepository.registrarMovimiento(connection, {
                tenantId,
                tarjetaId,
                tipo: 'canje',
                usuarioId
            });
            await FidelizacionRepository.actualizarContadores(connection, tarjetaId, {
                sellos: tarjeta.sellos,
                sellosHistoricos: tarjeta.sellos_historicos,
                premiosDisponibles: tarjeta.premios_disponibles - 1,
                premiosCanjeados: tarjeta.premios_canjeados + 1
            });
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        FidelizacionService.sincronizarWallet(tenantId, tarjetaId, { avisar: false }).catch(() => {});
        return FidelizacionService.detalle(tenantId, tarjetaId);
    }

    // ---- Google Wallet -------------------------------------------------------

    /** Crea o actualiza la tarjeta en Wallet con los datos actuales. Devuelve el enlace de guardado. */
    static async sincronizarWallet(tenantId, tarjetaId, { avisar = false } = {}) {
        if (!walletConfigurado()) {
            return { sincronizada: false, motivo: 'wallet_no_configurado' };
        }
        try {
            const tarjeta = await FidelizacionRepository.obtenerTarjetaPorId(tenantId, tarjetaId);
            if (!tarjeta) {
                throw new Error('Tarjeta no encontrada');
            }
            const programa = await FidelizacionRepository.obtenerPrograma(tenantId);
            const restaurante = await FidelizacionService._nombreRestaurante(tenantId);
            const datos = {
                numeroTarjeta: tarjeta.numero,
                nombre: tarjeta.cliente_nombre,
                token: tarjeta.token_publico,
                sellos: tarjeta.sellos,
                total: programa.sellos_requeridos,
                premio: programa.premio,
                premiosDisponibles: tarjeta.premios_disponibles,
                restaurante
            };
            let enlace;
            if (tarjeta.wallet_sincronizada_at) {
                // Ya existe en Google: basta un PATCH con el estado nuevo.
                try {
                    await GoogleWalletService.actualizarTarjeta(tarjeta.numero, {
                        sellos: datos.sellos,
                        total: datos.total,
                        premio: datos.premio,
                        premiosDisponibles: datos.premiosDisponibles,
                        restaurante: datos.restaurante
                    });
                    enlace = GoogleWalletService.enlaceDeTarjeta(tarjeta.numero);
                } catch {
                    enlace = (await GoogleWalletService.crearTarjeta(datos)).enlace;
                }
            } else {
                // POST y, si ya existía, PATCH.
                enlace = (await GoogleWalletService.crearTarjeta(datos)).enlace;
            }
            if (avisar) {
                await GoogleWalletService.enviarMensaje(
                    tarjeta.numero,
                    '¡Ganaste un premio!',
                    `Completaste tu tarjeta en ${restaurante}. Pide tu premio: ${programa.premio}.`,
                    true
                ).catch(error => console.error('Fidelización: aviso de premio falló:', error.message));
            }
            await FidelizacionRepository.marcarSincronizada(tarjeta.id);
            return { sincronizada: true, enlace };
        } catch (error) {
            console.error('Fidelización: no se pudo sincronizar con Wallet:', error.message);
            return { sincronizada: false, motivo: 'error_wallet', error: error.message };
        }
    }

    /** Enlace "Agregar a Google Wallet" (crea el pase en Google si aún no existe). */
    static async enlaceWallet(tenantId, tarjetaId) {
        const r = await FidelizacionService.sincronizarWallet(tenantId, tarjetaId);
        if (!r.sincronizada) {
            throw new Error(
                r.motivo === 'wallet_no_configurado'
                    ? 'Google Wallet no está configurado en el servidor'
                    : 'No se pudo preparar la tarjeta en Google Wallet'
            );
        }
        return r.enlace;
    }

    // ---- Página pública (por token) --------------------------------------------

    static async vistaPublica(token) {
        if (!/^[a-f0-9]{36}$/.test(String(token))) {
            return null;
        }
        const t = await FidelizacionRepository.obtenerTarjetaPorToken(token);
        if (!t) {
            return null;
        }
        const programa = await FidelizacionRepository.obtenerPrograma(t.tenant_id);
        if (!programa) {
            return null;
        }
        return {
            numero: t.numero,
            cliente: t.cliente_nombre,
            restaurante: await FidelizacionService._nombreRestaurante(t.tenant_id),
            sellos: t.sellos,
            total: programa.sellos_requeridos,
            premio: programa.premio,
            premiosDisponibles: t.premios_disponibles
        };
    }

    static async enlaceWalletPublico(token) {
        if (!/^[a-f0-9]{36}$/.test(String(token))) {
            return null;
        }
        const t = await FidelizacionRepository.obtenerTarjetaPorToken(token);
        if (!t) {
            return null;
        }
        return FidelizacionService.enlaceWallet(t.tenant_id, t.id);
    }

    // ---- Utilidades ----------------------------------------------------------

    static async _nombreRestaurante(tenantId) {
        try {
            const [rows] = await db.query('SELECT nombre FROM tenants WHERE id = ?', [tenantId]);
            return rows[0]?.nombre || 'Restaurante';
        } catch {
            return 'Restaurante';
        }
    }

    /** Lo que se devuelve al frontend: sin el token interno de escritura, con el enlace público. */
    static _publica(t) {
        return {
            id: t.id,
            cliente_id: t.cliente_id,
            cliente_nombre: t.cliente_nombre,
            cliente_telefono: t.cliente_telefono,
            numero: t.numero,
            token_publico: t.token_publico,
            sellos: t.sellos,
            sellos_historicos: t.sellos_historicos,
            premios_disponibles: t.premios_disponibles,
            premios_canjeados: t.premios_canjeados,
            estado: t.estado,
            wallet_sincronizada_at: t.wallet_sincronizada_at
        };
    }
}

module.exports = FidelizacionService;
