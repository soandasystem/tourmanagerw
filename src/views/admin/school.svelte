<script>
    import { onMount, onDestroy } from "svelte";
    import { DataTable } from "simple-datatables";
    import "simple-datatables/dist/style.css";
    import { secureStorage } from "../../lib/secureStore";
    import { tenantStore } from "../../stores/tenant";
    import api from "../../lib/apis.js";
    import Swal from "sweetalert2";
    import { hasPermissionPrograms } from "../../lib/utils";

    let viewMode = "list";
    let isEditing = false;
    let showDeleteModal = false;
    let itemIdToDelete = null;

    $: idcl = $tenantStore;
    const userData = secureStorage.getItem("_us_");
    const schemaName = userData.schema;
    const author = userData.username;
    const currentCompanyId = userData.company;
    const rol = userData.rol_id;

    const getInitialForm = () => ({
        id: null,
        codigo: "",
        nombre: "",
        direccion: "",
        comuna: "",
        latitud: 0,
        longitud: 0,
        region_id: 13,
        comuna_id: 309,
        company_id: currentCompanyId,
        active: "1",
    });

    let schoolForm = getInitialForm();

    $: if (schoolForm.codigo)
        schoolForm.codigo = schoolForm.codigo.toUpperCase().trim();

    /** @type {any[]} */
    let regions = [];
    /** @type {any[]} */
    let communes = [];
    let filteredCommunes = [];

    let schoolToDelete = null;

    // Lista de colegios obtenida desde la API
    /** @type {any[]} */
    let schools = [];

    // Formatear datos para Simple DataTable
    $: isUpdate = hasPermissionPrograms(rol, "school", "UPDATE");
    $: isDelete = hasPermissionPrograms(rol, "school", "DELETE");

    $: dtData = schools.map((p) => {
        let acciones = `<div class="action-buttons-mini">`;
        if (isUpdate) {
            acciones += `<button class="btn-mini-custom edit" onclick="document.dispatchEvent(new CustomEvent('edit-school', {detail: ${p.id}}))" title="Editar">
                <i class="fa fa-pencil"></i>
            </button>`;
        }
        if (isDelete) {
            acciones += `<button class="btn-mini-custom delete" onclick="document.dispatchEvent(new CustomEvent('delete-school', {detail: ${p.id}}))" title="Eliminar">
                <i class="fa fa-trash"></i>
            </button>`;
        }
        acciones += `</div>`;
        return [p.codigo || "", p.nombre || "", p.direccion || "", acciones];
    });

    let dataTableInstance = null;
    // Directiva para DataTable
    function initDataTable(node, dataConfig) {
        if (dataTableInstance) dataTableInstance.destroy();
        dataTableInstance = new DataTable(node, {
            searchable: true,
            sortable: true,
            perPage: 10,
            labels: {
                placeholder: "Buscar colegios...",
                perPage: "por página",
                noRows: "No se encontraron colegios",
                info: "Mostrando {start} a {end} de {rows} registros",
                noResults: "No se encontraron colegios",
            },
            data: {
                headings: ["Código", "Nombre", "Dirección", "Acciones"],
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

    const fetchData = async () => {
        try {
            const [schoolRes, regRes, comRes] = await Promise.all([
                api.getData("colegio", "", "", "", schemaName),
                api.getData("region", "", "", "", "global"),
                api.getData("comunas", "", "", "", "global"),
            ]);

            if (schoolRes.status === "success")
                schools = Array.isArray(schoolRes.data) ? schoolRes.data : [];
            if (regRes.status === "success")
                regions = Array.isArray(regRes.data) ? regRes.data : [];
            if (comRes.status === "success")
                communes = Array.isArray(comRes.data) ? comRes.data : [];

            // El filtrado es ahora reactivo ($:)
        } catch (error) {
            console.error("Error al cargar datos:", error);
        }
    };

    // Filtrado reactivo de comunas basado en la región seleccionada
    $: filteredCommunes = communes.filter(
        (c) => c.regions_id == schoolForm.region_id,
    );

    onMount(() => {
        fetchData();
        document.addEventListener("edit-school", handleEdit);
        document.addEventListener("delete-school", handleDelete);
    });

    onDestroy(() => {
        document.removeEventListener("edit-school", handleEdit);
        document.removeEventListener("delete-school", handleDelete);
    });

    async function handleEdit(event) {
        const projectid = event.detail;
        const data = await api.getData(
            "colegio",
            "",
            "",
            projectid,
            schemaName,
        );

        if (data.status === "success") {
            if (data.data) {
                schoolForm = { ...data.data };
                isEditing = true;
                viewMode = "form";
            }
        }
    }

    async function handleDelete(event) {
        console.log("Eliminando colegio:", event.detail);
        const projectid = event.detail;
        const data = await api.getData(
            "colegio",
            "",
            "",
            projectid,
            schemaName,
        );

        if (data.status === "success") {
            schoolToDelete = data.data;
            showDeleteModal = true;
        }
    }
    async function confirmDelete() {
        if (!schoolToDelete) {
            console.error("No hay colegio seleccionado para eliminar");
            return;
        }
        const data = await api.deleteData(
            "colegio",
            "",
            "",
            schoolToDelete.id,
            schemaName,
        );

        if (data.status === "success") {
            Swal.fire(
                "Eliminado",
                "El programa se eliminó correctamente.",
                "success",
            );
            showDeleteModal = false;
            fetchData();
        } else {
            Swal.fire("Error", "Error al eliminar: " + data.message, "error");
        }
    }

    function openCreateForm() {
        schoolForm = getInitialForm();
        isEditing = false;
        viewMode = "form";
    }

    function returnToList() {
        viewMode = "list";
    }

    async function saveForm() {
        // Cálculo automático del total mt2
        let data;
        if (isEditing) {
            const jsonData = JSON.stringify(schoolForm);
            data = await api.updateData(
                "colegio",
                jsonData,
                "",
                schoolForm.id,
                schemaName,
            );
        } else {
            const company_id = userData.company;
            schoolForm.company_id = company_id;
            const jsonData = JSON.stringify(schoolForm);
            data = await api.setData("colegio", jsonData, "", "", schemaName);
        }
        if (data.status === "success") {
            Swal.fire(
                "Guardado",
                "El programa se guardó correctamente.",
                "success",
            );
            viewMode = "list";
            fetchData();
        } else {
            Swal.fire("Error", data.message, "error");
        }
    }
</script>

<div class="page-wrapper">
    {#if viewMode === "list"}
        <div class="card main-card shadow-sm border-0 mb-4">
            <div class="card-header-flex p-4">
                <div class="title-group">
                    <div class="title-with-icon">
                        <i class="fa fa-map-o icon-main text-primary"></i>
                        <h2 class="m-0">Gestión de Colegios</h2>
                    </div>
                    <p class="subtitle mt-1 mb-0">
                        Administra los colegios y sus valores.
                    </p>
                </div>
                {#if hasPermissionPrograms(rol, "school", "INSERT")}
                    <button class="btn-new" on:click={openCreateForm}>
                        <i class="fa fa-plus"></i> Nuevo Colegio
                    </button>
                {/if}
            </div>
            <div class="table-container p-3 pt-0">
                {#key dtData}
                    <table
                        use:initDataTable={dtData}
                        class="table table-hover w-100"
                    ></table>
                {/key}
            </div>
        </div>
    {:else}
        <div class="card main-card shadow-sm border-0">
            <div class="card-header-flex p-4 border-bottom">
                <div class="title-with-icon">
                    <i
                        class="fa {isEditing
                            ? 'fa-pencil'
                            : 'fa-plus'} icon-main text-primary"
                    ></i>
                    <h2 class="m-0">
                        {isEditing ? "Editar Colegio" : "Nuevo Colegio"}
                    </h2>
                </div>
                <button class="btn-back" on:click={returnToList}>
                    <i class="fa fa-arrow-left"></i> Volver al listado
                </button>
            </div>

            <div class="card-body p-4">
                <div class="form-content-premium">
                    <div class="section-title mb-4">
                        Información del Colegio
                    </div>
                    <div class="row g-2">
                        <div class="col-md-3">
                            <div class="form-group-custom">
                                <label for="codigo">Código</label>
                                <input
                                    type="text"
                                    id="codigo"
                                    class="form-control-custom"
                                    bind:value={schoolForm.codigo}
                                    maxlength="12"
                                    placeholder="Ej: COL001"
                                />
                            </div>
                        </div>
                        <div class="col-md-9">
                            <div class="form-group-custom">
                                <label for="nombre">Nombre del Colegio</label>
                                <input
                                    type="text"
                                    id="nombre"
                                    class="form-control-custom"
                                    bind:value={schoolForm.nombre}
                                    maxlength="100"
                                    placeholder="Nombre de la institución"
                                />
                            </div>
                        </div>
                        <div class="col-md-12">
                            <div class="form-group-custom">
                                <label for="direccion">Dirección</label>
                                <input
                                    type="text"
                                    id="direccion"
                                    class="form-control-custom"
                                    bind:value={schoolForm.direccion}
                                    maxlength="100"
                                    placeholder="Calle, Número, Ciudad"
                                />
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group-custom">
                                <label for="region">Región</label>
                                <select
                                    id="region"
                                    class="form-select-custom"
                                    bind:value={schoolForm.region_id}
                                    on:change={() => {
                                        schoolForm.comuna_id = 0;
                                    }}
                                >
                                    <option value="">Seleccionar</option>
                                    {#each regions as region}
                                        <option value={region.id}
                                            >{region.description}</option
                                        >
                                    {/each}
                                </select>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group-custom">
                                <label for="comuna">Comuna</label>
                                <select
                                    id="comuna"
                                    class="form-select-custom"
                                    bind:value={schoolForm.comuna_id}
                                >
                                    <option value="">Seleccionar</option>
                                    {#each filteredCommunes as commune}
                                        <option value={commune.id}
                                            >{commune.description}</option
                                        >
                                    {/each}
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6 d-flex align-items-end">
                        <div class="form-check form-switch mb-2">
                            <input
                                class="form-check-input"
                                type="checkbox"
                                id="active"
                                bind:checked={schoolForm.active}
                            />
                            <label
                                class="form-check-label fw-bold ms-2"
                                for="active">Estado Activo</label
                            >
                        </div>
                    </div>
                </div>

                <div class="form-actions border-top pt-4">
                    <button class="btn btn-save" on:click={saveForm}>
                        <i class="fa fa-save"></i> Guardar
                    </button>
                    <button class="btn btn-cancel" on:click={returnToList}>
                        <i class="fa fa-chevron-left"></i> Cancelar y Volver
                    </button>
                </div>
            </div>
        </div>
    {/if}
</div>

<!-- Modal de Eliminación -->
{#if showDeleteModal && schoolToDelete}
    <div class="modal-backdrop fade show"></div>
    <div class="modal show d-block" tabindex="-1">
        <div class="modal-dialog modal-sm modal-dialog-centered">
            <div class="modal-content border-0 shadow">
                <div class="modal-header bg-danger text-white border-0">
                    <h5 class="modal-title">Eliminar Colegio</h5>
                    <button
                        type="button"
                        title="eliminar"
                        class="btn-close btn-close-white"
                        on:click={() => (showDeleteModal = false)}
                    ></button>
                </div>
                <div class="modal-body text-center p-4">
                    <i class="fa fa-warning fa-3x text-danger mb-3"></i>
                    <p class="mb-0">
                        ¿Eliminar a <strong>{schoolToDelete.nombre}</strong>?
                    </p>
                </div>
                <div class="modal-footer border-0 justify-content-center pt-0">
                    <button
                        type="button"
                        class="btn btn-light"
                        on:click={() => (showDeleteModal = false)}
                        >Cancelar</button
                    >
                    <button
                        type="button"
                        class="btn btn-danger px-4"
                        on:click={confirmDelete}>Eliminar</button
                    >
                </div>
            </div>
        </div>
    </div>
{/if}

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
    .btn-new {
        background-color: #4e73df;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.9rem;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s;
    }
    .btn-new:hover {
        background-color: #2e59d9;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(78, 115, 223, 0.2);
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
    .form-control-custom:focus {
        outline: none;
        padding: 12px 30px;
        border-radius: 8px;
        font-weight: 700;
        border: none;
        transition: all 0.2s;
    }
    .btn-save:hover {
        background: #2e59d9;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(78, 115, 223, 0.3);
    }
    .btn-cancel {
        background: transparent;
        color: #718096;
        padding: 12px 30px;
        border-radius: 8px;
        font-weight: 600;
        border: 1px solid #e3e6f0;
        margin-left: 10px;
    }

    /* Modal */
    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        backdrop-filter: blur(4px);
    }
    /* Global Table Overrides */
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
    :global(.btn-mini-custom.edit:hover) {
        background: #4e73df;
        color: white;
        border-color: #4e73df;
    }
    :global(.btn-mini-custom.delete:hover) {
        background: #e53e3e;
        color: white;
        border-color: #e53e3e;
    }
    :global(.btn-status-toggle) {
        padding: 5px 12px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        border: none;
    }
    :global(.btn-status-toggle.active) {
        background: #c6f6d5;
        color: #22543d;
    }
    :global(.btn-status-toggle.inactive) {
        background: #fed7d7;
        color: #822727;
    }

    /* Actions */
    .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 5px;
        padding-top: 20px;
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
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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
