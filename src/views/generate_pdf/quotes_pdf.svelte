<script>
    import { onMount } from "svelte";
    import html2pdf from "html2pdf.js";
    import dayjs from "dayjs";
    import api from "../../lib/apis.js";
    import { secureStorage } from "../../lib/secureStore";
    import { formatCurrency, formatDate } from "../../lib/utils.js";

    export let id = null; // ID recibido desde el padre
    export let onClose = () => {}; // Función para cerrar el modal

    let loading = false;
    let cotizacion = null;
    let pdfRef;

    const userData = secureStorage.getItem("_us_");
    const schemaName = userData?.schema || "global";
    const currentCompanyId = userData.company;

    //Función para cargar datos de la empresa
    let companyData = null;
    async function loadCompanyData() {
        if (!currentCompanyId) return;
        try {
            const res = await api.getData(
                "company",
                "",
                "",
                currentCompanyId,
                "global",
            );
            if (res.status === "success" && res.data) {
                // El API puede devolver un array o un objeto único según la implementación
                companyData = Array.isArray(res.data) ? res.data[0] : res.data;
            }
        } catch (error) {
            console.error("Error al cargar datos de la empresa:", error);
        }
    }

    onMount(loadCompanyData);

    const API_BASE =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api/v3.5";
    const ROOT_URL = import.meta.env.DEV
        ? ""
        : API_BASE.split("/api/")[0] + "/";

    $: logo = companyData?.identificador
        ? `${ROOT_URL}/upload/company/image_company/login_logo_${companyData.identificador}.png`
        : "";

    function handleLogoError(e) {
        e.target.src = "";
    }

    // Función para cargar datos detallados de la cotización
    async function loadQuoteData() {
        if (!id) return;
        loading = true;
        try {
            const res = await api.getData("quotes", "", "", id, schemaName);
            if (res.status === "success" && res.data) {
                let data = res.data;

                // Resolver nombres de programa y establecimiento
                const [progRes, colRes] = await Promise.all([
                    api.getData(
                        "programs",
                        "",
                        "",
                        data.programa_id,
                        schemaName,
                    ),
                    api.getData(
                        "colegio",
                        "",
                        "",
                        data.establecimiento_id,
                        schemaName,
                    ),
                ]);
                let type_sale = "";
                cotizacion = {
                    ...data,
                    programa_nombre:
                        progRes.status === "success"
                            ? progRes.data.name
                            : "Programa N/A",
                    establecimiento_nombre:
                        colRes.status === "success"
                            ? colRes.data.nombre
                            : "Colegio N/A",
                    total: Number(data.subtotal || 0) - Number(data.desc || 0),
                    type_sale:
                        data.type_sale === "GE"
                            ? "Gira Estudio"
                            : "Viage Grupal",
                };
            }
        } catch (error) {
            console.error("Error al cargar datos para PDF:", error);
        } finally {
            loading = false;
        }
    }

    onMount(loadQuoteData);

    const generarPDF = () => {
        if (!pdfRef) return;
        html2pdf()
            .set({
                margin: [10, 10, 10, 10],
                filename: `Cotizacion_${cotizacion.identificador}.pdf`,
                image: { type: "jpeg", quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    letterRendering: true,
                },
                jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
            })
            .from(pdfRef)
            .save();
    };
</script>

<div class="pdf-viewer-overlay">
    <div class="pdf-viewer-card">
        {#if loading}
            <div class="pdf-status-container">
                <div class="spinner"></div>
                <p>Cargando datos de la cotización...</p>
            </div>
        {:else if cotizacion}
            <div class="pdf-actions-header">
                <div class="info">
                    <h3>Vista Previa: {cotizacion.identificador}</h3>
                    <p>{cotizacion.contacto} - {cotizacion.programa_nombre}</p>
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
                    <!-- HEADER -->
                    <div class="pdf-header">
                        <div class="header-left">
                            <div class="logo-container">
                                <img
                                    src={logo}
                                    alt="Logo"
                                    class="company-logo"
                                    on:error={handleLogoError}
                                />
                            </div>
                            <div class="brand-info">
                                <h1 class="company-name">
                                    {companyData?.razonsocial || ""}
                                </h1>
                                <p class="company-details">
                                    RUT: {companyData?.rut || ""}
                                </p>
                                <p class="company-details">
                                    {companyData?.direccion || ""}
                                </p>
                                <p class="company-details">
                                    {companyData?.ciudad || ""}
                                </p>
                                <p class="company-details">
                                    Email: {companyData?.email || ""}
                                </p>
                                <p class="company-details">
                                    Fono: {companyData?.fonocontacto1 || ""}
                                </p>
                            </div>
                        </div>
                        <div class="quote-meta">
                            <div class="quote-badge">
                                Cotización - {cotizacion.type_sale}
                            </div>
                            <h2 class="quote-number">
                                #{cotizacion.identificador}
                            </h2>
                            <p class="quote-date">
                                <strong>Fecha:</strong>
                                {formatDate(cotizacion.fecha)}
                            </p>
                        </div>
                    </div>

                    <div class="pdf-divider"></div>

                    <!-- INFO CLIENTE Y PROGRAMA -->
                    <div class="pdf-info-grid">
                        <div class="info-section">
                            <h3 class="section-title">
                                Información del Cliente
                            </h3>
                            <p>
                                <strong>Contacto:</strong>
                                {cotizacion.contacto}
                            </p>
                            <p>
                                <strong>Email:</strong>
                                {cotizacion.contactoemail}
                            </p>
                            <p>
                                <strong>Fono:</strong>
                                {cotizacion.contactofono}
                            </p>
                            <p>
                                <strong>Institución:</strong>
                                {cotizacion.establecimiento_nombre}
                            </p>
                            <p>
                                <strong>Curso:</strong>
                                {cotizacion.curso + "/" + cotizacion.idcurso}
                            </p>
                        </div>
                        <div class="info-section">
                            <h3 class="section-title">Detalles del Viaje</h3>
                            <p>
                                <strong>Programa:</strong>
                                {cotizacion.programa_nombre}
                            </p>
                            <p>
                                <strong>N° Pasajeros:</strong>
                                {cotizacion.pasajeros} PAX
                            </p>
                            <p>
                                <strong>Vendedor:</strong>
                                {cotizacion.author}
                            </p>
                        </div>
                    </div>

                    <!-- TABLA DE VALORES -->
                    <table class="pdf-table">
                        <thead>
                            <tr>
                                <th>Descripción del Servicio</th>
                                <th class="text-center">Cant.</th>
                                <th class="text-center">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>
                                    <strong>{cotizacion.programa_nombre}</strong
                                    >
                                    <br />
                                    <small
                                        >Programa completo según itinerario
                                        adjunto</small
                                    >
                                </td>
                                <td class="text-center"
                                    >{cotizacion.pasajeros}</td
                                >
                                <td class="text-right"
                                    >{formatCurrency(cotizacion.subtotal)}</td
                                >
                            </tr>
                        </tbody>
                    </table>

                    <!-- TOTALES -->
                    <div class="pdf-footer-section">
                        <div class="notes-area">
                            <h3 class="section-title">Notas y Condiciones</h3>
                            <ul>
                                <li>
                                    Cotización válida por 15 días desde la fecha
                                    de emisión.
                                </li>
                                <li>
                                    Sujeto a disponibilidad de cupos al momento
                                    de la reserva.
                                </li>
                                <li>
                                    Valores expresados en Pesos Chilenos (CLP).
                                </li>
                            </ul>
                        </div>
                        <div class="totals-area">
                            <div class="total-row">
                                <span>Subtotal:</span>
                                <span
                                    >{formatCurrency(cotizacion.subtotal)}</span
                                >
                            </div>
                            {#if cotizacion.desc > 0}
                                <div class="total-row discount">
                                    <span>Descuento:</span>
                                    <span
                                        >- {formatCurrency(
                                            cotizacion.desc,
                                        )}</span
                                    >
                                </div>
                            {/if}
                            <div class="total-row grand-total">
                                <span>TOTAL:</span>
                                <span>{formatCurrency(cotizacion.total)}</span>
                            </div>
                        </div>
                    </div>

                    <div class="pdf-bottom-bar">
                        <p>
                            {companyData?.website || ""} | {companyData?.email ||
                                ""} |
                            {companyData?.fonocontacto1 || ""}
                        </p>
                        <p class="thanks">¡Gracias por preferirnos!</p>
                    </div>
                </div>
            </div>
        {:else}
            <div class="pdf-status-container error">
                <i class="fa fa-exclamation-triangle"></i>
                <p>No se pudo cargar la cotización.</p>
                <button class="btn-close-pdf" on:click={onClose}>Cerrar</button>
            </div>
        {/if}
    </div>
</div>

<style>
    /* Overlay and Modal */
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
        max-width: 1000px;
        border-radius: 12px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        overflow: hidden;
    }

    /* Status Containers */
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

    /* Header Actions */
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
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: #2563eb;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
        transition: background 0.2s;
    }

    .btn-download-pdf:hover {
        background: #1d4ed8;
    }

    .btn-close-pdf {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: #f1f5f9;
        color: #475569;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
    }

    .btn-close-pdf:hover {
        background: #e2e8f0;
    }

    /* Preview Wrapper */
    .pdf-preview-wrapper {
        background: #94a3b8;
        padding: 40px;
        display: flex;
        justify-content: center;
        overflow-y: auto;
        max-height: 80vh;
    }

    /* PDF Page Styling (A4 Simulation) */
    .pdf-page {
        width: 210mm;
        min-height: 297mm;
        padding: 20mm;
        background: white;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        font-family: "Helvetica", "Arial", sans-serif;
        color: #1f2937;
    }

    .pdf-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 20px;
    }
    .header-left {
        display: flex;
        align-items: center;
        gap: 20px;
    }
    .logo-container {
        width: 80px;
        height: 80px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        overflow: hidden;
    }
    .company-logo {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
    }
    .company-name {
        color: #1e293b;
        font-size: 20px;
        font-weight: 800;
        margin: 0 0 5px 0;
        line-height: 1.2;
    }
    .company-details {
        font-size: 10px;
        color: #64748b;
        margin: 0;
        line-height: 1.4;
    }
    .quote-meta {
        text-align: right;
    }
    .quote-badge {
        background: #eff6ff;
        color: #1e40af;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 700;
    }
    .quote-number {
        font-size: 20px;
        margin: 5px 0;
    }
    .quote-date {
        font-size: 11px;
        color: #6b7280;
        margin: 0;
    }

    .pdf-divider {
        height: 2px;
        background: #2563eb;
        margin: 20px 0;
    }

    .pdf-info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        margin-bottom: 30px;
    }
    .section-title {
        font-size: 11px;
        text-transform: uppercase;
        color: #9ca3af;
        border-bottom: 1px solid #e5e7eb;
        margin-bottom: 10px;
        padding-bottom: 5px;
        font-weight: 700;
    }
    .info-section p {
        font-size: 12px;
        margin: 3px 0;
    }

    .pdf-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 30px;
    }
    .pdf-table th {
        background: #f9fafb;
        padding: 10px;
        font-size: 10px;
        text-align: left;
        border-bottom: 1px solid #e5e7eb;
        color: #4b5563;
    }
    .pdf-table td {
        padding: 10px;
        font-size: 12px;
        border-bottom: 1px solid #f3f4f6;
        vertical-align: top;
    }

    .text-center {
        text-align: center;
    }
    .text-right {
        text-align: right;
    }

    .pdf-footer-section {
        display: grid;
        grid-template-columns: 1.2fr 0.8fr;
        gap: 20px;
    }
    .notes-area li {
        font-size: 10px;
        color: #6b7280;
        margin-bottom: 4px;
    }
    .totals-area {
        background: #f9fafb;
        padding: 15px;
        border-radius: 8px;
    }
    .total-row {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        margin-bottom: 5px;
        color: #4b5563;
    }
    .total-row.discount {
        color: #dc2626;
    }
    .grand-total {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid #e5e7eb;
        font-size: 16px;
        font-weight: 800;
        color: #111827;
    }

    .pdf-bottom-bar {
        margin-top: 50px;
        text-align: center;
        font-size: 9px;
        color: #9ca3af;
        border-top: 1px solid #f3f4f6;
        padding-top: 15px;
    }
    .thanks {
        font-weight: 700;
        color: #2563eb;
        margin-top: 10px;
        font-size: 11px;
    }
</style>
