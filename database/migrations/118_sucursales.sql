-- 118_sucursales.sql
-- Sucursales: un tenant "hijo" ligado a un tenant "padre" (el restaurante que la creo).
-- tenant_padre_id NULL = tenant independiente (todos los existentes quedan asi).
-- max_sucursales lo fija el superadmin por tenant. 0 = el tenant no puede crear sucursales.

ALTER TABLE tenants ADD COLUMN tenant_padre_id INT NULL AFTER creado_por_usuario_id;
ALTER TABLE tenants ADD COLUMN max_sucursales INT NOT NULL DEFAULT 0 AFTER tenant_padre_id;
ALTER TABLE tenants ADD INDEX idx_tenants_padre (tenant_padre_id);
ALTER TABLE tenants ADD CONSTRAINT fk_tenants_padre FOREIGN KEY (tenant_padre_id) REFERENCES tenants(id) ON DELETE RESTRICT;

INSERT INTO permisos (nombre, descripcion) VALUES
('sucursales.gestionar', 'Crear y consultar las sucursales del restaurante')
ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion);

INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p
WHERE r.nombre IN ('admin', 'superadmin') AND p.nombre = 'sucursales.gestionar'
ON DUPLICATE KEY UPDATE rol_id = rol_id;
