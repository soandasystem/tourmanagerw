<script>
    import { onMount } from "svelte";
    import html2pdf from "html2pdf.js";
    import api from "../../lib/apis.js";
    import { secureStorage } from "../../lib/secureStore";
    import dayjs from "dayjs";
    import { formatPhone } from "../../lib/utils.js";

    export let id = null; // curso_id
    export let sale_id = null; // sale_id
    export let onClose = () => {};

    let loading = false;
    let pdfRef;

    const userData = secureStorage.getItem("_us_") || {};
    const schemaName = userData.schema || "global";
    const currentCompanyId = userData.company || 0;

    let sales = {};
    let passengers = {};
    let fm = {};
    let regions = [];
    let comunas = [];

    async function loadData() {
        if (!id || !sale_id) return;
        loading = true;
        try {
            const [regRes, comRes, salesRes, passengersRes, fmRes] =
                await Promise.all([
                    api.getData("region", "", "", "", "global"),
                    api.getData("comunas", "", "", "", "global"),
                    api.getData(
                        "sale/informe",
                        "",
                        "id=" + sale_id,
                        "",
                        schemaName,
                    ),
                    api.getData(
                        "curso",
                        "",
                        "id=" + id,
                        "",
                        schemaName,
                    ),
                    api.getData(
                        "ficha",
                        "",
                        "curso_id=" +
                            id +
                            "&company_id=" +
                            currentCompanyId +
                            "&sale_id=" +
                            sale_id,
                        "",
                        schemaName,
                    ),
                ]);

            if (regRes.status === "success")
                regions = Array.isArray(regRes.data) ? regRes.data : [];
            if (comRes.status === "success")
                comunas = Array.isArray(comRes.data) ? comRes.data : [];
            if (salesRes.status === "success")
                sales = Array.isArray(salesRes.data)
                    ? salesRes.data[0] || {}
                    : salesRes.data || {};
            if (passengersRes.status === "success")
                passengers = Array.isArray(passengersRes.data)
                    ? passengersRes.data[0] || {}
                    : passengersRes.data || {};
            if (fmRes.status === "success")
                fm = Array.isArray(fmRes.data)
                    ? fmRes.data[0] || {}
                    : fmRes.data || {};

            console.log("[medicalrecord_pdf] sales:", sales);
            console.log("[medicalrecord_pdf] passengers:", passengers);
            console.log("[medicalrecord_pdf] fm:", fm);
        } catch (error) {
            console.error("Error al cargar datos:", error);
        } finally {
            loading = false;
        }
    }

    onMount(loadData);

    const generarPDF = () => {
        if (!pdfRef) return;
        html2pdf()
            .set({
                margin: [10, 10, 10, 10],
                filename: `Ficha_Medica_${passengers.rutalumno || id}.pdf`,
                image: { type: "jpeg", quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
            })
            .from(pdfRef)
            .save();
    };

    $: regionName =
        regions.find((r) => Number(r.id) === Number(passengers.region_id))
            ?.description || "";
    $: comunaName =
        comunas.find((c) => Number(c.id) === Number(passengers.comuna_id))
            ?.description || "";
</script>

<div class="pdf-viewer-overlay">
    <div class="pdf-viewer-card">
        {#if loading}
            <div class="pdf-status-container">
                <div class="spinner"></div>
                <p>Cargando ficha médica...</p>
            </div>
        {:else}
            <div class="pdf-actions-header">
                <div class="info">
                    <h3>Ficha Médica: {passengers.nombrealumno || ""}</h3>
                    <p>RUT: {passengers.rutalumno || ""}</p>
                </div>
                <div class="buttons">
                    <button class="btn-download-pdf" on:click={generarPDF}>
                        <i class="fa fa-file-pdf-o"></i>
                        <span>Descargar PDF</span>
                    </button>
                    <button class="btn-close-pdf" on:click={onClose}>
                        <i class="fa fa-times"></i>
                        <span>Cerrar</span>
                    </button>
                </div>
            </div>

            <div class="pdf-preview-wrapper">
                <div bind:this={pdfRef} class="pdf-page">
                    <div class="pdf-header">
                        <div class="header-left">
                            <div class="brand-info">
                                <h1 class="company-name">
                                    Ficha Médica del Pasajero
                                </h1>
                                <p class="company-details">
                                    <strong>Colegio:</strong>
                                    {sales.establecimiento_nombre || ""} -
                                    <strong>Curso:</strong>
                                    {sales.curso || ""}
                                    {sales.idcurso || ""}
                                </p>
                                <p class="company-details">
                                    <strong>Destino:</strong>
                                    {sales.program_name || ""}
                                </p>
                                <p class="company-details">
                                    <strong>Fecha Salida:</strong>
                                    {sales.fechasalida
                                        ? dayjs(sales.fechasalida).format(
                                              "DD-MM-YYYY",
                                          )
                                        : ""}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div class="pdf-divider"></div>

                    <!-- TAB 1: Antecedentes Personales -->
                    <h3 class="section-title">Antecedentes Personales</h3>
                    <table class="pdf-table info-table">
                        <tbody>
                            <tr>
                                <th>Alumno:</th><td
                                    >{passengers.nombrealumno || ""}</td
                                >
                                <th>RUT:</th><td
                                    >{passengers.rutalumno || ""}</td
                                >
                            </tr>
                            <tr>
                                <th>Pasaporte:</th><td
                                    >{passengers.pasaporte || ""}</td
                                >
                                <th>Fecha Nacimiento:</th><td
                                    >{passengers.fechanac
                                        ? dayjs(passengers.fechanac).format(
                                              "DD-MM-YYYY",
                                          )
                                        : ""}</td
                                >
                            </tr>
                            <tr>
                                <th>Nacionalidad:</th><td
                                    >{passengers.nacionalidad || ""}</td
                                >
                                <th>Apoderado:</th><td
                                    >{sales.nombreapo || ""}</td
                                >
                            </tr>
                            <tr>
                                <th>Dirección:</th><td colspan="3"
                                    >{passengers.dircalle || ""}
                                    {passengers.dirnumero || ""}
                                    {passengers.nrodepto
                                        ? "Dpto " + passengers.nrodepto
                                        : ""}, {comunaName}, {regionName}</td
                                >
                            </tr>
                            <tr>
                                <th>Fono:</th><td>{passengers.fono || ""}</td>
                                <th>Celular:</th><td
                                    >{passengers.celular || ""}</td
                                >
                            </tr>
                            <tr>
                                <th>Correo:</th><td colspan="3"
                                    >{passengers.correo || ""}</td
                                >
                            </tr>
                        </tbody>
                    </table>

                    <div class="pdf-divider"></div>

                    <!-- TAB 2: Antecedentes Médicos -->
                    <h3 class="section-title">Antecedentes Médicos</h3>
                    <table class="pdf-table info-table">
                        <tbody>
                            <tr>
                                <th>Grupo Sanguíneo:</th><td
                                    >{fm.grupo_sanguineo || "-"}</td
                                >
                                <th>Edad:</th><td>{fm.edad || "-"}</td>
                                <th>Peso:</th><td
                                    >{fm.peso ? fm.peso + " kg" : "-"}</td
                                >
                                <th>Estatura:</th><td
                                    >{fm.estatura
                                        ? fm.estatura + " cm"
                                        : "-"}</td
                                >
                            </tr>
                        </tbody>
                    </table>

                    <h4 class="subsection-title">Enfermedades Preexistentes</h4>
                    <p class="data-text">
                        {#if fm.hipertension}
                            <span class="badge">Hipertensión</span>
                        {/if}
                        {#if fm.diabetes}
                            <span class="badge">Diabetes</span>
                        {/if}
                        {#if fm.asma}
                            <span class="badge">Asma</span>
                        {/if}
                        {#if fm.epilepsia}
                            <span class="badge">Epilepsia</span>
                        {/if}
                        {#if fm.arritmias}
                            <span class="badge">Arritmias</span>
                        {/if}
                        {#if fm.enfermedades_cardiacas}
                            <span class="badge">Enf. Cardíacas</span>
                        {/if}
                        {#if fm.enfermedades_respiratorias}
                            <span class="badge">Enf. Respiratorias</span>
                        {/if}
                        {#if fm.enfermedades_renales}
                            <span class="badge">Enf. Renales</span>
                        {/if}
                        {#if !fm.hipertension && !fm.diabetes && !fm.asma && !fm.epilepsia && !fm.arritmias && !fm.enfermedades_cardiacas && !fm.enfermedades_respiratorias && !fm.enfermedades_renales && !fm.otras_enfermedades}
                            Ninguna registrada.
                        {/if}
                    </p>
                    {#if fm.otras_enfermedades}
                        <p class="data-text">
                            <strong>Otras enfermedades:</strong>
                            {fm.otras_enfermedades}
                        </p>
                    {/if}

                    <h4 class="subsection-title">
                        Tratamientos y Medicamentos
                    </h4>
                    <p class="data-text">
                        <strong>Bajo tratamiento:</strong>
                        {fm.bajo_tratamiento || "No especificado"}
                    </p>
                    {#if fm.bajo_tratamiento === "Si"}
                        <table class="pdf-table info-table">
                            <tbody>
                                <tr>
                                    <th>Diagnóstico:</th><td
                                        >{fm.diagnostico || "-"}</td
                                    >
                                    <th>Medicamentos:</th><td
                                        >{fm.medicamentos_tratamiento ||
                                            "-"}</td
                                    >
                                    <th>Dosis:</th><td
                                        >{fm.dosis_tratamiento || "-"}</td
                                    >
                                </tr>
                            </tbody>
                        </table>
                    {/if}

                    <h4 class="subsection-title">Alergias</h4>
                    <p class="data-text">
                        {#if fm.alergia_medicamentos}
                            <span class="badge">Medicamentos</span>
                        {/if}
                        {#if fm.alergia_alimentos}
                            <span class="badge">Alimentos</span>
                        {/if}
                        {#if fm.alergia_insectos}
                            <span class="badge">Picaduras de insectos</span>
                        {/if}
                        {#if !fm.alergia_medicamentos && !fm.alergia_alimentos && !fm.alergia_insectos && !fm.alergia_otras}
                            Ninguna registrada.
                        {/if}
                    </p>
                    {#if fm.alergia_otras}
                        <p class="data-text">
                            <strong>Otras alergias:</strong>
                            {fm.alergia_otras}
                        </p>
                    {/if}

                    <h4 class="subsection-title">Movilidad y Asistencia</h4>
                    <table class="pdf-table info-table">
                        <tbody>
                            <tr>
                                <th>Dificultades movilidad:</th><td
                                    >{fm.dificultad_movilidad || "-"}</td
                                >
                                <th>Asistencia movilidad:</th><td
                                    >{fm.asistencia_movilidad || "-"}</td
                                >
                                <th>Asistencia especial:</th><td
                                    >{fm.asistencia_especial || "-"}</td
                                >
                            </tr>
                        </tbody>
                    </table>

                    <h4 class="subsection-title">Alimentación</h4>
                    <p class="data-text">
                        {#if fm.vegetariano}
                            <span class="badge">Vegetariano</span>
                        {/if}
                        {#if fm.vegano}
                            <span class="badge">Vegano</span>
                        {/if}
                        {#if fm.celiaco}
                            <span class="badge">Celíaco</span>
                        {/if}
                        {#if fm.intolerancia_lactosa}
                            <span class="badge">Intolerancia a la lactosa</span>
                        {/if}
                        {#if fm.diabetico_alim}
                            <span class="badge">Diabético</span>
                        {/if}
                        {#if !fm.vegetariano && !fm.vegano && !fm.celiaco && !fm.intolerancia_lactosa && !fm.diabetico_alim && !fm.otra_restriccion_alim}
                            Sin restricciones registradas.
                        {/if}
                    </p>
                    {#if fm.otra_restriccion_alim}
                        <p class="data-text">
                            <strong>Otras restricciones:</strong>
                            {fm.otra_restriccion_alim}
                        </p>
                    {/if}

                    <div class="pdf-divider"></div>

                    <h3 class="section-title">Contacto de Emergencia</h3>
                    <table class="pdf-table info-table">
                        <tbody>
                            <tr>
                                <th>Nombre:</th><td
                                    >{fm.contacto_nombre || "-"}</td
                                >
                                <th>Relación:</th><td
                                    >{fm.contacto_relacion || "-"}</td
                                >
                            </tr>
                            <tr>
                                <th>Teléfono 1:</th><td
                                    >{fm.contacto_telefono1 || "-"}</td
                                >
                                <th>Teléfono 2:</th><td
                                    >{fm.contacto_telefono2 || "-"}</td
                                >
                            </tr>
                        </tbody>
                    </table>

                    {#if fm.observaciones}
                        <h4 class="subsection-title mt-3">
                            Observaciones Adicionales
                        </h4>
                        <p class="data-text p-2 bg-light border">
                            {fm.observaciones}
                        </p>
                    {/if}
                </div>
            </div>
        {/if}
    </div>
</div>

<style>
    .pdf-viewer-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(15, 23, 42, 0.75);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        padding: 20px;
    }

    .pdf-viewer-card {
        background: white;
        width: 100%;
        max-width: 900px;
        border-radius: 12px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        overflow: hidden;
    }

    .pdf-status-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px;
        min-height: 300px;
    }

    .spinner {
        width: 40px;
        height: 40px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #2563eb;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 20px;
    }

    @keyframes spin {
        0% {
            transform: rotate(0deg);
        }
        100% {
            transform: rotate(360deg);
        }
    }

    .pdf-actions-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #f8fafc;
        padding: 15px 25px;
        border-bottom: 1px solid #e2e8f0;
    }

    .pdf-actions-header h3 {
        margin: 0;
        font-size: 16px;
        color: #1e293b;
    }
    .pdf-actions-header p {
        margin: 2px 0 0 0;
        font-size: 13px;
        color: #64748b;
    }

    .pdf-actions-header .buttons {
        display: flex;
        gap: 10px;
    }

    .btn-download-pdf {
        background: #2563eb;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .btn-download-pdf:hover {
        background: #1d4ed8;
    }

    .btn-close-pdf {
        background: #f1f5f9;
        color: #475569;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .btn-close-pdf:hover {
        background: #e2e8f0;
    }

    .pdf-preview-wrapper {
        background: #94a3b8;
        padding: 40px;
        display: flex;
        justify-content: center;
        overflow-y: auto;
        max-height: 80vh;
    }

    .pdf-page {
        width: 210mm;
        min-height: 297mm;
        padding: 20mm;
        background: white;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        font-family: "Helvetica", "Arial", sans-serif;
    }

    .pdf-header {
        margin-bottom: 20px;
    }
    .company-name {
        color: #1e293b;
        font-size: 24px;
        font-weight: 800;
        margin: 0;
    }
    .company-details {
        font-size: 13px;
        color: #64748b;
        margin: 3px 0;
    }

    .pdf-divider {
        height: 2px;
        background: #2563eb;
        margin: 15px 0;
    }

    .section-title {
        font-size: 16px;
        color: #2563eb;
        border-bottom: 1px solid #e2e8f0;
        padding-bottom: 5px;
        margin-top: 15px;
        margin-bottom: 10px;
    }
    .subsection-title {
        font-size: 14px;
        color: #475569;
        margin-top: 15px;
        margin-bottom: 5px;
        font-weight: 600;
    }

    .pdf-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 10px;
    }
    .pdf-table th {
        background: #f8fafc;
        padding: 8px;
        font-size: 12px;
        text-align: left;
        color: #475569;
        font-weight: 700;
        border: 1px solid #e2e8f0;
        width: 20%;
    }
    .pdf-table td {
        padding: 8px;
        font-size: 12px;
        color: #1e293b;
        border: 1px solid #e2e8f0;
    }

    .data-text {
        font-size: 12px;
        color: #1e293b;
        margin: 4px 0;
    }

    .badge {
        display: inline-block;
        padding: 3px 8px;
        background: #e2e8f0;
        color: #334155;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        margin-right: 5px;
        margin-bottom: 5px;
    }

    .bg-light {
        background-color: #f8fafc;
    }
    .border {
        border: 1px solid #e2e8f0;
    }
    .p-2 {
        padding: 8px;
    }
    .mt-3 {
        margin-top: 12px;
    }
</style>
