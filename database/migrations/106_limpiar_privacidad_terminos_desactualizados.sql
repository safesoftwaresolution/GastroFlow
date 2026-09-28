-- Migration: 106_limpiar_privacidad_terminos_desactualizados.sql
-- privacy_policy/terms_conditions en producción quedaron guardados como fila
-- en landing_settings (el superadmin los pegó una vez desde /admin/landing),
-- lo que hace que ganen sobre los defaults del código aunque estos se
-- actualicen. Se borran esas dos filas para que el sistema vuelva a mostrar
-- los defaults (ya reescritos y completos) la próxima vez que se abra el
-- editor -- el superadmin los revisa y los guarda de nuevo desde ahí mismo,
-- sin que nadie tenga que tocar HTML a mano. cookies_policy/refund_policy
-- son claves nuevas que todavía no existen en producción, así que no
-- necesitan limpieza: ya van a salir con el contenido nuevo directamente.

DELETE FROM landing_settings WHERE `key` IN ('privacy_policy', 'terms_conditions');
