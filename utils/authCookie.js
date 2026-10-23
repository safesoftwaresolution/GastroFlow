/**
 * Cookie de sesión (JWT httpOnly). Única definición: login, entrar a una sucursal y volver
 * al restaurante principal emiten la misma cookie.
 */
function setAuthCookie(res, token) {
    res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000
    });
}

module.exports = { setAuthCookie };
