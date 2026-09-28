-- Migration: 107_proveedor_facturas_vencimiento_estado.sql
-- Convierte proveedor_facturas de solo repositorio de PDFs a una cuenta por
-- pagar real: fecha de vencimiento y estado de pago, para que Finanzas pueda
-- mostrar "qué le debo a quién y cuándo se vence".

ALTER TABLE proveedor_facturas
    ADD COLUMN fecha_vencimiento DATE NULL AFTER fecha_emision,
    ADD COLUMN estado ENUM('pendiente', 'pagada') NOT NULL DEFAULT 'pendiente' AFTER monto_total,
    ADD COLUMN fecha_pago DATE NULL AFTER estado;

CREATE INDEX idx_proveedor_facturas_estado ON proveedor_facturas (tenant_id, estado, fecha_vencimiento);
