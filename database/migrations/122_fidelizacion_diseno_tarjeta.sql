-- 122_fidelizacion_diseno_tarjeta.sql
-- La tarjeta de sellos deja de usar las plantillas de los bonos y pasa a tener sus propios
-- diseños (cafe, neon, ticket, minimal, pizarra, pop, elegante, fresco, retro). Cada local puede
-- poner un lema, su logo propio para la tarjeta (se sube a R2) o usar el logo de su negocio.

ALTER TABLE fidelizacion_programas ADD COLUMN lema VARCHAR(60) NULL AFTER color;
ALTER TABLE fidelizacion_programas ADD COLUMN logo_url VARCHAR(500) NULL AFTER lema;
ALTER TABLE fidelizacion_programas ADD COLUMN mostrar_logo TINYINT(1) NOT NULL DEFAULT 1 AFTER logo_url;

-- Los ids y colores de la 121 eran de las plantillas de bonos: se reinician al diseño nuevo
ALTER TABLE fidelizacion_programas MODIFY COLUMN diseno VARCHAR(30) NOT NULL DEFAULT 'cafe';
UPDATE fidelizacion_programas SET diseno = 'cafe', color = NULL, wallet_imagenes = NULL;
