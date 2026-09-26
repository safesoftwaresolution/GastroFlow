const toggleBtn = document.getElementById('togglePwd');
const pwdInput = document.getElementById('password');
const toggleIcon = document.getElementById('togglePwdIcon');

toggleBtn.addEventListener('click', () => {
    const isHidden = pwdInput.type === 'password';
    pwdInput.type = isHidden ? 'text' : 'password';
    toggleIcon.className = isHidden ? 'bi bi-eye-slash' : 'bi bi-eye';
});

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
    GF.cargando(document.getElementById('btnRegistro'), loading, 'Creando cuenta...');
}

document.getElementById('registroForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    hideError();

    const nombre_completo = document.getElementById('nombre_completo').value.trim();
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const password_confirm = document.getElementById('password_confirm').value;

    if (!nombre_completo || !username || !email || !password || !password_confirm) {
        showError('Por favor completa todos los campos.');
        return;
    }
    if (password !== password_confirm) {
        showError('Las contraseñas no coinciden.');
        return;
    }

    setLoading(true);

    try {
        const response = await fetch('/auth/registro', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre_completo, username, email, password, password_confirm })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error al crear la cuenta');
        }

        Swal.fire({
            icon: 'success',
            title: '¡Cuenta creada!',
            text: 'Revisa tu correo y haz clic en el link de verificación para continuar.',
            confirmButtonText: 'Entendido'
        }).then(() => {
            window.location.href = '/auth/login';
        });
    } catch (error) {
        showError(error.message);
        setLoading(false);
    }
});
