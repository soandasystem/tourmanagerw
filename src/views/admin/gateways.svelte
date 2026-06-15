<script>
    import { onMount, onDestroy } from "svelte";
    import { DataTable } from "simple-datatables";
    import "simple-datatables/dist/style.css";
    import { secureStorage } from "../../lib/secureStore";
    import { tenantStore } from "../../stores/tenant";
    import api from "../../lib/apis.js";
    import dayjs from "dayjs";
    import Swal from "sweetalert2";

    let viewMode = "list";
    let isEditing = false;
    let showDeleteModal = false;
    let itemIdToDelete = null;

    $: idcl = $tenantStore;
    const userData = secureStorage.getItem("_us_");
    const schemaName = userData.schema;
    const author = userData.username;
    const CompanyId = String(userData.company);
    let currentCompanyId = String(userData.company);

    let gatewaysc = [];
    let showModal = false;
    let selectedGateway = null;

    const getInitialFormData = () => ({
        apikey: "",
        secretkey: "",
        commercialcode: "",
        keysecret: "",
        usersid: "",
        publickey: "",
        accesstoken: "",
    });

    let formData = getInitialFormData();

    const fetchGateways = async () => {
        try {
            const response = await api.getData(
                "gatewaysc",
                "",
                "",
                "",
                "global",
            );
            if (response.status === "success") {
                let items = Array.isArray(response.data) ? response.data : [];
                gatewaysc = await Promise.all(
                    items.map(async (item) => {
                        const consulta = `company_id=${CompanyId}&gateway_id=${item.id}`;
                        const resExist = await api.getData(
                            "gateways",
                            "",
                            consulta,
                            "",
                            schemaName,
                        );
                        return {
                            ...item,
                            existe:
                                resExist.status === "success" &&
                                resExist.data &&
                                resExist.data.length > 0
                                    ? "S"
                                    : "N",
                        };
                    }),
                );
            }
        } catch (error) {
            console.error("Error al cargar gateways:", error);
        }
    };

    function openModal(gateway) {
        selectedGateway = gateway;
        formData = getInitialFormData();
        showModal = true;
    }

    function closeModal() {
        showModal = false;
        selectedGateway = null;
    }

    async function handleIntegrate() {
        if (!selectedGateway) return;

        const payload = {
            company_id: CompanyId,
            gateway_id: selectedGateway.id,
            additional_config: {
                flow_apikey: formData.apikey,
                flow_secretkey: formData.secretkey,
                trbk_commercialcode: formData.commercialcode,
                trbk_keysecret: formData.keysecret,
                mp_publickey: formData.publickey,
                mp_accesstoken: formData.accesstoken,
                mp_usersid: formData.usersid,
            },
            active: 1,
        };

        const response = await api.setData(
            "gateways",
            payload,
            "",
            "",
            schemaName,
        );
        if (response.status === "success") {
            Swal.fire("Éxito", "Pasarela integrada correctamente", "success");
            closeModal();
            fetchGateways();
        } else {
            Swal.fire(
                "Error",
                "No se pudo integrar la pasarela: " + response.message,
                "error",
            );
        }
    }

    async function handleRemove(id) {
        const result = await Swal.fire({
            title: "¿Estás seguro?",
            text: "Esta acción quitará la integración de la pasarela.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#3085d6",
            cancelButtonColor: "#d33",
            confirmButtonText: "Sí, quitar",
            cancelButtonText: "Cancelar",
        });

        if (result.isConfirmed) {
            // Buscamos el registro en 'gateways' para obtener su ID específico en esa tabla
            // En este caso, la lógica PHP parece sugerir que pasamos el gateway_id del catálogo general
            // o el ID de la tabla de integraciones. Ajustamos según el backend.
            const response = await api.deleteData(
                "gateways",
                "",
                `company_id=${CompanyId}&gateway_id=${id}`,
                "",
                schemaName,
            );
            if (response.status === "success") {
                Swal.fire(
                    "Eliminado",
                    "La integración ha sido quitada.",
                    "success",
                );
                fetchGateways();
            } else {
                Swal.fire(
                    "Error",
                    "No se pudo quitar la integración: " + response.message,
                    "error",
                );
            }
        }
    }

    onMount(() => {
        fetchGateways();
    });
</script>

<div class="page-wrapper">
    <div class="container-fluid p-0">
        <div class="header-section mb-5">
            <h2 class="display-6 fw-bold text-dark mb-2">
                Integraciones de Pasarelas de Pago
            </h2>
            <p class="text-muted lead">
                Conecta y gestiona tus métodos de pago de forma segura.
            </p>
            <div class="header-line"></div>
        </div>

        <div class="row g-4">
            {#each gatewaysc as item}
                <div class="col-12">
                    <div
                        class="payment-card {item.existe === 'S'
                            ? 'integrated'
                            : ''}"
                        style={item.existe === "S"
                            ? "background-color: #f2f2f2;"
                            : ""}
                    >
                        <div
                            class="card-content d-flex align-items-center flex-wrap flex-md-nowrap gap-4 p-4"
                        >
                            <div class="logo-container">
                                {#if item.gateway_image}
                                    <img
                                        src={`/assets/${item.gateway_image}`}
                                        class="payment-logo"
                                        alt={item.name}
                                    />
                                {:else}
                                    <div class="logo-placeholder">
                                        <i class="fa fa-credit-card fa-2x"></i>
                                    </div>
                                {/if}
                            </div>

                            <div class="info-container flex-grow-1">
                                <div
                                    class="d-flex align-items-center gap-2 mb-2"
                                >
                                    <h5
                                        class="m-0 fw-bold"
                                        style="font-size: 15px;"
                                    >
                                        {#if item.existe === "S"}
                                            Esta integrado con: {item.gateway_type}
                                        {:else}
                                            {item.gateway_type}
                                        {/if}
                                    </h5>
                                    {#if item.existe === "S"}
                                        <i
                                            class="fa fa-check-circle integrated-icon"
                                        ></i>
                                    {/if}
                                </div>
                                <p class="mb-0 text-muted">
                                    {item.gateway_description ||
                                        item.description ||
                                        "Sin descripción disponible."}
                                </p>
                            </div>

                            <div class="actions-container">
                                {#if item.existe === "S"}
                                    <button
                                        class="btn btn-primary btn-sm px-4"
                                        style="border-radius: 20px;"
                                        on:click={() => handleRemove(item.id)}
                                    >
                                        Quitar
                                    </button>
                                {:else}
                                    <button
                                        class="btn btn-success btn-sm px-4"
                                        style="border-radius: 20px;"
                                        on:click={() => openModal(item)}
                                    >
                                        Integrar
                                    </button>
                                {/if}
                            </div>
                        </div>
                    </div>
                </div>
            {/each}
        </div>

        {#if gatewaysc.length === 0}
            <div class="text-center py-5">
                <div class="spinner-border text-primary" role="status"></div>
                <p class="mt-3 text-muted">Cargando pasarelas disponibles...</p>
            </div>
        {/if}
    </div>
</div>

<!-- Modal de Integración -->
{#if showModal && selectedGateway}
    <div class="modal-backdrop fade show"></div>
    <div class="modal show d-block" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content border-0 shadow-lg">
                <div class="modal-header bg-primary text-white p-4">
                    <h5 class="modal-title fw-bold">
                        Configurar integración: {selectedGateway.gateway_type}
                    </h5>
                    <button
                        type="button"
                        class="btn-close btn-close-white"
                        on:click={closeModal}
                        aria-label="Cerrar"
                    ></button>
                </div>
                <div class="modal-body p-4">
                    <form on:submit|preventDefault={handleIntegrate}>
                        {#if selectedGateway.gateway_type === "Flow"}
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <label
                                        class="form-label fw-semibold"
                                        for="apikey">Api Key</label
                                    >
                                    <input
                                        type="text"
                                        class="form-control custom-input"
                                        id="apikey"
                                        bind:value={formData.apikey}
                                        required
                                        placeholder="Ingresa tu Api Key"
                                    />
                                </div>
                                <div class="col-md-6">
                                    <label
                                        class="form-label fw-semibold"
                                        for="secretkey">Secret Key</label
                                    >
                                    <input
                                        type="text"
                                        class="form-control custom-input"
                                        id="secretkey"
                                        bind:value={formData.secretkey}
                                        required
                                        placeholder="Ingresa tu Secret Key"
                                    />
                                </div>
                            </div>
                        {:else if selectedGateway.gateway_type === "TransBank"}
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <label
                                        class="form-label fw-semibold"
                                        for="comercialcode"
                                        >Codigo Comercial</label
                                    >
                                    <input
                                        type="text"
                                        class="form-control custom-input"
                                        id="comercialcode"
                                        bind:value={formData.commercialcode}
                                        required
                                        placeholder="Codigo Comercial"
                                    />
                                </div>
                                <div class="col-md-6">
                                    <label
                                        class="form-label fw-semibold"
                                        for="keysecret">Secret Key</label
                                    >
                                    <input
                                        type="text"
                                        class="form-control custom-input"
                                        id="keysecret"
                                        bind:value={formData.keysecret}
                                        required
                                        placeholder="Secret Key"
                                    />
                                </div>
                            </div>
                        {:else if selectedGateway.gateway_type === "MercadoPago"}
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <label
                                        class="form-label fw-semibold"
                                        for="usersid">Id usuario</label
                                    >
                                    <input
                                        type="text"
                                        class="form-control custom-input"
                                        id="usersid"
                                        bind:value={formData.usersid}
                                        required
                                        placeholder="Id usuario"
                                    />
                                </div>
                                <div class="col-md-6">
                                    <label
                                        class="form-label fw-semibold"
                                        for="publickey">Public Key</label
                                    >
                                    <input
                                        type="text"
                                        class="form-control custom-input"
                                        id="publickey"
                                        bind:value={formData.publickey}
                                        required
                                        placeholder="Public Key"
                                    />
                                </div>
                                <div class="col-md-6 mt-3">
                                    <label
                                        class="form-label fw-semibold"
                                        for="accesstoken">Access Token</label
                                    >
                                    <input
                                        type="text"
                                        class="form-control custom-input"
                                        id="accesstoken"
                                        bind:value={formData.accesstoken}
                                        required
                                        placeholder="Access Token"
                                    />
                                </div>
                            </div>
                        {:else}
                            <div class="alert alert-info">
                                Esta pasarela no requiere configuraciones
                                adicionales manuales o usa una configuración
                                genérica.
                            </div>
                        {/if}

                        <div class="form-actions border-top pt-3 mt-4">
                            <button type="submit" class="btn btn-save">
                                <i class="fa fa-save"></i> Guardar
                            </button>
                            <button
                                type="button"
                                class="btn btn-cancel"
                                on:click={closeModal}
                            >
                                <i class="fa fa-times"></i> Cancelar
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    .page-wrapper {
        padding: 20px;
        background-color: #f0f2f5;
        min-height: calc(100vh - 70px);
        font-size: 13px;
    }

    .header-section {
        border-bottom: 2px solid #e0e6ed;
        padding-bottom: 20px;
    }

    .header-line {
        width: 40px;
        height: 3px;
        background: #4e73df;
        border-radius: 2px;
    }

    /* Card Styles */
    .payment-card {
        background: white;
        border-radius: 16px;
        border: 1px solid #e0e6ed;
        box-shadow:
            0 4px 6px -1px rgba(0, 0, 0, 0.05),
            0 2px 4px -1px rgba(0, 0, 0, 0.03);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        overflow: hidden;
    }

    .payment-card:hover {
        transform: translateY(-2px);
        box-shadow:
            0 10px 15px -3px rgba(0, 0, 0, 0.1),
            0 4px 6px -2px rgba(0, 0, 0, 0.05);
        border-color: #4e73df;
    }

    .payment-card.integrated {
        background-color: #f8fafc;
        border-left: 4px solid #10b981;
    }

    .logo-container {
        width: 100px;
        height: 60px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f8fafc;
        border-radius: 10px;
        padding: 8px;
    }

    .payment-logo {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
    }

    .logo-placeholder {
        color: #cbd5e0;
    }

    .integrated-icon {
        color: #10b981;
        font-size: 1.25rem;
    }

    /* Form Styles */
    .custom-input {
        padding: 8px 12px;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        font-size: 13px;
        transition: all 0.2s;
    }

    .custom-input:focus {
        border-color: #4e73df;
        box-shadow: 0 0 0 3px rgba(78, 115, 223, 0.1);
    }

    /* Modal styles */
    :global(.modal-backdrop) {
        background-color: rgba(15, 23, 42, 0.6) !important;
        backdrop-filter: blur(4px);
    }

    .modal-content {
        border-radius: 20px;
        overflow: hidden;
    }

    /* Actions */
    .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 5px;
    }
    .btn-save {
        background: #007bff;
        color: white;
        padding: 6px 16px;
        border-radius: 4px;
        font-weight: 600;
        font-size: 0.85rem;
        border: 1px solid #0069d9;
        transition: all 0.2s;
        order: 1;
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .btn-save:hover {
        background: #0069d9;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .btn-cancel {
        background: #212529;
        color: white;
        padding: 6px 16px;
        border-radius: 4px;
        font-weight: 600;
        font-size: 0.85rem;
        border: 1px solid #1a1e21;
        order: 2;
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .btn-cancel:hover {
        background: #1a1e21;
        color: white;
    }

    @keyframes zoomIn {
        from {
            opacity: 0;
            transform: scale3d(0.3, 0.3, 0.3);
        }
        50% {
            opacity: 1;
        }
    }
</style>
