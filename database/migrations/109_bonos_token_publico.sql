-- Migration: 109_bonos_token_publico.sql
-- Token público de cada bono. El QR del comprobante deja de contener solo el
-- código corto (BONO-XXXXXX, ~10^9 combinaciones: sirve para canjear en caja
-- con un cajero autenticado, pero sería enumerable en una página pública) y
-- pasa a apuntar a /bono/<token>, una página sin login donde el cliente ve su
-- saldo, vigencia y cómo reclamarlo. El token es largo y aleatorio, distinto
-- del código, y es lo único que abre esa página.

USE restaurante;

ALTER TABLE bonos ADD COLUMN token_publico VARCHAR(32) NULL AFTER codigo;

-- Bonos ya emitidos: se les asigna un token (24 hex de un SHA2 sobre UUID + RAND + id).
UPDATE bonos
SET token_publico = SUBSTRING(SHA2(CONCAT(UUID(), RAND(), id), 256), 1, 24)
WHERE token_publico IS NULL;

ALTER TABLE bonos ADD UNIQUE KEY uq_bonos_token_publico (token_publico);
