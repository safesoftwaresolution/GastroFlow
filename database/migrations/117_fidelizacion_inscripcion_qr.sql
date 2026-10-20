-- 117_fidelizacion_inscripcion_qr.sql
-- Autoinscripción por QR: cada restaurante tiene un token propio de inscripción (el QR que
-- imprime en el local) y cada tarjeta guarda desde dónde se dio el consentimiento
-- (evidencia para Ley 1581 de 2012: fecha, origen e IP).

ALTER TABLE fidelizacion_programas ADD COLUMN token_inscripcion VARCHAR(48) NULL AFTER activo;
ALTER TABLE fidelizacion_programas ADD UNIQUE KEY uq_fid_programa_token (token_inscripcion);

ALTER TABLE fidelizacion_tarjetas ADD COLUMN consentimiento_origen ENUM('caja', 'qr') NOT NULL DEFAULT 'caja' AFTER consentimiento_at;
ALTER TABLE fidelizacion_tarjetas ADD COLUMN consentimiento_ip VARCHAR(45) NULL AFTER consentimiento_origen;
