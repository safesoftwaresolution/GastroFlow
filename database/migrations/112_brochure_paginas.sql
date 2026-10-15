-- 112_brochure_paginas.sql
-- Brochure / carta del restaurante: páginas (imagen o PDF) que se muestran como
-- carrusel en el menú digital QR, además del menú normal. Los archivos viven en
-- Cloudflare R2 (carpeta "brochure"); aquí solo se guarda la URL pública.
USE restaurante;

CREATE TABLE IF NOT EXISTS brochure_paginas (
    id          INT           PRIMARY KEY AUTO_INCREMENT,
    tenant_id   INT           NOT NULL,
    url         VARCHAR(500)  NOT NULL,
    tipo        ENUM('imagen', 'pdf') NOT NULL DEFAULT 'imagen',
    nombre      VARCHAR(150)  DEFAULT NULL COMMENT 'Nombre original del archivo',
    orden       SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    INDEX idx_brochure_tenant (tenant_id, orden)
);
