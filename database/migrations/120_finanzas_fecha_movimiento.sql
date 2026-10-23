-- 120_finanzas_fecha_movimiento.sql
-- Fecha REAL de la transaccion (dia Colombia) separada de created_at (cuando se guardo el registro).
-- Asi un gasto o ingreso cargado hoy con la fecha de una factura de la semana pasada cuenta en esa
-- semana en el libro diario y en la grafica. NULL = filas viejas o insertadas sin fecha: los reportes
-- usan el dia de created_at en esos casos.

ALTER TABLE caja_movimientos ADD COLUMN fecha_movimiento DATE NULL AFTER created_at;

UPDATE caja_movimientos
SET fecha_movimiento = DATE(CONVERT_TZ(created_at, '+00:00', '-05:00'))
WHERE fecha_movimiento IS NULL;

ALTER TABLE caja_movimientos ADD INDEX idx_caja_mov_fecha (tenant_id, fecha_movimiento);
