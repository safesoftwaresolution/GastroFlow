const toggleBtn = document.getElementById('togglePwd');
const pwdInput = document.getElementById('password');
const toggleIcon = document.getElementById('togglePwdIcon');

toggleBtn.addEventListener('click', () => {
    const isHidden = pwdInput.type === 'password';
    pwdInput.type = isHidden ? 'text' : 'password';
    toggleIcon.className = isHidden ? 'bi bi-eye-slash' : 'bi bi-eye';
});

// Tokens que versiones anteriores guardaban en localStorage: se borran siempre.
localStorage.removeItem('auth_token');
localStorage.removeItem('user');

function showError(msg) {
    const box = document.getElementById('errorAlert');
    document.getElementById('errorMsg').textContent = msg;
    box.style.display = 'flex';
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideError() {
    document.getElementById('errorAlert').style.display = 'none';
}

function setLoading(loading) {
    GF.cargando(document.getElementById('btnLogin'), loading, 'Verificando...');
}

document.getElementById('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    hideError();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
        showError('Por favor completa todos los campos.');
        return;
    }

    setLoading(true);

    try {
        const data = await GF.api('/auth/login', {
            method: 'POST',
            body: { username, password }
        }, 'Error al iniciar sesión');

        // La sesión va en la cookie httpOnly que pone el servidor. El token ya no
        // se guarda en localStorage: nada lo lee y ahí quedaba expuesto a cualquier
        // script inyectado (XSS). Al cargar esta página se limpian los que quedaron.
        const rol = (data.user.rol || '').toString().toLowerCase();
        const isSuperadmin = rol === 'superadmin';

        Swal.fire({
            icon: 'success',
            title: `¡Hola, ${data.user.nombre_completo || data.user.username}!`,
            text: 'Acceso concedido. Redirigiendo...',
            timer: 1400,
            showConfirmButton: false
        }).then(() => {
            window.location.href = isSuperadmin ? '/admin/dashboard' : '/';
        });

    } catch (error) {
        showError(error.message);
        setLoading(false);
    }
});
