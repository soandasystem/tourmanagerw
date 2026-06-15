<script>
    import { onMount, onDestroy } from "svelte";
    import { DataTable } from "simple-datatables";
    import "simple-datatables/dist/style.css";
    import { secureStorage } from "../../lib/secureStore";
    import { tenantStore } from "../../stores/tenant";
    import api from "../../lib/apis.js";
    import dayjs from "dayjs";
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
    const company_id = userData.company;
    const rol = userData.rol_id;

    const getInitialForm = () => ({
        id: null,
        code: "",
        name: "",
        reserva: "",
        matrix: [{ desde: "", hasta: "", liberado: "", monto: "" }],
        origin: "CL",
        destination: "",
        origincode: "SCL",
        destinationcode: "",
        active: true,
    });

    let programsForm = getInitialForm();

    let programsToDelete = null;
    let programs = [];
    let countries = [];
    let airports = [];

    // Mapeo dinámico para Simple-Datatables
    $: isUpdate = hasPermissionPrograms(rol, "programas", "UPDATE");
    $: isDelete = hasPermissionPrograms(rol, "programas", "DELETE");
    $: isCreate = hasPermissionPrograms(rol, "programas", "CREATE");

    $: dtData = programs.map((s) => {
        let acciones = `<div class="action-buttons-mini">`;
        if (isUpdate) {
            acciones += `<button class="btn-mini-custom edit" data-id="${s.id}" data-action="edit" title="Editar">
                <i class="fa fa-pencil"></i>
            </button>`;
        }
        if (isDelete) {
            acciones += `<button class="btn-mini-custom delete" data-id="${s.id}" data-action="delete" title="Eliminar">
                <i class="fa fa-trash"></i>
            </button>`;
        }
        acciones += `</div>`;
        return [
            s.code,
            s.name,
            `<button class="btn-status-toggle ${s.active == 1 ? "active" : "inactive"}" 
        data-id="${s.id}" data-action="toggle-status" ${!isUpdate ? "disabled" : ""}>
        ${s.active == 1 ? "Activo" : "Inactivo"}
        </button>`,
            s.UpdateDate
                ? dayjs(s.UpdateDate).format("DD/MM/YYYY HH:mm")
                : "Reciente",
            s.author,
            acciones,
        ];
    });

    let dataTableInstance = null;

    function initDataTable(node, dataConfig) {
        if (dataTableInstance) dataTableInstance.destroy();
        dataTableInstance = new DataTable(node, {
            searchable: true,
            perPage: 5,
            labels: {
                placeholder: "Buscar programas...",
                perPage: "{select} registros por página",
                noRows: "No se encontraron programas",
                info: "Mostrando {start} a {end} de {rows} programas",
                noResults: "No results match your search query",
            },
            data: {
                headings: [
                    "Código",
                    "Descripción",
                    "Estado",
                    "Actualización",
                    "Modificador",
                    "Acciones",
                ],
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

    const fetchPrograms = async () => {
        try {
            const res = await api.getData(
                "programs",
                "",
                `company_id=${company_id}`,
                "",
                schemaName,
            );
            if (res.status === "success") {
                programs = Array.isArray(res.data) ? res.data : [];
            }
        } catch (error) {
            console.error("Error fetching programs:", error);
        }
    };

    const fetchExtraData = async () => {
        try {
            const resCountries = await api.getData(
                "countries",
                "",
                "",
                "",
                schemaName,
            );
            if (resCountries.status === "success")
                countries = resCountries.data;
            const resAirports = await api.getData(
                "airports",
                "",
                "",
                "",
                schemaName,
            );
            if (resAirports.status === "success") airports = resAirports.data;
        } catch (error) {
            console.error("Error fetching extra data:", error);
        }
    };

    function handleTableClick(e) {
        const target = e.target.closest("button");
        if (!target) return;
        const id = target.getAttribute("data-id");
        const action = target.getAttribute("data-action");
        if (!id || !action) return;

        if (action === "edit") handleEdit(id);
        if (action === "delete") handleDelete(id);
        if (action === "toggle-status") handleToggleStatus(id);
    }

    const handleEdit = async (id) => {
        try {
            const res = await api.getData("programs", "", "", id, schemaName);
            if (res.status === "success" && res.data) {
                const program = Array.isArray(res.data)
                    ? res.data[0]
                    : res.data;

                let matrix = [
                    { desde: "", hasta: "", liberado: "", monto: "" },
                ];
                if (program.matrix) {
                    try {
                        const parsed =
                            typeof program.matrix === "string"
                                ? JSON.parse(program.matrix)
                                : program.matrix;
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            matrix = parsed;
                        }
                    } catch (e) {
                        console.error(
                            "Error al parsear la matriz del programa:",
                            e,
                        );
                    }
                }

                programsForm = {
                    id: program.id,
                    code: program.code,
                    name: program.name,
                    reserva: program.reserva,
                    matrix: matrix,
                    origin: program.origin || "CL",
                    destination: program.destination || "",
                    origincode: program.origincode || "SCL",
                    destinationcode: program.destinationcode || "",
                    active: program.active == 1,
                };
                isEditing = true;
                viewMode = "form";
            }
        } catch (error) {
            console.error("Error loading program for edit:", error);
        }
    };

    function handleDelete(id) {
        const company = programs.find((u) => u.id == id);
        if (company) {
            programsToDelete = company;
            showDeleteModal = true;
        }
    }

    async function confirmDelete() {
        if (!programsToDelete) return;
        const data = await api.deleteData(
            "programs",
            "",
            "",
            programsToDelete.id,
            schemaName,
        );
        if (data.status === "success") {
            Swal.fire(
                "Eliminado",
                "El programa se eliminó correctamente.",
                "success",
            );
            showDeleteModal = false;
            fetchPrograms();
        } else {
            Swal.fire("Error", "Error al eliminar: " + data.message, "error");
        }
    }

    const handleToggleStatus = async (id) => {
        const program = programs.find((p) => p.id == id);
        if (!program) return;
        const newStatus = program.active == 1 ? 0 : 1;
        try {
            await api.updateData(
                "programs",
                { active: newStatus },
                "",
                id,
                schemaName,
            );
            fetchPrograms();
        } catch (error) {
            Swal.fire("Error", error, "error");
            console.error("Error toggling status:", error);
        }
    };

    function openCreateForm() {
        programsForm = getInitialForm();
        isEditing = false;
        viewMode = "form";
    }

    function addMatrixRow() {
        programsForm.matrix = [
            ...programsForm.matrix,
            { desde: "", hasta: "", liberado: "", monto: "" },
        ];
    }

    function removeMatrixRow(index) {
        if (programsForm.matrix.length > 1) {
            programsForm.matrix = programsForm.matrix.filter(
                (_, i) => i !== index,
            );
        }
    }

    const saveProgram = async () => {
        const payload = {
            ...programsForm,
            company_id: company_id,
            author: author,
            active: programsForm.active ? 1 : 0,
            matrix: JSON.stringify(programsForm.matrix), // Adaptar según espera el backend
        };

        try {
            let res;
            if (isEditing) {
                res = await api.updateData(
                    "programs",
                    payload,
                    "",
                    programsForm.id,
                    schemaName,
                );
            } else {
                res = await api.setData(
                    "programs",
                    payload,
                    "",
                    "",
                    schemaName,
                );
            }

            if (res.status === "success") {
                Swal.fire(
                    "Guardado",
                    "El programa se guardó correctamente.",
                    "success",
                );
                viewMode = "list";
                fetchPrograms();
            } else {
                Swal.fire("Error", res.message, "error");
            }
        } catch (error) {
            console.error("Error saving program:", error);
        }
    };

    onMount(() => {
        fetchPrograms();
        fetchExtraData();
        document.addEventListener("click", handleTableClick);
    });

    onDestroy(() => {
        document.removeEventListener("click", handleTableClick);
        if (dataTableInstance) dataTableInstance.destroy();
    });
</script>

<div class="page-wrapper">
    {#if viewMode === "list"}
        <div class="card main-card shadow-sm border-0 mb-4">
            <div class="card-header-flex p-4">
                <div class="title-group">
                    <div class="title-with-icon">
                        <i class="fa fa-map-o icon-main text-primary"></i>
                        <h2 class="m-0">Gestión de Programas</h2>
                    </div>
                    <p class="subtitle mt-1 mb-0">
                        Administra los programas y sus valores.
                    </p>
                </div>
                {#if isCreate}
                    <button class="btn-new" on:click={openCreateForm}>
                        <i class="fa fa-plus"></i> Nuevo Programa
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
                        {isEditing ? "Editar" : "Nuevo"} Programa
                    </h2>
                </div>
                <button class="btn-back" on:click={() => (viewMode = "list")}>
                    <i class="fa fa-arrow-left"></i> Volver
                </button>
            </div>

            <div class="card-body p-4">
                <form on:submit|preventDefault={saveProgram}>
                    <div class="section-title mb-4">Información General</div>
                    <div class="row g-2">
                        <div class="col-md-3">
                            <div class="form-group-custom">
                                <label for="code">Código</label>
                                <input
                                    type="text"
                                    id="code"
                                    class="form-control-custom"
                                    bind:value={programsForm.code}
                                    maxlength="12"
                                    required
                                    placeholder="Ej: PRG001"
                                />
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group-custom">
                                <label for="name">Descripción / Nombre</label>
                                <input
                                    type="text"
                                    id="name"
                                    class="form-control-custom"
                                    bind:value={programsForm.name}
                                    maxlength="100"
                                    required
                                    placeholder="Descripción del programa"
                                />
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="form-group-custom">
                                <label for="reserva">Valor Reserva PP</label>
                                <div class="input-group-custom">
                                    <span class="input-prefix">$</span>
                                    <input
                                        type="number"
                                        id="reserva"
                                        class="form-control-custom"
                                        bind:value={programsForm.reserva}
                                        required
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div
                        class="section-title mb-4 d-flex justify-content-between align-items-center"
                    >
                        <span>Matriz de Valores</span>
                    </div>

                    <div class="matrix-container mb-5">
                        <div class="table-responsive">
                            <table class="table table-custom">
                                <thead>
                                    <tr>
                                        <th>Desde</th>
                                        <th>Hasta</th>
                                        <th>Liberados/Porc.</th>
                                        <th>Monto</th>
                                        <th class="text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {#each programsForm.matrix as row, i}
                                        <tr class="align-middle">
                                            <td
                                                ><input
                                                    type="number"
                                                    class="form-control-custom mini"
                                                    bind:value={row.desde}
                                                    placeholder="0"
                                                /></td
                                            >
                                            <td
                                                ><input
                                                    type="number"
                                                    class="form-control-custom mini"
                                                    bind:value={row.hasta}
                                                    placeholder="0"
                                                /></td
                                            >
                                            <td
                                                ><input
                                                    type="number"
                                                    class="form-control-custom mini"
                                                    bind:value={row.liberado}
                                                    placeholder="0"
                                                /></td
                                            >
                                            <td>
                                                <div class="input-group-custom">
                                                    <span class="input-prefix"
                                                        >$</span
                                                    >
                                                    <input
                                                        type="number"
                                                        class="form-control-custom mini"
                                                        bind:value={row.monto}
                                                        placeholder="0"
                                                    />
                                                </div>
                                            </td>
                                            <td class="text-center">
                                                <div
                                                    class="d-flex justify-content-center gap-2"
                                                >
                                                    {#if i === programsForm.matrix.length - 1}
                                                        <button
                                                            type="button"
                                                            class="btn-add-row"
                                                            title="Agregar tramo"
                                                            on:click={addMatrixRow}
                                                        >
                                                            <i
                                                                class="fa fa-plus"
                                                            ></i>
                                                        </button>
                                                    {/if}
                                                    <button
                                                        type="button"
                                                        class="btn-delete-row"
                                                        title="Eliminar fila"
                                                        on:click={() =>
                                                            removeMatrixRow(i)}
                                                        disabled={programsForm
                                                            .matrix.length ===
                                                            1}
                                                    >
                                                        <i class="fa fa-trash"
                                                        ></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    {/each}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="section-title mb-4">GDS Amadeus (Opcional)</div>
                    <div class="row g-2">
                        <div class="col-md-3">
                            <div class="form-group-custom">
                                <label for="origin">Ciudad Origen</label>
                                <select
                                    id="origin"
                                    class="form-select-custom"
                                    bind:value={programsForm.origin}
                                >
                                    <option value="">Seleccionar</option>
                                    {#each countries as country}
                                        <option value={country.code}
                                            >{country.country}</option
                                        >
                                    {/each}
                                </select>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="form-group-custom">
                                <label for="origincode">Aeropuerto Origen</label
                                >
                                <select
                                    id="origincode"
                                    class="form-select-custom"
                                    bind:value={programsForm.origincode}
                                >
                                    <option value="">Seleccionar</option>
                                    {#each airports as airport}
                                        <option value={airport.iata}
                                            >{airport.name} ({airport.iata})</option
                                        >
                                    {/each}
                                </select>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="form-group-custom">
                                <label for="destination">Ciudad Destino</label>
                                <select
                                    id="destination"
                                    class="form-select-custom"
                                    bind:value={programsForm.destination}
                                >
                                    <option value="">Seleccionar</option>
                                    {#each countries as country}
                                        <option value={country.code}
                                            >{country.country}</option
                                        >
                                    {/each}
                                </select>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="form-group-custom">
                                <label for="destinationcode"
                                    >Aeropuerto Destino</label
                                >
                                <select
                                    id="destinationcode"
                                    class="form-select-custom"
                                    bind:value={programsForm.destinationcode}
                                >
                                    <option value="">Seleccionar</option>
                                    {#each airports as airport}
                                        <option value={airport.iata}
                                            >{airport.name} ({airport.iata})</option
                                        >
                                    {/each}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="row mb-5">
                        <div class="col-md-12">
                            <div class="d-flex align-items-center gap-3">
                                <label class="switch-container">
                                    <input
                                        type="checkbox"
                                        bind:checked={programsForm.active}
                                    />
                                    <span class="slider round"></span>
                                </label>
                                <span class="fw-semibold text-muted"
                                    >¿Activar Programa?</span
                                >
                            </div>
                        </div>
                    </div>

                    <div class="form-actions border-top pt-4">
                        <button type="submit" class="btn btn-save">
                            <i class="fa fa-save"></i> Guardar
                        </button>
                        <button
                            type="button"
                            class="btn btn-cancel"
                            on:click={() => (viewMode = "list")}
                        >
                            <i class="fa fa-chevron-left"></i> Cancelar y Volver
                        </button>
                    </div>
                </form>
            </div>
        </div>
    {/if}
</div>

<!-- Modal de Eliminación -->
{#if showDeleteModal && programsToDelete}
    <div class="modal-backdrop fade show"></div>
    <div class="modal show d-block" tabindex="-1">
        <div class="modal-dialog modal-sm modal-dialog-centered">
            <div class="modal-content border-0 shadow">
                <div class="modal-header bg-danger text-white border-0">
                    <h5 class="modal-title">Eliminar Programa</h5>
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
                        ¿Eliminar a <strong>{programsToDelete.name}</strong>?
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

    /* Form Styles */
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
        border-color: #bac8f3;
        box-shadow: 0 0 0 2px rgba(78, 115, 223, 0.1);
    }
    .form-control-custom.mini {
        padding: 6px 10px;
        font-size: 0.85rem;
    }

    .input-group-custom {
        display: flex;
        align-items: center;
        position: relative;
    }
    .input-prefix {
        position: absolute;
        left: 12px;
        color: #a0aec0;
        font-weight: 600;
    }
    .input-group-custom .form-control-custom {
        padding-left: 30px;
    }

    /* Matrix Table */
    .table-custom {
        border-collapse: separate;
        border-spacing: 0 8px;
    }
    .table-custom thead th {
        background: #f8f9fc;
        border: none;
        font-size: 0.8rem;
        text-transform: uppercase;
        color: #718096;
        padding: 12px;
    }
    .table-custom tbody tr {
        background: white;
        transition: transform 0.2s;
    }
    .table-custom tbody td {
        border: none;
        border-top: 1px solid #edf2f7;
        border-bottom: 1px solid #edf2f7;
        padding: 12px;
    }
    .table-custom tbody td:first-child {
        border-left: 1px solid #edf2f7;
        border-top-left-radius: 8px;
        border-bottom-left-radius: 8px;
    }
    .table-custom tbody td:last-child {
        border-right: 1px solid #edf2f7;
        border-top-right-radius: 8px;
        border-bottom-right-radius: 8px;
    }

    .btn-delete-row {
        background: #fff5f5;
        color: #e53e3e;
        border: 1px solid #fed7d7;
        width: 34px;
        height: 34px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
    }
    .btn-delete-row:hover:not(:disabled) {
        background: #e53e3e;
        color: white;
    }
    .btn-delete-row:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }

    .btn-add-row {
        background: #ebf4ff;
        color: #4e73df;
        border: 1px solid #c3dafe;
        width: 34px;
        height: 34px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        cursor: pointer;
    }
    .btn-add-row:hover {
        background: #4e73df;
        color: white;
    }

    /* Switch Custom */
    .switch-container {
        position: relative;
        display: inline-block;
        width: 46px;
        height: 24px;
    }
    .switch-container input {
        opacity: 0;
        width: 0;
        height: 0;
    }
    .slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #cbd5e0;
        transition: 0.4s;
    }
    .slider:before {
        position: absolute;
        content: "";
        height: 18px;
        width: 18px;
        left: 3px;
        bottom: 3px;
        background-color: white;
        transition: 0.4s;
    }
    input:checked + .slider {
        background-color: #4e73df;
    }
    input:checked + .slider:before {
        transform: translateX(22px);
    }
    .slider.round {
        border-radius: 34px;
    }
    .slider.round:before {
        border-radius: 50%;
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
        background: #2e59d9;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(78, 115, 223, 0.3);
    }
    .btn-cancel {
        order: 1;
        background: transparent;
        color: #718096;
        padding: 12px 30px;
        border-radius: 8px;
        font-weight: 600;
        border: 1px solid #e3e6f0;
    }
    .btn-cancel:hover {
        background: #edf2f7;
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
