-- 121_fidelizacion_diseno.sql
-- Diseño propio de la tarjeta de sellos por restaurante: plantilla (las mismas de los bonos), color
-- opcional que reemplaza al del negocio y caché de las imágenes del pase de Google Wallet
-- (una por cantidad de sellos, se regeneran solas cuando cambia el diseño).

ALTER TABLE fidelizacion_programas ADD COLUMN diseno VARCHAR(30) NOT NULL DEFAULT 'clasico' AFTER premio;
ALTER TABLE fidelizacion_programas ADD COLUMN color VARCHAR(7) NULL AFTER diseno;
ALTER TABLE fidelizacion_programas ADD COLUMN wallet_imagenes TEXT NULL AFTER color;
