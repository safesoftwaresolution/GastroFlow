const reenviarForm = document.getElementById('reenviarForm');

if (reenviarForm) {
    reenviarForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
        const btn = document.getElementById('btnReenviar');
        const msgBox = document.getElementById('reenviarMsg');

        if (!email) return;

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm" style="width:1em;height:1em;border-width:2px;"></span> Enviando...';

        try {
            const data = await GF.api.post('/auth/reenviar-verificacion', { email }, 'No se pudo reenviar el correo.');
            msgBox.className = 'login-alert warning';
            msgBox.style.display = 'flex';
            msgBox.innerHTML = '<i class="bi bi-info-circle-fill"></i><span>' + GF.escapeHtml(data.message || 'Listo.') + '</span>';
        } catch (error) {
            msgBox.className = 'login-alert error';
            msgBox.style.display = 'flex';
            msgBox.innerHTML = '<i class="bi bi-exclamation-circle-fill"></i><span>No se pudo reenviar el correo.</span>';
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Reenviar correo de verificación';
        }
    });
}
