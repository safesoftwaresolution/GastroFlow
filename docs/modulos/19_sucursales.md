# 19. Sucursales

Un restaurante (tenant "padre") puede tener **sucursales**. Una sucursal es un tenant normal con
`tenant_padre_id` apuntando al padre: tiene sus propios productos, mesas, caja, inventario y
usuarios, y se factura/cobra por separado. No hay tablas nuevas de datos operativos.

## Modelo

| Columna | Tabla | Significado |
|---|---|---|
| `tenant_padre_id` | `tenants` | `NULL` = tenant independiente (todos los existentes). Con valor = sucursal de ese tenant. Un solo nivel: una sucursal no tiene sucursales. |
| `max_sucursales` | `tenants` | Cupo que fija el superadmin por tenant. `0` = el restaurante no ve el módulo. |
| `debe_cambiar_password` | `usuarios` | `1` = contraseña temporal; debe cambiarla antes de usar el sistema. |

Migraciones: `118_sucursales.sql`, `119_sucursales_control.sql`. Permiso: `sucursales.gestionar`
(roles admin y superadmin). Un tenant solo ve el módulo si tiene el permiso, **no es sucursal** y
tiene `max_sucursales > 0` (`SucursalesController.exigirPadre`).

## Código

| Capa | Archivos |
|---|---|
| Servicios | `services/Shared/SucursalService.js`, `ConsolidadoSucursalesService.js` |
| Repositorios | `repositories/Admin/SucursalRepository.js`, `ConsolidadoSucursalesRepository.js` |
| Controladores | `app/Http/Controllers/Tenant/SucursalesController.js`, `Admin/SucursalesController.js` |
| Rutas | `routes/tenant/sucursales.js` (`/api/sucursales`), `routes/admin/sucursales.js` (`/admin/sucursales`), páginas en `routes/web.js` |
| Vistas | `views/sucursales/{index,consolidado}.ejs`, `views/admin/sucursales/index.ejs` |
| JS | `public/js/modulos/sucursales*.js`, `public/js/admin/sucursales.js`, `public/js/core/sucursal-contexto.js` |

## Flujos

**Crear (tenant o superadmin).** Una transacción crea el tenant hijo, su usuario `admin` y su rol.
Para el tenant, el padre sale de la sesión (nunca del body), se re-verifica el cupo con la fila del
padre bloqueada (`FOR UPDATE`) y la sucursal hereda el plan del padre. El superadmin elige padre y
plan y no está sujeto al cupo. El `username` es único global; el slug se genera solo. Después se
siembran los datos iniciales (igual que `createTenant`).

**Control del padre.** Activar/desactivar una sucursal, definir una contraseña temporal para su admin
(queda obligado a cambiarla), todo verificando que la sucursal sea suya (404 si no). Una sucursal
suspendida por pago no se reactiva a mano.

**Cascada.** Si el padre está desactivado o suspendido por pago, sus sucursales no pueden entrar
(login y cada petición; `utils/tenantMessages.getBloqueoPorPadre`). Al revés no aplica.

**Borrado.** `TenantCRUDService.deleteTenant` rechaza (409) borrar un restaurante con sucursales.

**Consolidado (`/sucursales/consolidado`).** Solo lectura y solo totales del padre + sus sucursales
en un rango (por defecto, mes en curso Colombia; máx. 366 días): totales, ticket promedio, por
local, por medio de pago y por día. Excluye ventas de eventos.

**Entrar a una sucursal (un solo login).** `POST /api/sucursales/:id/entrar` valida que el usuario
pertenezca (en la BD) al padre y que la sucursal sea suya y esté activa, y emite un JWT del **mismo
usuario** con `tenant_id` de la sucursal. `attachTenantContext` solo acepta un `tenant_id` del token
distinto al del usuario si ese tenant es **hijo** del tenant del usuario en la BD; si no, 403. En la
sucursal los permisos se filtran por el plan de la sucursal, aparece un aviso fijo con el botón
"Volver al principal" (`POST /auth/volver-principal`, que vuelve al tenant de la BD, no al del token)
y no se puede gestionar sucursales ni ver el consolidado hasta volver.

## Auditoría

`tenant_audit` (bajo el padre, sobrevive al borrado de la sucursal): `sucursal_creada`,
`sucursal_activada`, `sucursal_desactivada`, `sucursal_password_reset`, `sucursal_acceso`,
`sucursales_limite`. Un fallo al auditar nunca tumba la operación.

## Pruebas

`tests/unit/services/{SucursalService,ConsolidadoSucursalesService}.test.js` y
`tests/unit/middleware/tenantSucursales.test.js` (repositorios simulados).
