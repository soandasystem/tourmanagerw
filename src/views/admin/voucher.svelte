<script>
    import { onMount, onDestroy } from "svelte";
    import { DataTable } from "simple-datatables";
    import "simple-datatables/dist/style.css";
    import api from "../../lib/apis";
    import { secureStorage } from "../../lib/secureStore";
    import { tenantStore } from "../../stores/tenant";
    import Swal from "sweetalert2";
    import { hasPermissionPrograms } from "../../lib/utils";

    // Props
    export let title = "Gestión de Vouchers";

    $: idcl = $tenantStore;
    const userData = secureStorage.getItem("_us_");
    const schemaName = userData.schema;
    const author = userData.username;
    const CompanyId = String(userData.company);
    const rol = userData.rol_id;

    // UI state
    let viewMode = "list";
    let ventas = [];
    let selectedVenta = "";
    let voucher = "";
    let vouchers = [];
    let loading = false;

    // Reactive permission checks
    $: isInsert = hasPermissionPrograms(rol, "voucher", "INSERT");
    $: isDelete = hasPermissionPrograms(rol, "voucher", "DELETE");

    // Build DataTable-compatible data from vouchers array
    $: dtData = vouchers.map((v) => {
        let acciones = `<div class="action-buttons-mini">`;
        if (isDelete && v.used === 0) {
            acciones += `<button class="btn-mini-custom delete" onclick="document.dispatchEvent(new CustomEvent('delete-voucher', {detail: ${v.id}}))" title="Eliminar">
                <i class="fa fa-trash"></i>
            </button>`;
        }
        acciones += `</div>`;

        const estado =
            v.used === 0
                ? `<span class="badge-status inactive">No Cobrado</span>`
                : `<span class="badge-status active">Cobrado</span>`;

        return [v.sale_id, v.voucher, estado, acciones];
    });

    // DataTable instance & directive (same pattern as users.svelte)
    let dataTableInstance = null;

    function initDataTable(node, dataConfig) {
        if (dataTableInstance) dataTableInstance.destroy();
        dataTableInstance = new DataTable(node, {
            searchable: true,
            sortable: true,
            perPage: 10,
            labels: {
                placeholder: "Buscar vouchers...",
                perPage: "por página",
                noRows: "No se encontraron vouchers",
                info: "Mostrando {start} a {end} de {rows} vouchers",
                noResults: "No se encontraron vouchers",
            },
            data: {
                headings: ["Venta", "Nro Voucher", "Estado", "Acciones"],
                data: dataConfig,
            },
        });
        if (dataTableInstance.wrapperDOM) {
            dataTableInstance.wrapperDOM.style.fontSize = "13px";
        }
        return {
            destroy() {
                if (dataTableInstance) {
                    dataTableInstance.destroy();
                    dataTableInstance = null;
                }
            },
        };
    }

    // ──── API calls ────
    async function loadVentas() {
        try {
            const resp = await api.getData(
                "sale/informe",
                "",
                "activo=1&company_id=" + CompanyId,
                "",
                schemaName,
            );
            if (resp.status === "success") {
                ventas = Array.isArray(resp.data) ? resp.data : [];
            }
        } catch (e) {
            console.error("Error loading sales", e);
        }
    }

    async function loadVouchers() {
        loading = true;
        try {
            let params = selectedVenta ? `sale_id=${selectedVenta}` : "";
            if (params != 0) {
                const resp = await api.getData(
                    "voucher",
                    "",
                    params,
                    "",
                    schemaName,
                );
                if (resp.status === "success") {
                    vouchers = (resp.data || []).map((v) => ({
                        id: v.id,
                        venta: v.sale_id,
                        voucher: v.voucher,
                        used: v.used,
                    }));
                } else {
                    vouchers = [];
                }
            } else {
                vouchers = [];
            }
        } catch (e) {
            console.error(e);
            Swal.fire("Error", "Excepción al cargar vouchers.", "error");
        } finally {
            loading = false;
        }
    }

    async function addVoucher() {
        if (!selectedVenta || !voucher) {
            Swal.fire(
                "Atención",
                "Debe seleccionar una venta y un número de voucher.",
                "warning",
            );
            return;
        }
        loading = true;
        try {
            const body = JSON.stringify({
                sale_id: Number(selectedVenta),
                voucher: voucher,
                used: 0,
                company_id: Number(CompanyId),
            });
            const resp = await api.setData("voucher", body, "", "", schemaName);
            if (resp.status === "success") {
                Swal.fire(
                    "Guardado",
                    "Voucher ingresado correctamente.",
                    "success",
                );
                voucher = "";
                await loadVouchers();
            } else {
                Swal.fire(
                    "Error",
                    resp.message || "Error al ingresar voucher.",
                    "error",
                );
            }
        } catch (e) {
            console.error(e);
            Swal.fire("Error", "Excepción al guardar voucher.", "error");
        } finally {
            loading = false;
        }
    }

    async function handleDeleteVoucher(event) {
        const id = event.detail;
        const result = await Swal.fire({
            title: "¿Está seguro?",
            text: "Esta acción eliminará el voucher.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#e53e3e",
            cancelButtonColor: "#6c757d",
            confirmButtonText: "Sí, eliminar",
            cancelButtonText: "Cancelar",
        });
        if (!result.isConfirmed) return;

        loading = true;
        try {
            const resp = await api.deleteData(
                "voucher",
                "",
                "",
                id,
                schemaName,
            );
            if (resp.status === "success") {
                Swal.fire(
                    "Eliminado",
                    "Voucher eliminado correctamente.",
                    "success",
                );
                await loadVouchers();
            } else {
                Swal.fire(
                    "Error",
                    resp.message || "Error al eliminar voucher.",
                    "error",
                );
            }
        } catch (e) {
            console.error(e);
            Swal.fire("Error", "Excepción al eliminar voucher.", "error");
        } finally {
            loading = false;
        }
    }

    function openForm() {
        viewMode = "form";
    }

    function returnToList() {
        viewMode = "list";
        voucher = "";
        selectedVenta = "";
    }

    onMount(async () => {
        await loadVentas();
        await loadVouchers();
        document.addEventListener("delete-voucher", handleDeleteVoucher);
    });

    onDestroy(() => {
        document.removeEventListener("delete-voucher", handleDeleteVoucher);
    });
</script>

<div class="page-wrapper">
    <div class="card main-card shadow-sm border-0 mb-4">
        <div class="card-header-flex p-4">
            <div class="title-group">
                <div class="title-with-icon">
                    <i class="fa fa-ticket icon-main text-primary"></i>
                    <h2 class="m-0">{title}</h2>
                </div>
                <p class="subtitle mt-1 mb-0">
                    Administra los vouchers asociados a las ventas.
                </p>
            </div>
        </div>

        <!-- Formulario inline antes de la grilla -->
        {#if isInsert}
            <div class="card-body p-4 pt-0">
                <form on:submit|preventDefault={addVoucher}>
                    <div class="section-title mb-3">Ingresar Voucher</div>
                    <div class="row g-2 align-items-end">
                        <div class="col-md-5">
                            <div class="form-group-custom">
                                <label for="venta">Venta</label>
                                <select
                                    id="venta"
                                    class="form-select-custom"
                                    bind:value={selectedVenta}
                                    on:change={loadVouchers}
                                >
                                    <option value="">Seleccionar</option>
                                    {#each ventas as venta}
                                        <option value={venta.id}>
                                            {venta.curso}-{venta.idcurso} / {venta.establecimiento_nombre}
                                        </option>
                                    {/each}
                                </select>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="form-group-custom">
                                <label for="voucher">Nro Voucher</label>
                                <input
                                    type="text"
                                    id="voucher"
                                    class="form-control-custom"
                                    placeholder="Voucher"
                                    maxlength="20"
                                    bind:value={voucher}
                                />
                            </div>
                        </div>
                        <div class="col-md-3">
                            <button
                                type="submit"
                                class="btn-save w-100"
                                disabled={loading}
                            >
                                {#if loading}
                                    <span
                                        class="spinner-border spinner-border-sm"
                                        role="status"
                                        aria-hidden="true"
                                    ></span>
                                    Guardando...
                                {:else}
                                    <i class="fa fa-plus"></i> Agregar
                                {/if}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        {/if}

        <!-- Grilla de vouchers -->
        <div class="table-container p-3 pt-0">
            {#key dtData}
                <table
                    use:initDataTable={dtData}
                    class="table table-hover w-100"
                ></table>
            {/key}
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
    .subtitle {
        color: #718096;
        font-size: 14px;
    }

    .section-title {
        font-size: 0.8rem;
        font-weight: 700;
        text-transform: uppercase;
        color: #4e73df;
        letter-spacing: 0.5px;
        border-left: 3px solid #4e73df;
        padding-left: 10px;
        display: flex;
        align-items: center;
        margin-bottom: 15px !important;
    }
    .form-group-custom {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .form-group-custom label {
        font-weight: 600;
        font-size: 0.8rem;
        color: #4a5568;
    }
    .form-control-custom,
    .form-select-custom {
        border: 1px solid #d1d3e2;
        border-radius: 4px;
        padding: 6px 12px;
        font-size: 0.85rem;
        transition:
            border-color 0.2s,
            box-shadow 0.2s;
        width: 100%;
        height: 34px;
        background-color: #fff;
    }
    .form-control-custom:focus,
    .form-select-custom:focus {
        outline: none;
        border-color: #4e73df;
        box-shadow: 0 0 0 3px rgba(78, 115, 223, 0.15);
    }

    /* Actions */
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
        cursor: pointer;
    }
    .btn-save:hover {
        background: #0069d9;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    /* Global DataTable Overrides (same as users.svelte) */
    :global(.dataTable-wrapper) {
        font-family: inherit;
    }
    :global(.dataTable-table thead th) {
        border-bottom: 2px solid #edf2f7 !important;
        background: #f8f9fc !important;
        padding: 15px !important;
    }
    :global(.action-buttons-mini) {
        display: flex;
        gap: 8px;
    }
    :global(.btn-mini-custom) {
        width: 34px;
        height: 34px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid #e3e6f0;
        background: white;
        cursor: pointer;
        transition: all 0.2s;
    }
    :global(.btn-mini-custom.delete:hover) {
        background: #e53e3e;
        color: white;
        border-color: #e53e3e;
    }
    :global(.badge-status) {
        padding: 5px 12px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
    }
    :global(.badge-status.active) {
        background: #c6f6d5;
        color: #22543d;
    }
    :global(.badge-status.inactive) {
        background: #fed7d7;
        color: #822727;
    }
</style>
