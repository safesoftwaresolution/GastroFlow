-- 113_productos_disponible.sql
-- Disponibilidad temporal de un producto (agotado / fuera de carta): distinto de `activo`,
-- que es el soft-delete (029). Con disponible = 0 el producto NO se ofrece en la carta QR,
-- el POS ni Mesas, pero sigue en el catalogo de Productos para volver a activarlo.

ALTER TABLE productos ADD COLUMN disponible TINYINT(1) NOT NULL DEFAULT 1;
CREATE INDEX idx_productos_disponible ON productos(tenant_id, activo, disponible);
