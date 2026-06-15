<script>
    import { onMount } from "svelte";
    import html2pdf from "html2pdf.js";
    import api from "../../lib/apis.js";
    import { secureStorage } from "../../lib/secureStore";
    import { formatDate } from "../../lib/utils.js";

    export let id = null; // sale_id
    export let onClose = () => {};

    let loading = false;
    let saleData = null;
    let pasajeros = [];
    let pdfRef;

    const userData = secureStorage.getItem("_us_");
    const schemaName = userData?.schema || "global";
    const currentCompanyId = userData?.company;

    async function loadData() {
        if (!id) return;
        loading = true;
        try {
            // Cargar datos de la venta para el encabezado
            const saleRes = await api.getData("sale", "", "", id, schemaName);
            if (saleRes.status === "success") {
                saleData = saleRes.data;
            }

            // Cargar pasajeros desde la tabla 'cursos' usando sale_id
            const paxRes = await api.getData("cursos", "", "sale_id=" + id, "", schemaName);
            if (paxRes.status === "success") {
                pasajeros = Array.isArray(paxRes.data) ? paxRes.data : [];
            }
        } catch (error) {
            console.error("Error al cargar datos de pasajeros:", error);
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
                filename: `Lista_Pasajeros_${saleData?.identificador || id}.pdf`,
                image: { type: "jpeg", quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
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
                <p>Cargando listado de pasajeros...</p>
            </div>
        {:else if pasajeros.length > 0}
            <div class="pdf-actions-header">
                <div class="info">
                    <h3>Listado de Pasajeros: {saleData?.identificador || id}</h3>
                    <p>{pasajeros.length} Pasajeros registrados</p>
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
                                <h1 class="company-name">Listado de Pasajeros</h1>
                                <p class="company-details">Venta: {saleData?.identificador || id}</p>
                                <p class="company-details">Institución: {saleData?.establecimiento_nombre || 'N/A'}</p>
                                <p class="company-details">Curso: {saleData?.curso}{saleData?.idcurso}</p>
                            </div>
                        </div>
                    </div>

                    <div class="pdf-divider"></div>

                    <table class="pdf-table">
                        <thead>
                            <tr>
                                <th style="width: 50px;">#</th>
                                <th>Nombre Completo</th>
                                <th>RUT</th>
                                <th>Fecha Nacimiento</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each pasajeros as pax, index}
                                <tr>
                                    <td>{index + 1}</td>
                                    <td>{pax.nombre}</td>
                                    <td>{pax.rut}</td>
                                    <td>{formatDate(pax.fecha_nacimiento)}</td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            </div>
        {:else}
            <div class="pdf-status-container">
                <i class="fa fa-info-circle fa-3x text-info mb-3"></i>
                <p>No se encontraron pasajeros registrados para esta venta.</p>
                <button class="btn-close-pdf" on:click={onClose}>Cerrar</button>
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
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    .pdf-actions-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #f8fafc;
        padding: 15px 25px;
        border-bottom: 1px solid #e2e8f0;
    }

    .pdf-actions-header h3 { margin: 0; font-size: 16px; color: #1e293b; }
    .pdf-actions-header p { margin: 2px 0 0 0; font-size: 13px; color: #64748b; }

    .pdf-actions-header .buttons { display: flex; gap: 10px; }

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

    .btn-download-pdf:hover { background: #1d4ed8; }

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

    .btn-close-pdf:hover { background: #e2e8f0; }

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

    .pdf-header { margin-bottom: 20px; }
    .company-name { color: #1e293b; font-size: 24px; font-weight: 800; margin: 0; }
    .company-details { font-size: 12px; color: #64748b; margin: 2px 0; }

    .pdf-divider { height: 2px; background: #2563eb; margin: 20px 0; }

    .pdf-table { width: 100%; border-collapse: collapse; }
    .pdf-table th {
        background: #f8fafc;
        padding: 12px 10px;
        font-size: 11px;
        text-align: left;
        border-bottom: 2px solid #e2e8f0;
        color: #475569;
        text-transform: uppercase;
        font-weight: 700;
    }
    .pdf-table td {
        padding: 12px 10px;
        font-size: 12px;
        border-bottom: 1px solid #f1f5f9;
        color: #1e293b;
    }
</style>
