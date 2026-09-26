/**
 * Helper compartido para encolar un job pesado (PDF con puppeteer) y esperar el
 * resultado sin bloquear el request: hace polling a /admin/jobs/:id y redirige a
 * /admin/jobs/:id/download cuando el worker (config/bootstrap.js, cada 15s) termina.
 */
function pollJobAndDownload(createJobUrl, options) {
    options = options || {};
    var onError = options.onError || function (msg) { window.alert(msg); };
    var onStart = options.onStart || function () {};
    var onDone = options.onDone || function () {};

    onStart();

    GF.api(createJobUrl, {}, 'No se pudo iniciar la generación.')
        .then(function (data) {
            if (!data || !data.jobId) throw new Error('No se pudo iniciar la generación.');
            poll(data.jobId);
        })
        .catch(function (err) {
            onDone();
            onError(err.message || 'Error al generar el archivo.');
        });

    function poll(jobId) {
        GF.api('/admin/jobs/' + jobId)
            .then(function (job) {
                if (job.estado === 'completado') {
                    onDone();
                    window.location.href = '/admin/jobs/' + jobId + '/download';
                } else if (job.estado === 'error') {
                    onDone();
                    onError(job.error || 'Error al generar el archivo.');
                } else {
                    setTimeout(function () { poll(jobId); }, 2000);
                }
            })
            .catch(function () {
                setTimeout(function () { poll(jobId); }, 3000);
            });
    }
}
