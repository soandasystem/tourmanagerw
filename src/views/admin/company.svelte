<script>
    import { onMount, onDestroy } from "svelte";
    import { DataTable } from "simple-datatables";
    import "simple-datatables/dist/style.css";
    import api from "../../lib/apis.js";
    import { secureStorage } from "../../lib/secureStore";
    import dayjs from "dayjs";
    import Swal from "sweetalert2";
    import {
        formatRut,
        validateRut,
        formatPhone,
        validatePhone,
    } from "../../lib/utils";

    export let idcl = "";

    let viewMode = "list";
    let isEditing = false;
    let showDeleteModal = false;
    let activeTab = "general";

    const userData = secureStorage.getItem("_us_");
    const company_id = userData.company;

    // Configuración base (como en el PHP)
    const API_BASE =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api/v3.5";
    // usamos una ruta relativa para que Vite las sirva correctamente.
    const ROOT_URL = import.meta.env.DEV
        ? ""
        : API_BASE.split("/api/")[0] + "/";

    // El PHP determiana el code_company de cookies o session
    // Aquí podemos intentar obtenerlo de localStorage o usar el default o el prop idcl
    $: code_company = idcl || "GRL_999";

    const getInitialForm = () => ({
        id: null,
        rut: "",
        razonsocial: "",
        nomfantasia: "",
        email: "",
        website: "",
        direccion: "",
        region_id: 13,
        comuna_id: 45,
        rutreplegal: "",
        nomreplegal: "",
        active: "1",
        nombrecontacto1: "",
        emailcontacto1: "",
        fonocontacto1: "",
        nombrecontacto2: "",
        emailcontacto2: "",
        fonocontacto2: "",
    });

    let companyForm = getInitialForm();

    // Variables para archivos
    let logoFile = null;
    let contractGiraFile = null;
    let contractGrupalFile = null;
    let logoPreview = "/vite.svg"; // Placeholder inicial

    let errors = {};

    let companyToDelete = null;
    let companies = [];
    let regions = [];
    let comunas = [];

    // Lógica reactiva para filtrar comunas por región
    $: filteredComunas = (comunas || []).filter((c) => {
        const cRegId = Number(c.regions_id || c.region_id || c.id_region);
        const fRegId = Number(companyForm.region_id);
        return cRegId === fRegId && fRegId !== 0;
    });

    $: dtData = companies.map((p) => [
        p.rut || "-",
        p.razonsocial || "-",
        p.iniciooperacion ? dayjs(p.iniciooperacion).format("DD-MM-YYYY") : "-",
        `<button class="btn-status-toggle ${p.active == 1 ? "active" : "inactive"}" 
                 data-id="${p.id}" data-action="toggle-status"
                 title="Click para cambiar estado">
            ${p.active == 1 ? "Activo" : "Inactivo"}
        </button>`,
        p.updated_at ? dayjs(p.updated_at).format("DD-MM-YYYY HH:mm:ss") : "-",
        `<div class="action-buttons-mini">
            <button class="btn-mini-custom edit" data-id="${p.id}" data-action="edit-company" title="Editar">
                <i class="fa fa-pencil" style="pointer-events: none"></i>
            </button>
            <button class="btn-mini-custom delete" data-id="${p.id}" data-action="delete-company" title="Eliminar">
                <i class="fa fa-trash" style="pointer-events: none"></i>
            </button>
        </div>`,
    ]);

    let dataTableInstance = null;

    function initDataTable(node, dataConfig) {
        if (dataTableInstance) dataTableInstance.destroy();
        dataTableInstance = new DataTable(node, {
            searchable: true,
            perPage: 10,
            labels: {
                placeholder: "Buscar empresas...",
                perPage: "por página",
                noRows: "No se encontraron empresas",
                info: "Mostrando {start} a {end} de {rows} empresas",
                noResults: "No se encontraron empresas",
            },
            data: {
                headings: [
                    "Rut",
                    "Razón Social",
                    "Inicio Op.",
                    "Estado",
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

    const fetchData = async () => {
        try {
            const [compRes, regRes, comRes] = await Promise.all([
                api.getData("company", "", "", "", "global"),
                api.getData("region", "", "", "", "global"),
                api.getData("comunas", "", "", "", "global"),
            ]);
            if (compRes.status === "success") companies = compRes.data;
            if (regRes.status === "success") {
                regions = Array.isArray(regRes.data) ? regRes.data : [];
                console.log("Regiones cargadas:", regions.length);
            }
            if (comRes.status === "success") {
                const data = Array.isArray(comRes.data) ? comRes.data : [];
                console.log("Comunas cargadas:", data.length);
                // Asegurar que los IDs de comunas sean números y manejar variaciones de nombres
                comunas = data.map((c) => ({
                    ...c,
                    id: Number(c.id),
                    // Soportar múltiples variantes de nombre para el ID de región
                    regions_id: Number(
                        c.regions_id || c.region_id || c.id_region,
                    ),
                }));
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        }
    };

    function handleTableClick(e) {
        const target = e.target.closest("button");
        if (!target) return;
        const id = target.getAttribute("data-id");
        const action = target.getAttribute("data-action");
        if (!id || !action) return;
        if (action === "toggle-status") handleToggleStatus(id);
        if (action === "edit-company") handleEdit(id);
        if (action === "delete-company") handleDelete(id);
    }

    onMount(() => {
        fetchData();
        document.addEventListener("click", handleTableClick);
    });

    onDestroy(() => {
        document.removeEventListener("click", handleTableClick);
        if (dataTableInstance) dataTableInstance.destroy();
    });

    async function handleToggleStatus(id) {
        const company = companies.find((c) => c.id == id);
        if (!company) return;
        const newStatus = company.active == 1 ? 2 : 1;
        try {
            const res = await api.updateData(
                "company",
                { active: newStatus },
                "",
                id,
                "global",
            );
            if (res.status === "success") fetchData();
        } catch (error) {
            console.error(error);
        }
    }

    function handleEdit(id) {
        const company = companies.find((c) => c.id == id);
        if (company) {
            companyForm = { ...company };
            // Asegurar que los IDs sean números para que el bind:value funcione con los select
            companyForm.region_id = Number(companyForm.region_id);
            companyForm.comuna_id = Number(companyForm.comuna_id);

            isEditing = true;
            viewMode = "form";
            activeTab = "general";
            // Construir la ruta al logo usando el identificador de la empresa
            logoPreview = `${ROOT_URL}/upload/company/image_company/login_logo_${company.identificador}.png`;
        }
    }

    function handleDelete(id) {
        const company = companies.find((u) => u.id == id);
        if (company) {
            companyToDelete = company;
            showDeleteModal = true;
        }
    }

    async function confirmDelete() {
        if (!companyToDelete) return;
        try {
            const data = await api.deleteData(
                "company",
                "",
                "",
                companyToDelete.id,
                "global",
            );
            if (data.status === "success") {
                showDeleteModal = false;
                Swal.fire(
                    "Eliminado",
                    "La empresa ha sido eliminada con éxito.",
                    "success",
                );
                fetchData();
            } else {
                Swal.fire(
                    "Error",
                    "Error al eliminar: " + data.message,
                    "error",
                );
            }
        } catch (error) {
            console.error(error);
        }
    }

    function openCreateForm() {
        companyForm = getInitialForm();
        logoFile = null;
        contractGiraFile = null;
        contractGrupalFile = null;

        logoPreview = `${ROOT_URL}/upload/company/image_company/login_logo_${code_company}.png`;
        isEditing = false;
        viewMode = "form";
        activeTab = "general";
    }

    // Lógica de Archivos
    async function uploadLogo(file) {
        const formData = new FormData();
        formData.append("file", file);
        try {
            // Usar el servicio de upload apuntando a /api/v3.5/upload
            const res = await api.setData("upload", formData, "", "", "global");
            if (res.status !== "success") {
                Swal.fire(
                    "Error",
                    "Error al subir archivo: " + res.message,
                    "error",
                );
            } else {
                Swal.fire(
                    "Subido",
                    "El archivo se subio correctamente.",
                    "success",
                );
            }
        } catch (error) {
            Swal.fire("Error", "Error de red al subir archivo", "error");
        }
    }

    function handleFileChange(event, type) {
        const file = event.target.files[0];
        if (!file) return;

        if (type === "logo") {
            // Cambiar el nombre del archivo según la regla requerida
            const ext = file.name.substring(file.name.lastIndexOf("."));
            const identifier = companyForm.identificador || code_company;
            const newName = `login_log_${identifier}${ext}`;

            // Creamos un nuevo objeto File con el nombre modificado
            logoFile = new File([file], newName, { type: file.type });

            const reader = new FileReader();
            reader.onload = (e) => {
                if (typeof e.target?.result === "string") {
                    logoPreview = e.target.result;
                }
            };
            reader.readAsDataURL(logoFile);

            // Disparar la subida del logo inmediatamente al endpoint de Go
            uploadLogo(logoFile);
        } else if (type === "gira") {
            // Cambiar el nombre del archivo según la regla requerida
            const ext = file.name.substring(file.name.lastIndexOf("."));
            const identifier = companyForm.identificador || code_company;
            const newName = `contrato_ge_${identifier}${ext}`;

            // Creamos un nuevo objeto File con el nombre modificado
            logoFile = new File([file], newName, { type: file.type });

            const reader = new FileReader();
            reader.onload = (e) => {
                if (typeof e.target?.result === "string") {
                    logoPreview = e.target.result;
                }
            };
            reader.readAsDataURL(logoFile);

            // Disparar la subida del logo inmediatamente al endpoint de Go
            uploadLogo(logoFile);
            contractGiraFile = file;
        } else if (type === "grupal") {
            // Cambiar el nombre del archivo según la regla requerida
            const ext = file.name.substring(file.name.lastIndexOf("."));
            const identifier = companyForm.identificador || code_company;
            const newName = `contrato_vg_${identifier}${ext}`;

            // Creamos un nuevo objeto File con el nombre modificado
            logoFile = new File([file], newName, { type: file.type });

            const reader = new FileReader();
            reader.onload = (e) => {
                if (typeof e.target?.result === "string") {
                    logoPreview = e.target.result;
                }
            };
            reader.readAsDataURL(logoFile);

            // Disparar la subida del logo inmediatamente al endpoint de Go
            uploadLogo(logoFile);
        }
    }

    async function saveForm() {
        // Clonamos para no afectar el bind del formulario directamente si algo falla
        const payload = {
            ...companyForm,
            region_id: Number(companyForm.region_id || 0),
            comuna_id: Number(companyForm.comuna_id || 0),
            active: Number(companyForm.active),
        };

        const body = payload;

        try {
            let res;
            if (isEditing) {
                res = await api.updateData(
                    "company",
                    body,
                    "",
                    companyForm.id,
                    "global",
                );
            } else {
                res = await api.setData("company", body, "", "", "global");
            }

            if (res.status === "success") {
                Swal.fire(
                    "Guardado",
                    "La empresa se guardó correctamente.",
                    "success",
                );
                viewMode = "list";
                fetchData();
            } else {
                Swal.fire(
                    "Error",
                    "Error al guardar la empresa: " + res.message,
                    "error",
                );
            }
        } catch (error) {
            console.error(error);
            Swal.fire("Error", "Error crítico al guardar", "error");
        }
    }

    function handleRutInput(field, e) {
        const val = e.target.value;
        const formatted = formatRut(val);
        companyForm[field] = formatted;

        // Validar si el RUT es correcto (solo si tiene algo de largo)
        if (val.length > 5) {
            errors[field] = !validateRut(formatted);
        } else {
            errors[field] = false;
        }
    }
    function handlePhoneInput(field, e) {
        companyForm[field] = formatPhone(e.target.value);
    }
    function handleLogoError() {
        logoPreview = "/vite.svg";
    }
</script>

<div class="page-wrapper">
    {#if viewMode === "list"}
        <div class="card main-card shadow-sm border-0 mb-4">
            <div class="card-header-flex p-4">
                <div class="title-group">
                    <div class="title-with-icon">
                        <i class="fa fa-building-o icon-main text-primary"></i>
                        <h2 class="m-0">Gestión de Empresas</h2>
                    </div>
                    <p class="subtitle mt-1 mb-0">
                        Administra las empresas y clientes del sistema.
                    </p>
                </div>
                <button class="btn-new" on:click={openCreateForm}>
                    <i class="fa fa-plus"></i> Nueva Empresa
                </button>
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
                        {isEditing ? "Editar Empresa" : "Nueva Empresa"}
                    </h2>
                </div>
                <button class="btn-back" on:click={() => (viewMode = "list")}>
                    <i class="fa fa-arrow-left"></i> Volver al listado
                </button>
            </div>

            <div class="card-body p-4">
                <!-- Navigation Tabs -->
                <div class="custom-tabs-container mb-4">
                    <button
                        class="tab-btn {activeTab === 'general'
                            ? 'active'
                            : ''}"
                        on:click={() => (activeTab = "general")}
                    >
                        <i class="fa fa-info-circle"></i> General
                    </button>
                    <button
                        class="tab-btn {activeTab === 'contacto'
                            ? 'active'
                            : ''}"
                        on:click={() => (activeTab = "contacto")}
                    >
                        <i class="fa fa-user"></i> Contactos
                    </button>
                    <button
                        class="tab-btn {activeTab === 'contratogira'
                            ? 'active'
                            : ''}"
                        on:click={() => (activeTab = "contratogira")}
                    >
                        <i class="fa fa-file-text-o"></i> Contrato Giras
                    </button>
                    <button
                        class="tab-btn {activeTab === 'contratogrupal'
                            ? 'active'
                            : ''}"
                        on:click={() => (activeTab = "contratogrupal")}
                    >
                        <i class="fa fa-file-o"></i> Contrato Grupal
                    </button>
                    <button
                        class="tab-btn {activeTab === 'logo' ? 'active' : ''}"
                        on:click={() => (activeTab = "logo")}
                    >
                        <i class="fa fa-upload"></i> Subir Logo
                    </button>
                </div>

                <div class="tab-content-premium">
                    {#if activeTab === "general"}
                        <div class="section-title mb-4">
                            Información Corporativa
                        </div>
                        <div class="row g-3 mb-4">
                            <div class="col-md-3">
                                <div class="form-group-custom">
                                    <label for="rut">RUT Empresa</label>
                                    <input
                                        type="text"
                                        id="rut"
                                        class="form-control-custom {errors.rut
                                            ? 'is-invalid'
                                            : ''}"
                                        value={companyForm.rut}
                                        on:input={(e) =>
                                            handleRutInput("rut", e)}
                                        placeholder="12.345.678-9"
                                    />
                                    {#if errors.rut}
                                        <span class="error-text"
                                            >RUT inválido</span
                                        >
                                    {/if}
                                </div>
                            </div>
                            <div class="col-md-9">
                                <div class="form-group-custom">
                                    <label for="rsocial">Razón Social</label>
                                    <input
                                        type="text"
                                        id="rsocial"
                                        class="form-control-custom"
                                        bind:value={companyForm.razonsocial}
                                        placeholder="Nombre legal completo"
                                    />
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="form-group-custom">
                                    <label for="nfantasia"
                                        >Nombre Fantasía</label
                                    >
                                    <input
                                        type="text"
                                        id="nfantasia"
                                        class="form-control-custom"
                                        bind:value={companyForm.nomfantasia}
                                        placeholder="Nombre comercial"
                                    />
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="form-group-custom">
                                    <label for="email">Correo Corporativo</label
                                    >
                                    <input
                                        type="email"
                                        id="email"
                                        class="form-control-custom"
                                        bind:value={companyForm.email}
                                        placeholder="ejemplo@empresa.com"
                                    />
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="form-group-custom">
                                    <label for="website">Pagina Web</label>
                                    <input
                                        type="text"
                                        id="website"
                                        class="form-control-custom"
                                        bind:value={companyForm.website}
                                        placeholder="www.empresa.com"
                                    />
                                </div>
                            </div>
                        </div>

                        <div class="section-title mb-4">Ubicación y Legal</div>
                        <div class="row g-2">
                            <div class="col-md-6">
                                <div class="form-group-custom">
                                    <label for="direccion">Dirección</label>
                                    <input
                                        type="text"
                                        id="direccion"
                                        class="form-control-custom"
                                        bind:value={companyForm.direccion}
                                        placeholder="Calle 123, Oficina 45"
                                    />
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="form-group-custom">
                                    <label for="region">Región</label>
                                    <select
                                        id="region"
                                        class="form-select-custom"
                                        bind:value={companyForm.region_id}
                                        on:change={() => {
                                            companyForm.comuna_id = 0;
                                        }}
                                    >
                                        <option value=""
                                            >Seleccionar Región</option
                                        >
                                        {#each regions as region}
                                            <option value={Number(region.id)}
                                                >{region.description}</option
                                            >
                                        {/each}
                                    </select>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="form-group-custom">
                                    <label for="commune">Comuna</label>
                                    <select
                                        id="commune"
                                        class="form-select-custom"
                                        bind:value={companyForm.comuna_id}
                                    >
                                        <option value=""
                                            >Seleccionar Comuna</option
                                        >
                                        {#each filteredComunas as comuna}
                                            <option value={Number(comuna.id)}
                                                >{comuna.description}</option
                                            >
                                        {/each}
                                    </select>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="form-group-custom">
                                    <label for="rutreplegal"
                                        >RUT Representante</label
                                    >
                                    <input
                                        type="text"
                                        id="rutreplegal"
                                        class="form-control-custom {errors.rutreplegal
                                            ? 'is-invalid'
                                            : ''}"
                                        value={companyForm.rutreplegal}
                                        on:input={(e) =>
                                            handleRutInput("rutreplegal", e)}
                                    />
                                    {#if errors.rutreplegal}
                                        <span class="error-text"
                                            >RUT inválido</span
                                        >
                                    {/if}
                                </div>
                            </div>
                            <div class="col-md-8">
                                <div class="form-group-custom">
                                    <label for="nomreplegal"
                                        >Nombre Representante</label
                                    >
                                    <input
                                        type="text"
                                        id="nomreplegal"
                                        class="form-control-custom"
                                        bind:value={companyForm.nomreplegal}
                                    />
                                </div>
                            </div>
                        </div>
                        {#if company_id === 0}
                            <div class="col-md-4">
                                <div class="form-group-custom">
                                    <label for="rutreplegal"
                                        >Fecha Contrato</label
                                    >
                                    <input
                                        type="date"
                                        id="rutreplegal"
                                        class="form-control-custom"
                                        bind:value={companyForm.iniciooperacion}
                                    />
                                </div>
                            </div>
                            <div class="row mb-5">
                                <div class="col-md-12">
                                    <div
                                        class="d-flex align-items-center gap-3"
                                    >
                                        <label class="switch-container">
                                            <input
                                                class="form-check-input ms-0"
                                                type="checkbox"
                                                id="active_toggle"
                                                checked={companyForm.active ===
                                                    "1"}
                                                on:change={(e) =>
                                                    (companyForm.active = e
                                                        .currentTarget.checked
                                                        ? "1"
                                                        : "0")}
                                                style="width: 3em; height: 1.5em; cursor: pointer;"
                                            />
                                            <span class="slider round"></span>
                                        </label>
                                        <span class="fw-semibold text-muted"
                                            >¿Activar Empresa?</span
                                        >
                                    </div>
                                </div>
                            </div>
                        {/if}
                        <div class="section-title mb-4">
                            Identificador Connecciones
                        </div>
                        <div class="row g-2">
                            <div class="col-md-6">
                                <div class="form-group-custom">
                                    <label for="identificador"
                                        >Identificador</label
                                    >
                                    <input
                                        type="text"
                                        id="identificador"
                                        class="form-control-custom"
                                        bind:value={companyForm.identificador}
                                        readonly
                                    />
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="form-group-custom">
                                    <label for="urlconnecxion"
                                        >Url Conneccion</label
                                    >
                                    <input
                                        type="text"
                                        id="urlconnecxion"
                                        class="form-control-custom bg-light"
                                        readonly
                                        value={`https://www.tourmanager.cl/${companyForm.identificador || ""}`}
                                    />
                                </div>
                            </div>
                        </div>
                    {:else if activeTab === "contacto"}
                        <div class="row g-2">
                            <div class="col-md-6">
                                <div
                                    class="contact-box p-4 border rounded-3 bg-white h-100"
                                >
                                    <div class="section-title mb-3">
                                        Contacto Principal
                                    </div>
                                    <div class="form-group-custom mb-3">
                                        <label for="c1_nom">Nombre</label>
                                        <input
                                            type="text"
                                            id="c1_nom"
                                            class="form-control-custom"
                                            bind:value={
                                                companyForm.nombrecontacto1
                                            }
                                        />
                                    </div>
                                    <div class="form-group-custom mb-3">
                                        <label for="c1_email">Email</label>
                                        <input
                                            type="email"
                                            id="c1_email"
                                            class="form-control-custom"
                                            bind:value={
                                                companyForm.emailcontacto1
                                            }
                                        />
                                    </div>
                                    <div class="form-group-custom">
                                        <label for="c1_fono">Teléfono</label>
                                        <input
                                            type="text"
                                            class="form-control {companyForm.fonocontacto1 &&
                                            !validatePhone(
                                                companyForm.fonocontacto1,
                                            )
                                                ? 'is-invalid'
                                                : ''}"
                                            id="c1_fono"
                                            value={companyForm.fonocontacto1}
                                            on:input={(e) =>
                                                handlePhoneInput(
                                                    "fonocontacto1",
                                                    e,
                                                )}
                                            maxlength="14"
                                        />
                                        {#if companyForm.fonocontacto1 && !validatePhone(companyForm.fonocontacto1)}
                                            <div class="invalid-feedback">
                                                Fono inválido (+56 9...)
                                            </div>
                                        {/if}
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div
                                    class="contact-box p-4 border rounded-3 bg-white h-100"
                                >
                                    <div class="section-title mb-3">
                                        Contacto Secundario
                                    </div>
                                    <div class="form-group-custom mb-3">
                                        <label for="c2_nom">Nombre</label>
                                        <input
                                            type="text"
                                            id="c2_nom"
                                            class="form-control-custom"
                                            value={companyForm.nombrecontacto2}
                                            on:input={(e) =>
                                                handlePhoneInput(
                                                    "nombrecontacto2",
                                                    e,
                                                )}
                                            maxlength="14"
                                        />
                                        {#if companyForm.nombrecontacto2 && !validatePhone(companyForm.nombrecontacto2)}
                                            <div class="invalid-feedback">
                                                Fono inválido (+56 9...)
                                            </div>
                                        {/if}
                                    </div>
                                    <div class="form-group-custom mb-3">
                                        <label for="c2_email">Email</label>
                                        <input
                                            type="email"
                                            id="c2_email"
                                            class="form-control-custom"
                                            bind:value={
                                                companyForm.emailcontacto2
                                            }
                                        />
                                    </div>
                                    <div class="form-group-custom">
                                        <label for="c2_fono">Teléfono</label>
                                        <input
                                            type="text"
                                            id="c2_fono"
                                            class="form-control-custom"
                                            bind:value={
                                                companyForm.fonocontacto2
                                            }
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    {:else if activeTab === "contratogira"}
                        <div
                            class="file-upload-section p-5 border-dashed rounded-3 text-center bg-white"
                        >
                            <i class="fa fa-file-pdf-o fa-4x text-muted mb-4"
                            ></i>
                            <div
                                class="section-title mb-3 justify-content-center"
                            >
                                Contrato Gira de Estudios
                            </div>
                            <p class="text-muted mb-4 small">
                                Sube el documento de términos y condiciones para
                                giras. <br />Formatos aceptados: PDF, DOCX.
                            </p>
                            <div class="mt-4">
                                <label
                                    for="file_gira"
                                    class="btn btn-outline-primary px-4 py-2"
                                >
                                    <i class="fa fa-folder-open-o me-2"></i> Seleccionar
                                    Archivo
                                </label>
                                <input
                                    type="file"
                                    id="file_gira"
                                    class="d-none"
                                    on:change={(e) =>
                                        handleFileChange(e, "gira")}
                                />
                            </div>
                            {#if contractGiraFile}
                                <div class="mt-3 text-success fw-bold small">
                                    <i class="fa fa-check"></i>
                                    {contractGiraFile.name}
                                </div>
                            {/if}
                        </div>
                    {:else if activeTab === "contratogrupal"}
                        <div
                            class="file-upload-section p-5 border-dashed rounded-3 text-center bg-white"
                        >
                            <i class="fa fa-files-o fa-4x text-muted mb-4"></i>
                            <div
                                class="section-title mb-3 justify-content-center"
                            >
                                Contrato Comercial Grupal
                            </div>
                            <p class="text-muted mb-4 small">
                                Sube el documento de términos y condiciones para
                                ventas grupales.
                            </p>
                            <div class="mt-4">
                                <label
                                    for="file_grupal"
                                    class="btn btn-outline-primary px-4 py-2"
                                >
                                    <i class="fa fa-folder-open-o me-2"></i> Seleccionar
                                    Archivo
                                </label>
                                <input
                                    type="file"
                                    id="file_grupal"
                                    class="d-none"
                                    on:change={(e) =>
                                        handleFileChange(e, "grupal")}
                                />
                            </div>
                            {#if contractGrupalFile}
                                <div class="mt-3 text-success fw-bold small">
                                    <i class="fa fa-check"></i>
                                    {contractGrupalFile.name}
                                </div>
                            {/if}
                        </div>
                    {:else if activeTab === "logo"}
                        <div class="row align-items-center g-5">
                            <div class="col-md-5">
                                <div
                                    class="logo-preview-box border rounded-4 bg-white shadow-sm d-flex align-items-center justify-content-center overflow-hidden"
                                    style="height: 300px;"
                                >
                                    <img
                                        src={logoPreview}
                                        alt="Logo Preview"
                                        class="img-fluid p-4"
                                        style="max-height: 100%; transition: opacity 0.3s"
                                        on:error={handleLogoError}
                                    />
                                </div>
                            </div>
                            <div class="col-md-7">
                                <div class="section-title mb-3">
                                    Identidad de Marca
                                </div>
                                <p class="text-muted mb-4">
                                    El logo cargado se utilizará en los
                                    reportes, correos y en la interfaz de
                                    usuario para personalizar la experiencia de
                                    este cliente.
                                </p>
                                <div class="form-group-custom">
                                    <label
                                        for="file_logo"
                                        class="btn btn-outline-primary d-inline-block px-4 py-2 cursor-pointer"
                                    >
                                        <i class="fa fa-upload me-2"></i> Seleccionar
                                        Imagen
                                    </label>
                                    <input
                                        type="file"
                                        id="file_logo"
                                        class="d-none"
                                        accept="image/*"
                                        on:change={(e) =>
                                            handleFileChange(e, "logo")}
                                    />
                                    <div class="mt-2 text-muted small">
                                        JPG, PNG o SVG. Recomendado: 400x400px o
                                        superior.
                                    </div>
                                </div>
                            </div>
                        </div>
                    {/if}
                </div>

                <div class="form-actions border-top pt-4">
                    <button class="btn btn-save" on:click={saveForm}>
                        <i class="fa fa-save"></i> Guardar
                    </button>
                    <button
                        class="btn btn-cancel"
                        on:click={() => (viewMode = "list")}
                    >
                        <i class="fa fa-chevron-left"></i> Cancelar y Volver
                    </button>
                </div>
            </div>
        </div>
    {/if}
</div>

{#if showDeleteModal && companyToDelete}
    <div class="modal-backdrop fade show"></div>
    <div class="modal show d-block" tabindex="-1">
        <div class="modal-dialog modal-sm modal-dialog-centered">
            <div class="modal-content border-0 shadow-lg">
                <div class="modal-header bg-danger text-white border-0">
                    <h5 class="modal-title">Confirmar Eliminación</h5>
                    <button
                        type="button"
                        title="Cerrar"
                        class="btn-close btn-close-white"
                        on:click={() => (showDeleteModal = false)}
                    ></button>
                </div>
                <div class="modal-body text-center p-4">
                    <i class="fa fa-trash-o fa-3x text-danger mb-3"></i>
                    <p class="mb-0">
                        ¿Estás seguro de eliminar permanentemente a <br
                        /><strong>{companyToDelete.razonsocial}</strong>?
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
                        on:click={confirmDelete}>Sí, Eliminar</button
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

    /* Buttons */
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

    /* Tabs */
    .custom-tabs-container {
        display: flex;
        gap: 2px;
        border-bottom: 1px solid #dee2e6;
        margin-bottom: 25px;
    }
    .tab-btn {
        background: #f8f9fc;
        border: 1px solid #dee2e6;
        border-bottom: none;
        padding: 8px 16px;
        color: #4e73df;
        font-weight: 500;
        font-size: 0.85rem;
        border-radius: 4px 4px 0 0;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: -1px;
    }
    .tab-btn i {
        font-size: 0.9rem;
    }
    .tab-btn:hover {
        background: #eaecf4;
        color: #2e59d9;
    }
    .tab-btn.active {
        background: white;
        color: #333;
        border-top: 2px solid #4e73df;
        border-left: 1px solid #dee2e6;
        border-right: 1px solid #dee2e6;
        border-bottom: 1px solid white;
        font-weight: 700;
    }

    /* Form Elements */
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
    .form-control-custom[readonly] {
        background-color: #f8f9fc;
        cursor: not-allowed;
    }
    .form-control-custom:focus {
        outline: none;
        border-color: #bac8f3;
        box-shadow: 0 0 0 2px rgba(78, 115, 223, 0.1);
    }
    .border-dashed {
        border: 2px dashed #e3e6f0;
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

    /* Modal Styling */
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
        overflow-x: auto;
    }
    :global(.dataTable-table) {
        width: 100% !important;
        white-space: nowrap !important;
    }
    :global(.dataTable-table th),
    :global(.dataTable-table td),
    :global(.dataTable-table a) {
        white-space: nowrap !important;
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
    .error-text {
        color: #e74a3b;
        font-size: 0.75rem;
        margin-top: 4px;
        font-weight: 600;
    }
    :global(.is-invalid) {
        border-color: #e74a3b !important;
    }
</style>
