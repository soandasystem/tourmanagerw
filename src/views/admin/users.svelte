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
    const CompanyId = String(userData.company);
    let currentCompanyId = String(userData.company);
    const rol = userData.rol_id;

    const getInitialForm = () => ({
        id: null,
        roles_id: "",
        username: "",
        name: "",
        email: "",
        phone: "",
        active: "1",
        company_id: String(CompanyId),
        password: "",
        author: author,
    });

    let usersForm = getInitialForm();

    let roles = [];

    let usersToDelete = null;

    // Lista de colegios obtenida desde la API
    let users = [];
    let empresas = [];
    // Formatear datos para Simple DataTable
    $: isUpdate = hasPermissionPrograms(rol, "users", "UPDATE");
    $: isDelete = hasPermissionPrograms(rol, "users", "DELETE");

    $: dtData = users.map((u) => {
        let acciones = `<div class="action-buttons-mini">`;
        if (isUpdate) {
            acciones += `<button class="btn-mini-custom edit" onclick="document.dispatchEvent(new CustomEvent('edit-user', {detail: ${u.id}}))" title="Editar">
                <i class="fa fa-pencil"></i>
            </button>`;
        }
        if (isDelete) {
            acciones += `<button class="btn-mini-custom delete" onclick="document.dispatchEvent(new CustomEvent('delete-user', {detail: ${u.id}}))" title="Eliminar">
                <i class="fa fa-trash"></i>
            </button>`;
        }
        acciones += `</div>`;
        return [
            u.username,
            u.name,
            u.rol.description,
            `<button class="btn-status-toggle ${u.active == 1 ? "active" : "inactive"}" 
        data-id="${u.id}" data-action="toggle-status" ${!isUpdate ? "disabled" : ""}>
        ${u.active == 1 ? "Activo" : "Inactivo"}
        </button>`,
            u.UpdateDate
                ? dayjs(u.UpdateDate).format("DD/MM/YYYY HH:mm")
                : "Reciente",
            u.author,
            acciones,
        ];
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
                placeholder: "Buscar usuarios...",
                perPage: "por página",
                noRows: "No se encontraron usuarios",
                info: "Mostrando {start} a {end} de {rows} usuarios",
                noResults: "No se encontraron usuarios",
            },
            data: {
                headings: [
                    "Usuario",
                    "Nombre",
                    "Perfil",
                    "Estado",
                    "Fecha Actualización",
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

    const fetchData = async () => {
        try {
            const [usersRes, regRes, comRes] = await Promise.all([
                api.getData(
                    "users",
                    "",
                    `company_id=${CompanyId}`,
                    "",
                    schemaName,
                ),
                api.getData("roles", "", "", "", schemaName),
                api.getData("company", "", `id=${CompanyId}`, "", "global"),
            ]);

            if (usersRes.status === "success")
                users = Array.isArray(usersRes.data) ? usersRes.data : [];
            if (regRes.status === "success")
                roles = Array.isArray(regRes.data) ? regRes.data : [];
            if (comRes.status === "success")
                empresas = Array.isArray(comRes.data) ? comRes.data : [];
            // El filtrado es ahora reactivo ($:)
        } catch (error) {
            console.error("Error al cargar datos:", error);
        }
    };

    onMount(() => {
        fetchData();
        document.addEventListener("edit-user", handleEdit);
        document.addEventListener("delete-user", handleDelete);
        document.addEventListener("click", handleTableClick);
    });

    onDestroy(() => {
        document.removeEventListener("edit-user", handleEdit);
        document.removeEventListener("delete-user", handleDelete);
        document.removeEventListener("click", handleTableClick);
    });

    async function handleEdit(event) {
        const usersid = event.detail;
        const data = await api.getData("users", "", "", usersid, schemaName);

        if (data.status === "success") {
            if (data.data) {
                usersForm = { ...data.data };
                if (usersForm.company_id)
                    usersForm.company_id = String(usersForm.company_id);
                if (usersForm.roles_id)
                    usersForm.roles_id = String(usersForm.roles_id);
                isEditing = true;
                viewMode = "form";
            }
        }
    }

    async function handleDelete(event) {
        console.log("Eliminando usuario:", event.detail);
        const usersid = event.detail;
        const data = await api.getData("users", "", "", usersid, schemaName);

        if (data.status === "success") {
            usersToDelete = data.data;
            showDeleteModal = true;
        }
    }

    function handleTableClick(e) {
        const target = e.target.closest("button");
        if (!target) return;
        const id = target.getAttribute("data-id");
        const action = target.getAttribute("data-action");
        if (!id || !action) return;
        if (action === "toggle-status") handleToggleStatus(id);
    }

    async function handleToggleStatus(usersid) {
        if (!isUpdate) return;

        // Obtenemos los datos completos primero para no sobreescribir con datos parciales
        const data = await api.getData("users", "", "", usersid, schemaName);
        if (data.status !== "success" || !data.data) {
            Swal.fire(
                "Error",
                "No se pudo obtener la información del usuario",
                "error",
            );
            return;
        }
        console.log("USUARIO A EDITAR", data.data);
        const user = data.data;
        const newStatus = Number(user.active) === 1 ? 2 : 1;

        const payload = {
            active: newStatus,
            author: author,
        };

        console.log("PAYLOAD", payload);
        try {
            const res = await api.updateData(
                "users",
                payload,
                "",
                usersid,
                schemaName,
            );
            console.log("RES", res);
            if (res.status === "success") {
                fetchData();
            } else {
                Swal.fire(
                    "Error",
                    res.message || "No se pudo cambiar el estado",
                    "error",
                );
            }
        } catch (error) {
            console.error("Error al cambiar estado:", error);
        }
    }
    async function confirmDelete() {
        if (!usersToDelete) {
            console.error("No hay usuario seleccionado para eliminar");
            return;
        }
        const data = await api.deleteData(
            "users",
            "",
            "",
            usersToDelete.id,
            schemaName,
        );

        if (data.status === "success") {
            Swal.fire(
                "Eliminado",
                "El usuario se eliminó correctamente.",
                "success",
            );
            showDeleteModal = false;
            fetchData();
        } else {
            Swal.fire(
                "Error",
                "Error al eliminar: " + (data.message || "Error desconocido"),
                "error",
            );
        }
    }

    function openCreateForm() {
        usersForm = getInitialForm();
        isEditing = false;
        viewMode = "form";
    }

    function returnToList() {
        viewMode = "list";
    }

    async function saveForm() {
        let data;
        const payload = {
            ...usersForm,
            roles_id: Number(usersForm.roles_id),
            active: Number(usersForm.active),
            author: author,
            company_id: Number(usersForm.company_id),
        };
        if (isEditing) {
            delete payload.password; // Opcional: solo enviar si se cambia
            data = await api.updateData(
                "users",
                payload,
                "",
                usersForm.id,
                schemaName,
            );
        } else {
            data = await api.setData("users", payload, "", "", schemaName);
        }

        if (data.status === "success") {
            Swal.fire(
                "Guardado",
                `El usuario se ha ${isEditing ? "actualizado" : "creado"} correctamente.`,
                "success",
            );
            fetchData();
            viewMode = "list";
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
                        <i class="fa fa-users icon-main text-primary"></i>
                        <h2 class="m-0">Gestión de Usuarios</h2>
                    </div>
                    <p class="subtitle mt-1 mb-0">
                        Administra las cuentas de usuario y sus permisos.
                    </p>
                </div>
                {#if hasPermissionPrograms(rol, "users", "INSERT")}
                    <button class="btn-new" on:click={openCreateForm}>
                        <i class="fa fa-plus"></i> Nuevo Usuario
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
                        {isEditing ? "Editar" : "Nuevo"} Usuario
                    </h2>
                </div>
                <button class="btn-back" on:click={returnToList}>
                    <i class="fa fa-arrow-left"></i> Volver al listado
                </button>
            </div>

            <div class="card-body p-4">
                <form on:submit|preventDefault={saveForm}>
                    <div class="section-title mb-4">Información de Perfil</div>
                    <div class="row g-2">
                        <div class="col-md-6">
                            <div class="form-group-custom">
                                <label for="roles_id">Perfil / Rol</label>
                                <select
                                    id="roles_id"
                                    class="form-select-custom"
                                    bind:value={usersForm.roles_id}
                                    required
                                >
                                    <option value="">Seleccionar</option>
                                    {#each roles as role}
                                        <option value={String(role.id)}
                                            >{role.description}</option
                                        >
                                    {/each}
                                </select>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group-custom">
                                <label for="company_id">Compañía</label>
                                <select
                                    id="company_id"
                                    class="form-select-custom"
                                    bind:value={usersForm.company_id}
                                    required
                                    disabled
                                >
                                    <option value="">Seleccionar</option>
                                    {#each empresas as empresa}
                                        <option value={String(empresa.id)}
                                            >{empresa.razonsocial}</option
                                        >
                                    {/each}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="section-title mb-4">Detalles del Usuario</div>
                    <div class="row g-2">
                        <div class="col-md-6">
                            <div class="form-group-custom">
                                <label for="username">Usuario (Login)</label>
                                <input
                                    type="text"
                                    id="username"
                                    class="form-control-custom"
                                    bind:value={usersForm.username}
                                    maxlength="12"
                                    required
                                    placeholder="Ej: jdoe"
                                />
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group-custom">
                                <label for="name">Nombre Completo</label>
                                <input
                                    type="text"
                                    id="name"
                                    class="form-control-custom"
                                    bind:value={usersForm.name}
                                    maxlength="100"
                                    required
                                    placeholder="Ej: Juan Pérez"
                                />
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group-custom">
                                <label for="email">Email</label>
                                <input
                                    type="email"
                                    id="email"
                                    class="form-control-custom"
                                    bind:value={usersForm.email}
                                    maxlength="100"
                                    required
                                    placeholder="email@ejemplo.com"
                                />
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group-custom">
                                <label for="phone">Fono / Teléfono</label>
                                <input
                                    type="text"
                                    id="phone"
                                    class="form-control-custom"
                                    bind:value={usersForm.phone}
                                    placeholder="+56 9 ..."
                                />
                            </div>
                        </div>
                    </div>

                    <div class="row g-4 mb-5">
                        <div class="col-md-6">
                            <div class="form-group-custom">
                                <label for="password"
                                    >{isEditing
                                        ? "Cambiar Clave (opcional)"
                                        : "Clave"}</label
                                >
                                <input
                                    type="password"
                                    id="password"
                                    class="form-control-custom"
                                    bind:value={usersForm.password}
                                    maxlength="10"
                                    required={!isEditing}
                                    placeholder="Min. 6 caracteres"
                                />
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div
                                class="d-flex align-items-center gap-3 mt-4 pt-2"
                            >
                                <label class="switch-container">
                                    <input
                                        class="form-check-input ms-0"
                                        type="checkbox"
                                        id="active_toggle"
                                        checked={usersForm.active === "1"}
                                        on:change={(e) =>
                                            (usersForm.active = e.currentTarget
                                                .checked
                                                ? "1"
                                                : "0")}
                                        style="width: 3em; height: 1.5em; cursor: pointer;"
                                    />
                                    <span class="slider round"></span>
                                </label>
                                <span class="fw-semibold text-muted"
                                    >¿Activar Usuario?</span
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
                            on:click={returnToList}
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
{#if showDeleteModal && usersToDelete}
    <div class="modal-backdrop fade show"></div>
    <div class="modal show d-block" tabindex="-1">
        <div class="modal-dialog modal-sm modal-dialog-centered">
            <div class="modal-content border-0 shadow">
                <div class="modal-header bg-danger text-white border-0">
                    <h5 class="modal-title">Eliminar Usuario</h5>
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
                        ¿Eliminar a <strong>{usersToDelete.name}</strong>?
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
    .btn-cancel:hover {
        background: #edf2f7;
    }

    /* Switch Style */
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
