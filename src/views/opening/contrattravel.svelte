<script>
    import { onMount, onDestroy } from "svelte";
    import { fade } from "svelte/transition";
    import { navigate } from "svelte-routing";
    import { secureStorage } from "../../lib/secureStore";
    import { tenantStore } from "../../stores/tenant";
    import { openingStore } from "../../stores/openingStore";
    import SignaturePad from "signature_pad";
    import dayjs from "dayjs";
    import api from "../../lib/apis.js";
    import Swal from "sweetalert2";

    let canvas;
    let signaturePad;
    let isAccepted = false;
    let isLoading = false;

    const userData = secureStorage.getItem("_us_") || {};
    const schemaName = userData.schema || "";
    const author = userData.username || "";
    const currentCompanyId = userData.company || 0;

    // Obtener la URL del contrato desde el store
    $: cursoId = $openingStore.user_curso_id;
    $: contratoUrl = $openingStore.user_contrato || "";
    $: idcl = $tenantStore || "demo";

    onMount(() => {
        // Añadir el listener para resize si el componente se monta
        window.addEventListener("resize", resizeCanvas);
    });

    onDestroy(() => {
        window.removeEventListener("resize", resizeCanvas);
    });

    // Esta función se llama cuando el checkbox es marcado para inicializar el canvas
    function initSignaturePad(node) {
        signaturePad = new SignaturePad(node, {
            backgroundColor: "rgb(255, 255, 255)",
            penColor: "rgb(0, 0, 0)",
        });

        // Asignamos el canvas al resize
        canvas = node;
        resizeCanvas();

        return {
            destroy() {
                if (signaturePad) {
                    signaturePad.off();
                }
            },
        };
    }

    function resizeCanvas() {
        if (!canvas) return;
        // La relación de píxeles del dispositivo puede hacer que las firmas se vean borrosas o tengan coordenadas incorrectas si no se maneja
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext("2d").scale(ratio, ratio);

        if (signaturePad) {
            signaturePad.clear();
        }
    }

    function clearSignature() {
        if (signaturePad) {
            signaturePad.clear();
        }
    }

    async function handleContinue() {
        if (!isAccepted) {
            Swal.fire(
                "Atención",
                "Debe aceptar los términos y condiciones del contrato.",
                "warning",
            );
            return;
        }
        if (signaturePad && signaturePad.isEmpty()) {
            Swal.fire(
                "Atención",
                "Debe firmar el contrato antes de continuar.",
                "warning",
            );
            return;
        }

        const signature64 = signaturePad
            ? signaturePad.toDataURL("image/png")
            : "";

        try {
            isLoading = true;
            
            const userData = secureStorage.getItem("_us_") || {};

            const payload = {
                acepta_contrato: 1,
                signaturepng: signature64,
                autor: userData.name || "Apoderado",
            };

            // Actualizar la tabla curso usando el user_curso_id
            const res = await api.updateData(
                "curso",
                payload,
                "",
                cursoId,
                schemaName,
            );
            if (res.status === "success") {
                // En PHP se llamaba a $this->contratotopdf. Si tienes un endpoint para eso en Go, puedes llamarlo aquí:
                // await api.setData("sale/contratotopdf", { signature64: signature64, sale_id: $openingStore.sale_id }, "", "", "global");

                // Actualizamos el estado para indicar que el contrato está firmado
                secureStorage.setItem("paso", "3"); // Equivalente a Session::set('paso','2') para avanzar al paso de pagos
                secureStorage.setItem("user_contrato", "S");

                openingStore.update((s) => ({
                    ...s,
                    user_curso_id: cursoId,
                    pasoActual: 3,
                    user_contrato: "S",
                }));

                Swal.fire(
                    "Éxito",
                    "Contrato firmado y aceptado correctamente.",
                    "success",
                ).then(() => {
                    navigate(`/${idcl}/opening`);
                });
            } else {
                Swal.fire(
                    "Error",
                    res.message || "No se pudo guardar la firma.",
                    "error",
                );
            }
        } catch (error) {
            console.error("Error al enviar la firma:", error);
            Swal.fire(
                "Error",
                "Error de red al procesar el contrato.",
                "error",
            );
        } finally {
            isLoading = false;
        }
    }

    function handleCancel() {
        navigate(`/${idcl}/opening`);
    }
</script>

<div class="page-wrapper" in:fade>
    <div class="card main-card shadow-sm border-0">
        <div class="card-header-flex p-4 border-bottom">
            <div class="title-with-icon">
                <i class="fa fa-file-text-o icon-main text-primary"></i>
                <h2 class="m-0">Contrato de Prestación de Servicios</h2>
            </div>
            <button class="btn-back" on:click={handleCancel}>
                <i class="fa fa-arrow-left"></i> Cancelar y Volver
            </button>
        </div>

        <div class="card-body p-4 text-center">
            <h5 class="mb-4 text-muted">Revise el contrato antes de aceptar</h5>

            <div class="iframe-container mb-4">
                {#if contratoUrl}
                    <iframe
                        src={`https://docs.google.com/gview?url=${encodeURIComponent(contratoUrl)}&embedded=true`}
                        title="Documento Contrato"
                        frameborder="0"
                    >
                    </iframe>
                {:else}
                    <div class="alert alert-info py-5">
                        <i class="fa fa-info-circle fa-2x mb-3 d-block"></i>
                        No hay URL de contrato disponible en este momento.
                    </div>
                {/if}
            </div>

            <div class="signature-section mt-5">
                <div
                    class="form-check d-flex justify-content-center align-items-center mb-4 gap-3"
                >
                    <input
                        type="checkbox"
                        class="form-check-input mt-0"
                        id="acepto"
                        bind:checked={isAccepted}
                        style="width: 1.8rem; height: 1.8rem; cursor: pointer;"
                    />
                    <label
                        class="form-check-label fw-bold fs-5 text-dark"
                        for="acepto"
                        style="cursor: pointer;"
                    >
                        Acepto los términos y condiciones del contrato
                    </label>
                </div>

                {#if isAccepted}
                    <div class="signature-pad-container" transition:fade>
                        <div
                            class="alert alert-warning text-dark fw-bold mb-3 d-inline-block"
                        >
                            <i class="fa fa-pencil me-2"></i> Solicito haga su firma
                            ya sea usando el mouse o con lápiz en pantalla táctil
                        </div>

                        <div class="signature-wrapper">
                            <canvas use:initSignaturePad></canvas>
                        </div>

                        <div class="d-flex justify-content-center gap-3 mt-3">
                            <button
                                type="button"
                                class="btn btn-outline-danger btn-sm px-3"
                                on:click={clearSignature}
                            >
                                <i class="fa fa-eraser"></i> Limpiar Firma
                            </button>
                        </div>
                    </div>
                {/if}

                <div
                    class="form-actions mt-5 border-top pt-4 justify-content-center"
                >
                    <button
                        class="btn btn-save btn-lg px-5"
                        on:click={handleContinue}
                        disabled={isLoading || !isAccepted}
                    >
                        {#if isLoading}
                            <i class="fa fa-spinner fa-spin me-2"></i> Procesando...
                        {:else}
                            Continuar <i class="fa fa-arrow-right ms-2"></i>
                        {/if}
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
    .page-wrapper {
        padding: 24px;
        background-color: #f8f9fc;
        min-height: calc(100vh - 70px);
    }
    .main-card {
        background: white;
        border-radius: 12px;
        overflow: hidden;
    }
    .card-header-flex {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background-color: white;
    }
    .title-with-icon {
        display: flex;
        align-items: center;
        gap: 15px;
    }
    .icon-main {
        font-size: 28px;
    }
    .title-with-icon h2 {
        font-size: 22px;
        font-weight: 700;
        color: #2d3748;
    }
    .btn-back {
        background: #f8f9fc;
        color: #4e73df;
        border: 1px solid #e3e6f0;
        padding: 8px 16px;
        border-radius: 8px;
        font-weight: 600;
        transition: all 0.2s;
    }
    .btn-back:hover {
        background: #eaecf4;
    }

    .iframe-container {
        width: 100%;
        max-width: 900px;
        margin: 0 auto;
        height: 600px;
        border: 1px solid #e3e6f0;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        background: #fff;
    }
    .iframe-container iframe {
        width: 100%;
        height: 100%;
    }

    .signature-section {
        max-width: 800px;
        margin: 0 auto;
    }

    .signature-wrapper {
        position: relative;
        width: 100%;
        max-width: 600px;
        height: 300px;
        margin: 0 auto;
        border: 2px dashed #4e73df;
        border-radius: 8px;
        background-color: #f8f9fc;
        touch-action: none; /* Previene scroll en móviles al firmar */
        box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05);
    }
    .signature-wrapper canvas {
        width: 100%;
        height: 100%;
        border-radius: 6px;
    }

    .form-actions {
        display: flex;
        gap: 15px;
    }
    .btn-save {
        background: #4e73df;
        color: white;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .btn-save:hover:not(:disabled) {
        background: #2e59d9;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(78, 115, 223, 0.2);
    }
    .btn-save:disabled {
        background: #a0aec0;
        cursor: not-allowed;
    }
</style>
