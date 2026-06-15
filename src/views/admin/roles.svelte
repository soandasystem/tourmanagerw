<script>
    import { onMount, onDestroy } from "svelte";
    import { DataTable } from "simple-datatables";
    import "simple-datatables/dist/style.css";
    import api from "../../lib/apis.js";
    import { hasPermissionPrograms } from "../../lib/utils";
    import dayjs from "dayjs";
    import { secureStorage } from "../../lib/secureStore";
    import Swal from "sweetalert2";
    const array_permissions = {
        dashboard: { label: "Estadisticas", actions: "VIEW" },
        company: { label: "Empresa", actions: "VIEW|INSERT|UPDATE|DELETE" },
        programas: { label: "Programas", actions: "VIEW|INSERT|UPDATE|DELETE" },
        roles: { label: "Roles", actions: "VIEW|INSERT|UPDATE|DELETE" },
        school: { label: "Colegios", actions: "VIEW|INSERT|UPDATE|DELETE" },
        users: { label: "usuarios", actions: "VIEW|INSERT|UPDATE|DELETE" },
        gatewaysconfig: {
            label: "Config Pasarelas de Pago",
            actions: "VIEW|INSERT|UPDATE|DELETE",
        },
        gateways: {
            label: "Pasarelas de Pago",
            actions: "VIEW|INSERT|UPDATE|DELETE",
        },
        gdsair: { label: "Ticket Aereos", actions: "VIEW" },
        gdshotel: { label: "Hoteles", actions: "VIEW" },
        quotes: {
            label: "Cotizacion Programa",
            actions: "VIEW|INSERT|UPDATE|DELETE|EXPORT_REPORT",
        },
        sales: {
            label: "Venta Programa",
            actions: "VIEW|INSERT|UPDATE|DELETE",
        },
        course: { label: "Cursos", actions: "VIEW|INSERT|UPDATE|DELETE" },
        entry: { label: "Ingresos", actions: "VIEW|INSERT|UPDATE|DELETE" },
        listpay: { label: "Pagos", actions: "VIEW|INSERT|UPDATE|DELETE" },
        voucher: { label: "Voucher", actions: "VIEW|INSERT|UPDATE|DELETE" },
        salesreport: {
            label: "Comisiones Vendedor",
            actions: "VIEW|EXPORT_REPORT",
        },
    };

    // Estado principal de la vista
    let viewMode = "list";
    let isEditing = false;
    let showDeleteModal = false;

    const userData = secureStorage.getItem("_us_") || {};
    const schemaName = userData.schema || "";
    const author = userData.username || "";
    const company = userData.company || "";
    const rol = userData.rol_id || "";

    // Objeto base para el formulario
    /**
     * @returns {{
     *  id: number | null,
     *  description: string,
     *  active: string,
     *  company_id: number | string,
     *  author: string,
     *  permissions: Record<string, string[]>
     * }}
     */
    const getInitialForm = () => {
        const form = {
            id: null,
            description: "",
            active: "1",
            company_id: company,
            author: author,
            permissions: {},
        };
        // Inicializamos las llaves de permisos
        Object.keys(array_permissions).forEach((key) => {
            form.permissions[key] = [];
        });
        return form;
    };

    /** @type {ReturnType<typeof getInitialForm>} */
    let rolesForm = getInitialForm();

    const array_descriptions_actions = {
        INSERT: "Agregar",
        UPDATE: "Editar",
        DELETE: "Eliminar",
        VIEW: "Ver",
        IMPORT_COURSE: "Importar Curso",
        EXPORT_REPORT: "Exportar Informe",
    };

    let rolesToDelete = null;
    let roles = [];
    // Mapeo dinámico para Simple-Datatables
    $: isUpdate = hasPermissionPrograms(rol, "roles", "UPDATE");
    $: isDelete = hasPermissionPrograms(rol, "roles", "DELETE");

    $: dtData = roles.map((r) => {
        let acciones = `<div class="action-buttons-mini">`;
        if (isUpdate) {
            acciones += `<button class="btn-mini-custom edit" onclick="document.dispatchEvent(new CustomEvent('edit-role', {detail: ${r.id}}))" title="Editar">
                <i class="fa fa-pencil"></i>
            </button>`;
        }
        if (isDelete) {
            acciones += `<button class="btn-mini-custom delete" onclick="document.dispatchEvent(new CustomEvent('delete-role', {detail: ${r.id}}))" title="Eliminar">
                <i class="fa fa-trash"></i>
            </button>`;
        }
        acciones += `</div>`;
        return [
            r.description || "",
            `<button class="btn-status-toggle ${r.active == 1 ? "active" : "inactive"}" 
        onclick="document.dispatchEvent(new CustomEvent('toggle-status', {detail: {id: ${r.id}, active: ${r.active}}}))">
        ${r.active == 1 ? "Activo" : "Inactivo"}
        </button>`,
            r.author || "",
            r.updated
                ? dayjs(r.updated).format("DD/MM/YYYY HH:mm")
                : "Reciente",
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
                placeholder: "Buscar roles...",
                perPage: "por página",
                noRows: "No se encontraron roles",
                info: "Mostrando {start} a {end} de {rows} registros",
                noResults: "No se encontraron roles",
            },
            data: {
                headings: [
                    "Descripción",
                    "Estado",
                    "Autor",
                    "Modificado",
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

    const fetchRoles = async () => {
        try {
            const data = await api.getData(
                "roles",
                "",
                `company_id=${company}`,
                "",
                schemaName,
            );
            if (data.status === "success")
                roles = Array.isArray(data.data) ? data.data : [];
        } catch (error) {
            console.error("Error al cargar roles:", error);
        }
    };

    onMount(() => {
        fetchRoles();
        document.addEventListener("edit-role", handleEdit);
        document.addEventListener("delete-role", handleDelete);
        document.addEventListener("toggle-status", handleToggleStatus);
    });

    onDestroy(() => {
        document.removeEventListener("edit-role", handleEdit);
        document.removeEventListener("delete-role", handleDelete);
        document.removeEventListener("toggle-status", handleToggleStatus);
    });

    async function handleToggleStatus(event) {
        const { id, active } = event.detail;
        const newActive = active == 1 ? 0 : 1;

        try {
            const data = await api.updateData(
                "roles",
                { active: newActive },
                "",
                id,
                schemaName,
            );
            if (data.status === "success") {
                fetchRoles();
            } else {
                Swal.fire("Error", "No se pudo cambiar el estado", "error");
            }
        } catch (error) {
            console.error("Error al cambiar estado:", error);
        }
    }

    async function handleEdit(event) {
        const id = event.detail;
        const data = await api.getData("roles", "", "", id, schemaName);
        if (data.status === "success") {
            const rawRole = data.data;
            // Parseamos los permisos si vienen como string desde la base de datos
            /** @type {Record<string, string[]>} */
            let perms = {};
            if (rawRole.permissions) {
                try {
                    perms =
                        typeof rawRole.permissions === "string"
                            ? JSON.parse(rawRole.permissions)
                            : rawRole.permissions;
                } catch (e) {
                    perms = {};
                }
            }

            // Aseguramos que todos los módulos existan en perms aunque no tengan datos
            Object.keys(array_permissions).forEach((key) => {
                if (!perms[key]) perms[key] = [];
            });

            rolesForm = {
                ...rawRole,
                permissions: perms,
                active: String(rawRole.active),
            };
            isEditing = true;
            viewMode = "form";
        }
    }

    async function handleDelete(event) {
        const id = event.detail;
        const role = roles.find((r) => r.id == id);
        if (role) {
            rolesToDelete = role;
            showDeleteModal = true;
        }
    }

    async function confirmDelete() {
        if (!rolesToDelete) return;
        const data = await api.deleteData(
            "roles",
            "",
            "",
            rolesToDelete.id,
            schemaName,
        );
        if (data.status === "success") {
            Swal.fire(
                "Eliminado",
                "El rol se eliminó correctamente.",
                "success",
            );
            showDeleteModal = false;
            fetchRoles();
        } else {
            Swal.fire("Error", "Error al eliminar: " + data.message, "error");
        }
    }

    function openCreateForm() {
        rolesForm = getInitialForm();
        isEditing = false;
        viewMode = "form";
    }

    function returnToList() {
        viewMode = "list";
    }

    async function saveForm() {
        const payload = {
            id: rolesForm.id,
            description: rolesForm.description,
            active: Number(rolesForm.active),
            author: author || rolesForm.author,
            permissions: rolesForm.permissions,
            company_id: company,
        };
        let data;
        if (isEditing) {
            data = await api.updateData(
                "roles",
                payload,
                "",
                rolesForm.id,
                schemaName,
            );
        } else {
            data = await api.setData("roles", payload, "", "", schemaName);
        }

        if (data.status === "success") {
            Swal.fire("Guardado", "El rol se guardó correctamente.", "success");
            fetchRoles();
            viewMode = "list";
        } else {
            Swal.fire("Error", "Error al guardar: " + data.message, "error");
        }
    }
</script>

<div class="page-wrapper">
    {#if viewMode === "list"}
        <div class="card main-card shadow-sm border-0 mb-4">
            <div class="card-header-flex p-4">
                <div class="title-group">
                    <div class="title-with-icon">
                        <i class="fa fa-users icon-main text-primary"></i>
                        <h2 class="m-0">Gestión de Roles</h2>
                    </div>
                    <p class="subtitle mt-1 mb-0">
                        Administra los roles y sus permisos de los usuarios.
                    </p>
                </div>
                {#if hasPermissionPrograms(rol, "roles", "INSERT")}
                    <button class="btn-new" on:click={openCreateForm}>
                        <i class="fa fa-plus"></i> Nuevo Rol
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
    {:else if viewMode === "form"}
        <div class="card main-card shadow-sm border-0">
            <div class="card-header-flex p-4 border-bottom">
                <div class="title-with-icon">
                    <i
                        class="fa {isEditing
                            ? 'fa-pencil'
                            : 'fa-plus'} icon-main text-primary"
                    ></i>
                    <h2 class="m-0">
                        {isEditing ? "Editar" : "Nuevo"} Rol
                    </h2>
                </div>
                <button class="btn-back" on:click={() => (viewMode = "list")}>
                    <i class="fa fa-arrow-left"></i> Volver
                </button>
            </div>

            <div class="card-body p-4">
                <form on:submit|preventDefault={saveForm}>
                    <div class="section-title mb-4">Información del Rol</div>
                    <div class="row g-2">
                        <div class="col-md-9">
                            <div class="form-group-custom">
                                <label for="description"
                                    >Descripción del Rol</label
                                >
                                <input
                                    type="text"
                                    class="form-control-custom"
                                    id="description"
                                    bind:value={rolesForm.description}
                                    required
                                    maxlength="255"
                                    placeholder="Ej: Administrador de Ventas"
                                />
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="form-group-custom">
                                <label for="active">Estado</label>
                                <select
                                    class="form-select-custom"
                                    id="active"
                                    bind:value={rolesForm.active}
                                >
                                    <option value="1">Activo</option>
                                    <option value="0">Inactivo</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="section-title mb-4">
                        <i class="fa fa-th me-2"></i> Matriz de Permisos
                    </div>
                    <div class="table-responsive border rounded bg-light mb-4">
                        <table
                            class="table table-sm table-hover mb-0 align-middle"
                        >
                            <thead class="table-dark">
                                <tr>
                                    <th style="width: 40%">Módulo</th>
                                    <th colspan="6">Acciones Disponibles</th>
                                </tr>
                            </thead>
                            <tbody>
                                {#each Object.entries(array_permissions) as [key, item]}
                                    <tr>
                                        <td class="fw-bold px-3">
                                            <i
                                                class="fa fa-angle-right text-primary me-2"
                                            ></i>
                                            {item.label}
                                        </td>
                                        {#each item.actions.split("|") as action}
                                            <td>
                                                <div
                                                    class="form-check form-check-inline mb-0"
                                                >
                                                    <input
                                                        class="form-check-input"
                                                        type="checkbox"
                                                        id="chk-{key}-{action}"
                                                        value={action}
                                                        bind:group={
                                                            rolesForm
                                                                .permissions[
                                                                key
                                                            ]
                                                        }
                                                    />
                                                    <label
                                                        class="form-check-label small"
                                                        for="chk-{key}-{action}"
                                                    >
                                                        {array_descriptions_actions[
                                                            action
                                                        ] || action}
                                                    </label>
                                                </div>
                                            </td>
                                        {/each}
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
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

{#if showDeleteModal && rolesToDelete}
    <div class="modal-backdrop fade show"></div>
    <div class="modal show d-block" tabindex="-1">
        <div class="modal-dialog modal-sm modal-dialog-centered">
            <div class="modal-content border-0 shadow">
                <div class="modal-header bg-danger text-white border-0">
                    <h5 class="modal-title">Eliminar Rol</h5>
                    <button
                        type="button"
                        class="btn-close btn-close-white"
                        title="Cerrar"
                        on:click={() => (showDeleteModal = false)}
                    ></button>
                </div>
                <div class="modal-body text-center p-4">
                    <i class="fa fa-warning fa-3x text-danger mb-3"></i>
                    <p class="mb-0">
                        ¿Estás seguro de eliminar el rol <strong
                            >{rolesToDelete.description}</strong
                        >?
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
    .title-group {
        display: flex;
        flex-direction: column;
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

    /* Table Styles */
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
        border-color: #bac8f3;
        box-shadow: 0 0 0 2px rgba(78, 115, 223, 0.1);
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

    /* Modal support */
    :global(.modal-backdrop) {
        background-color: rgba(0, 0, 0, 0.5) !important;
    }

    /* Matrix Table Styles */
    .table-responsive {
        max-height: 500px;
        overflow-y: auto;
    }
    .table-sm td {
        padding: 0.75rem 0.5rem;
    }
    .table-dark {
        background-color: #1a202c !important;
        border-color: #1a202c !important;
    }
</style>
