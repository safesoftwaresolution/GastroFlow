-- 114_caja_movimientos_metodo_pago.sql
-- Metodo de pago de cada movimiento (ingreso/egreso) de caja: efectivo o transferencia.
-- Los movimientos existentes quedan como 'efectivo' (asi se trataban hasta ahora en el arqueo).

ALTER TABLE caja_movimientos
    ADD COLUMN metodo_pago ENUM('efectivo', 'transferencia') NOT NULL DEFAULT 'efectivo';
