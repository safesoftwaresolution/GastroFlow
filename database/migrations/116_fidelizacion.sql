-- 116_fidelizacion.sql
-- Fidelización: tarjetas de sellos digitales (se instalan en Google Wallet / Apple Wallet).
-- Un programa por restaurante; una tarjeta por cliente inscrito (la inscripción exige
-- consentimiento explícito, Ley 1581 de 2012). Cada factura suma como máximo un sello:
-- UNIQUE (tipo, factura_id) en los movimientos lo garantiza aunque el proceso se repita.

CREATE TABLE IF NOT EXISTS fidelizacion_programas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    nombre VARCHAR(80) NOT NULL DEFAULT 'Tarjeta de sellos',
    sellos_requeridos INT NOT NULL DEFAULT 8,
    monto_minimo DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Total mínimo de la factura para ganar un sello',
    premio VARCHAR(120) NOT NULL DEFAULT 'Premio de la casa',
    activo TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_fid_programa_tenant (tenant_id),
    CONSTRAINT fk_fid_programa_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS fidelizacion_tarjetas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    cliente_id INT NOT NULL,
    numero VARCHAR(20) NOT NULL,
    token_publico VARCHAR(48) NOT NULL,
    sellos INT NOT NULL DEFAULT 0 COMMENT 'Sellos del ciclo actual (0 .. requeridos-1)',
    sellos_historicos INT NOT NULL DEFAULT 0,
    premios_disponibles INT NOT NULL DEFAULT 0,
    premios_canjeados INT NOT NULL DEFAULT 0,
    wallet_sincronizada_at TIMESTAMP NULL,
    consentimiento_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado ENUM('activa', 'anulada') NOT NULL DEFAULT 'activa',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_fid_tarjeta_cliente (tenant_id, cliente_id),
    UNIQUE KEY uq_fid_tarjeta_numero (numero),
    UNIQUE KEY uq_fid_tarjeta_token (token_publico),
    CONSTRAINT fk_fid_tarjeta_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_fid_tarjeta_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS fidelizacion_movimientos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    tarjeta_id INT NOT NULL,
    tipo ENUM('sello', 'premio_ganado', 'canje') NOT NULL,
    cantidad INT NOT NULL DEFAULT 1,
    factura_id INT NULL,
    usuario_id INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_fid_mov_factura (tipo, factura_id),
    INDEX idx_fid_mov_tarjeta (tarjeta_id, created_at),
    CONSTRAINT fk_fid_mov_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_fid_mov_tarjeta FOREIGN KEY (tarjeta_id) REFERENCES fidelizacion_tarjetas(id) ON DELETE CASCADE,
    CONSTRAINT fk_fid_mov_factura FOREIGN KEY (factura_id) REFERENCES facturas(id) ON DELETE SET NULL,
    CONSTRAINT fk_fid_mov_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

INSERT INTO permisos (nombre, descripcion) VALUES
('fidelizacion.ver', 'Ver tarjetas de sellos y su historial'),
('fidelizacion.gestionar', 'Configurar el programa, inscribir clientes y canjear premios')
ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion);

INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p
WHERE r.nombre IN ('admin', 'superadmin', 'cajero') AND p.nombre IN ('fidelizacion.ver', 'fidelizacion.gestionar')
ON DUPLICATE KEY UPDATE rol_id = rol_id;
