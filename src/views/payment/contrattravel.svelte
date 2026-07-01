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
    import { getMonthName } from "../../lib/utils.js";

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
    $: contratoUrl = localContratoUrl || $openingStore.user_contrato || "";
    $: idcl = $tenantStore || "demo";

    let localContratoUrl = "";
    let sessionId = "";

    const getInitialForm = () => ({
        vtaDia: "",
        vtaMes: "",
        vtaAgno: "",
        rute: "",
        rsocial: "",
        nfantasia: "",
        rlegal: "",
        nlegal: "",
        edireccion: "",
        colegio: "",
        comuna: "",
        idcurso: "",
        programa: "",
        reserva: "",
        nombreapod: "",
        nombrealumno: "",
        rutapod: "",
        correoapod: "",
        fonoapod: "",
        observacion: "",
        vprograma: 0,
        tc: 0,
        liberados: 0,
        fsalida: "",
        fsalida: "",
        fsalidames: "",
        fsalidaaño: "",
        fsalidadia: "",
        fpago: "",
        TypeSale: "",
        TemplateFilename: "",
    });

    let contratoForm = getInitialForm();

    /** @type {any[]} */
    let sales = [];
    /** @type {any[]} */
    let program = [];
    /** @type {any[]} */
    let colegio = [];
    /** @type {any[]} */
    let communes = [];
    /** @type {any[]} */
    let pasajeros = [];
    /** @type {any[]} */
    let compañia = [];
    /** @type {any[]} */
    let cursoData = [];

    // 1. Obtener los datos necesarios
    async function fetchData() {
        try {
            const saleId =
                $openingStore.sale_id || secureStorage.getItem("sale_id") || "";
            const companyConsulta = currentCompanyId
                ? `id=${currentCompanyId}`
                : "";

            const [ventaRes, cursoRes, companyRes, pasajerosRes] =
                await Promise.all([
                    api.getData("sale", "", "", saleId, schemaName),
                    api.getData("curso", "", "", cursoId, schemaName),
                    api.getData("company", "", companyConsulta, "", "global"),
                    api.getData("pasajeros", "", "", "", schemaName),
                ]);

            if (pasajerosRes.status === "success" && pasajerosRes.data) {
                pasajeros = Array.isArray(pasajerosRes.data)
                    ? pasajerosRes.data
                    : [];
            }

            if (companyRes.status === "success" && companyRes.data) {
                const comp = Array.isArray(companyRes.data)
                    ? companyRes.data[0]
                    : companyRes.data;
                compañia = comp ? [comp] : [];
            }

            if (cursoRes.status === "success" && cursoRes.data) {
                cursoData = Array.isArray(cursoRes.data)
                    ? cursoRes.data
                    : [cursoRes.data];
            }

            if (ventaRes.status === "success" && ventaRes.data) {
                const venta = ventaRes.data;
                sales = [venta];

                const programId = venta.program_id || "";
                const establecimientoId = venta.establecimiento_id || "";

                const [programacRes, schoolRes] = await Promise.all([
                    api.getData("programac", "", "", programId, schemaName),
                    api.getData(
                        "colegio",
                        "",
                        "",
                        establecimientoId,
                        schemaName,
                    ),
                ]);

                if (programacRes.status === "success" && programacRes.data) {
                    program = [programacRes.data];
                }

                if (schoolRes.status === "success" && schoolRes.data) {
                    const school = schoolRes.data;
                    colegio = [school];

                    const comunaId = school.comuna_id || "";
                    if (comunaId) {
                        const communaRes = await api.getData(
                            "comunas",
                            "",
                            "",
                            comunaId,
                            "global",
                        );
                        if (
                            communaRes.status === "success" &&
                            communaRes.data
                        ) {
                            communes = [communaRes.data];
                        }
                    }
                }

                // --------- Mapeo de datos para el contrato ---------
                const comp = compañia[0] || {};
                const schoolObj = colegio[0] || {};
                const communaObj = communes[0] || {};
                const progObj = program[0] || {};
                const cursoObj = cursoData[0] || {};

                const vtaDate = dayjs(venta.fecha);
                const vtaDia = vtaDate.format("DD");
                const vtaMes = getMonthName(vtaDate.month() + 1);
                const vtaAgno = vtaDate.format("YYYY");

                const fsalidaDate = dayjs(venta.fechasalida);
                const fsalidadia = parseInt(fsalidaDate.format("D"), 10);
                const fsalidames = getMonthName(fsalidaDate.month() + 1);
                const fsalidaaño = fsalidaDate.format("YYYY");
                let fsalidaText = "";
                if (fsalidadia <= 15) {
                    fsalidaText = `la primera quincena de ${fsalidames} ${fsalidaaño}`;
                } else {
                    fsalidaText = `la segunda quincena de ${fsalidames} ${fsalidaaño}`;
                }

                const type_sale = venta.type_sale || "";
                let template_filename = "";
                if (type_sale === "GE") {
                    template_filename = `contrato_ge_${comp.identificador || ""}.docx`;
                } else {
                    template_filename = `contrato_vg_${comp.identificador || ""}.docx`;
                }

                const vprogramaVal = Math.round(
                    Number(venta.vprograma || 0) *
                        Number(venta.tipocambio || 1),
                );

                contratoForm = {
                    ...contratoForm,
                    vtaDia,
                    vtaMes,
                    vtaAgno,
                    rute: comp.rut || "",
                    rsocial: comp.razonsocial || "",
                    nfantasia: comp.nomfantasia || "",
                    rlegal: comp.rutreplegal || "",
                    nlegal: comp.nomreplegal || "",
                    edireccion: comp.direccion || "",
                    colegio: schoolObj.nombre || "",
                    comuna: communaObj.description || "",
                    idcurso: `${venta.curso}/${venta.idcurso}`,
                    programa: progObj.name || "",
                    reserva: progObj.reserva || "",
                    nombreapod: cursoObj.nombreapod || "",
                    nombrealumno: cursoObj.nombrealumno || "",
                    rutapod: cursoObj.rutapod || "",
                    correoapod: cursoObj.correo || "",
                    fonoapod: cursoObj.correo || "",
                    observacion: venta.obs || "",
                    vprograma: vprogramaVal,
                    tc: venta.tipocambio || 0,
                    liberados: venta.liberados || 0,
                    fsalida: fsalidaText,
                    fsalidames,
                    fsalidaaño,
                    fsalidadia: fsalidadia.toString(),
                    fpago: venta.fecha_ultpag || "",
                    TypeSale: type_sale,
                    TemplateFilename: template_filename,
                };

                // Enviar form al backend
                const contratoRes = await api.setData(
                    "contrato",
                    contratoForm,
                    "",
                    "",
                    schemaName,
                );
                if (contratoRes.status === "success") {
                    const data = contratoRes.data || contratoRes;
                    sessionId = data.session_id || "";
                    localContratoUrl = data.temp_file || "";
                }
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        }
    }

    onMount(() => {
        // Añadir el listener para resize si el componente se monta
        window.addEventListener("resize", resizeCanvas);
        fetchData();
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

            const cursoObj = cursoData[0] || {};
            const saleIdStr = cursoObj.sale_id || "";
            const rutAlumnoStr = cursoObj.rutalumno
                ? cursoObj.rutalumno.replace(/[\.\-]/g, "")
                : "";

            const payloadFirma = {
                session_id: sessionId,
                firma_base64: signature64,
                file_name_firma: `contratoge_${saleIdStr}_${rutAlumnoStr}.pdf`,
            };

            // Enviar firma al endpoint
            const res = await api.setData(
                "contrato/firma",
                payloadFirma,
                "",
                "",
                schemaName,
            );
            if (res.status === "success") {
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
                {#if localContratoUrl}
                    <iframe
                        src={localContratoUrl}
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
