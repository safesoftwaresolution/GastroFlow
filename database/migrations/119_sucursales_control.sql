-- 119_sucursales_control.sql
-- Control de sucursales (fase 2): el administrador que crea o resetea el padre debe cambiar su
-- contrasena en el primer ingreso. 1 = obligado a cambiarla antes de usar el sistema.

ALTER TABLE usuarios ADD COLUMN debe_cambiar_password TINYINT(1) NOT NULL DEFAULT 0;
