-- 115_anuncios.sql
-- Anuncios (modales informativos) que el superadmin publica para los restaurantes:
-- nuevas funcionalidades, actualizaciones, tutoriales o avisos importantes.
-- planes / roles / items guardan JSON como texto (NULL = sin restriccion / sin lista) para
-- funcionar igual en MySQL y en el MariaDB del modo Electron.

CREATE TABLE IF NOT EXISTS anuncios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tipo ENUM('funcionalidad', 'actualizacion', 'tutorial', 'aviso') NOT NULL DEFAULT 'funcionalidad',
    titulo VARCHAR(120) NOT NULL,
    cuerpo TEXT NULL,
    items TEXT NULL COMMENT 'JSON: lista de puntos / pasos',
    version VARCHAR(20) NULL,
    boton_texto VARCHAR(40) NULL,
    boton_url VARCHAR(255) NULL,
    color_acento VARCHAR(7) NULL,
    frecuencia ENUM('una_vez', 'cada_login') NOT NULL DEFAULT 'una_vez',
    planes TEXT NULL COMMENT 'JSON: ids de plan, NULL = todos',
    roles TEXT NULL COMMENT 'JSON: roles, NULL = todos',
    fecha_inicio DATE NULL,
    fecha_fin DATE NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_anuncios_activo (activo, fecha_inicio, fecha_fin)
);

CREATE TABLE IF NOT EXISTS anuncios_vistos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    anuncio_id INT NOT NULL,
    usuario_id INT NOT NULL,
    tenant_id INT NULL,
    vistas INT NOT NULL DEFAULT 1,
    clics INT NOT NULL DEFAULT 0,
    no_mostrar TINYINT(1) NOT NULL DEFAULT 0,
    primera_vista TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ultima_vista TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_anuncio_usuario (anuncio_id, usuario_id),
    INDEX idx_vistos_usuario (usuario_id),
    CONSTRAINT fk_anuncios_vistos_anuncio FOREIGN KEY (anuncio_id) REFERENCES anuncios(id) ON DELETE CASCADE
);
