<script>
    import { onMount, onDestroy } from "svelte";
    import { DataTable } from "simple-datatables";
    import "simple-datatables/dist/style.css";
    import { secureStorage } from "../../lib/secureStore";
    import { tenantStore } from "../../stores/tenant";
    import dayjs from "dayjs";
    import api from "../../lib/apis.js";
    import Swal from "sweetalert2";
    import { hasPermissionPrograms } from "../../lib/utils";
    import MedicalRecordPdf from "../generate_pdf/medicalrecord_pdf.svelte";
    import {
        formatRut,
        formatCurrency,
        validateRut,
        formatPhone,
        validatePhone,
    } from "../../lib/utils";

    let viewMode = "list";
    let isEditing = false;
    let showDeleteModal = false;
    let itemIdToDelete = null;
    let activeTab = "tab1";
    let showMedicalPdf = false;
    let selectedPdfCursoId = null;
    let selectedPdfSaleId = null;

    $: idcl = $tenantStore;
    const userData = secureStorage.getItem("_us_") || {};
    const schemaName = userData.schema || "";
    const author = userData.username || "";
    const currentCompanyId = userData.company || 0;
    const rol = userData.rol_id || 0;

    const getInitialForm = () => ({
        id: null,
        sale_id: 0,
        rutalumno: "",
        nombrealumno: "",
        fechanac: dayjs().format("YYYY-MM-DD"),
        rutapod: "",
        nombreapod: "",
        dircalle: "",
        dirnumero: "",
        nrodepto: "",
        region_id: 13,
        comuna_id: 45,
        fono: "",
        celular: "",
        correo: "",
        vpagar: 0,
        descto: 0,
        apagar: 0,
        estador: "A",
        password: "",
        acepta_contrato: 0,
        signature: "",
        author: author,
        company_id: currentCompanyId,
        liberado: 0,
        enviado: "",
        pasaporte: "",
    });

    let courseForm = getInitialForm();
    let errors = {};

    /** @type {any[]} */
    let regions = [];
    /** @type {any[]} */
    let comunas = [];

    let courseToDelete = null;

    /** @type {any[]} */
    let courses = [];
    /** @type {any[]} */
    let sales = [];

    // Formatear datos para Simple DataTable
    $: isUpdate = hasPermissionPrograms(rol, "course", "UPDATE");
    $: isDelete = hasPermissionPrograms(rol, "course", "DELETE");

    // Lógica reactiva para filtrar comunas por región
    $: filteredComunas = (comunas || []).filter((c) => {
        const cRegId = Number(c.regions_id || c.region_id || c.id_region || 0);
        const fRegId = Number(courseForm.region_id || 0);
        return cRegId === fRegId;
    });

    $: dtData = courses.map((c) => {
        let acciones = `<div class="action-buttons-mini">`;
        if (isUpdate) {
            acciones += `<button class="btn-mini-custom edit" onclick="document.dispatchEvent(new CustomEvent('edit-curso', {detail: ${c.id}}))" title="Editar">
                <i class="fa fa-pencil"></i>
            </button>`;
        }
        if (isDelete) {
            acciones += `<button class="btn-mini-custom delete" onclick="document.dispatchEvent(new CustomEvent('delete-curso', {detail: ${c.id}}))" title="Eliminar">
                <i class="fa fa-trash"></i>
            </button>`;
        }
        acciones += `</div>`;

        let acepta =
            c.acepta_contrato == "1"
                ? '<span class="badge bg-success-soft text-success"><i class="fa fa-check-circle me-1"></i> SI</span>'
                : '<span class="badge bg-danger-soft text-danger"><i class="fa fa-times-circle me-1"></i> NO</span>';
        /*
        let ficha = c.signature
            ? '<span class="badge bg-success-soft text-success"><i class="fa fa-check-circle me-1"></i> SI</span>'
            : '<span class="badge bg-danger-soft text-danger"><i class="fa fa-times-circle me-1"></i> NO</span>';
*/
        let enviocorreo =
            c.enviado == "1"
                ? '<span class="badge bg-success-soft text-success"><i class="fa fa-envelope me-1"></i> SI</span>'
                : '<span class="badge bg-danger-soft text-danger"><i class="fa fa-envelope-o me-1"></i> NO</span>';

        let ficha = `<button class="btn-mini-custom info" onclick="document.dispatchEvent(new CustomEvent('generate-medical-pdf', {detail: {id: ${c.id}, sale_id: ${c.sale_id}}}))" title="PDF Ficha Médica">
            <i class="fa fa-file-pdf-o"></i>
        </button>`;

        return [
            c.sale_id,
            c.rutalumno,
            c.nombrealumno,
            c.rutapod,
            c.nombreapod,
            c.celular,
            c.correo,
            formatCurrency(c.vpagar),
            c.descto,
            formatCurrency(c.apagar),
            acepta,
            ficha,
            enviocorreo,
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
                placeholder: "Buscar pasajeros...",
                perPage: "por página",
                noRows: "No se encontraron pasajeros",
                info: "Mostrando {start} a {end} de {rows} registros",
                noResults: "No se encontraron pasajeros",
            },
            data: {
                headings: [
                    "Numero Venta",
                    "Rut Alumno",
                    "Nombre Alumno",
                    "Rut Apoderado",
                    "Nombre Apoderado",
                    "Celular",
                    "Email",
                    "Valor",
                    "Descto",
                    "A Pagar",
                    "Contrato",
                    "Ficha Medica",
                    "Correo",
                    "Accion",
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
            console.log("DEBUG - Iniciando carga de datos:");
            console.log("- Schema:", schemaName);
            console.log("- CompanyID:", currentCompanyId);

            const [coursesRes, regRes, comRes, salesRes] = await Promise.all([
                api.getData(
                    "curso",
                    "",
                    "company_id=" + currentCompanyId,
                    "",
                    schemaName,
                ),
                api.getData("region", "", "", "", "global"),
                api.getData("comunas", "", "", "", "global"),
                api.getData(
                    "sale/informe",
                    "",
                    "company_id=" + currentCompanyId + "&state=V",
                    "",
                    schemaName,
                ),
            ]);

            if (coursesRes.status === "success")
                courses = Array.isArray(coursesRes.data) ? coursesRes.data : [];
            if (regRes.status === "success") {
                regions = Array.isArray(regRes.data) ? regRes.data : [];
                console.log("Regiones cargadas:", regions.length);
            }
            if (comRes.status === "success") {
                comunas = Array.isArray(comRes.data) ? comRes.data : [];
                console.log("Comunas cargadas:", comunas.length);
            }
            if (salesRes.status === "success") {
                sales = Array.isArray(salesRes.data) ? salesRes.data : [];
                console.log("Ventas cargadas:", sales.length);
            } else {
                console.error("Error al cargar ventas:", salesRes.message);
            }

            // El filtrado es ahora reactivo ($:)
        } catch (error) {
            console.error("Error al cargar datos:", error);
        }
    };

    // El filtrado es ahora reactivo arriba ($: filteredComunas)

    // Actualizar valores automáticamente al seleccionar una venta
    $: if (courseForm.sale_id && courseForm.sale_id != 0) {
        const selectedSale = sales.find((s) => s.id == courseForm.sale_id);
        if (selectedSale) {
            // Si es nuevo o no tiene valores, cargamos los de la venta
            if (!courseForm.id) {
                courseForm.vpagar = selectedSale.vprograma || 0;
                courseForm.descto = 0;
            }
        }
    }

    // Cálculo reactivo del total a pagar considerando si es liberado
    $: if (courseForm.liberado == "1") {
        courseForm.apagar = 0;
    } else {
        courseForm.apagar = courseForm.vpagar - courseForm.descto;
    }

    onMount(() => {
        console.log("Course module mounted");
        fetchData();
        document.addEventListener("edit-curso", handleEdit);
        document.addEventListener("delete-curso", handleDelete);
        document.addEventListener(
            "generate-medical-pdf",
            handleGenerateMedicalPdf,
        );
    });

    onDestroy(() => {
        document.removeEventListener("edit-curso", handleEdit);
        document.removeEventListener("delete-curso", handleDelete);
        document.removeEventListener(
            "generate-medical-pdf",
            handleGenerateMedicalPdf,
        );
    });
    function handleGenerateMedicalPdf(event) {
        selectedPdfCursoId = event.detail.id;
        selectedPdfSaleId = event.detail.sale_id;
        showMedicalPdf = true;
    }
    async function handleEdit(event) {
        const projectid = event.detail;
        const data = await api.getData("curso", "", "", projectid, schemaName);

        if (data.status === "success") {
            if (data.data) {
                courseForm = { ...data.data };
                // Asegurar tipos numéricos para los selectores
                courseForm.region_id = Number(courseForm.region_id || 0);
                courseForm.comuna_id = Number(courseForm.comuna_id || 0);
                courseForm.sale_id = String(courseForm.sale_id || "0");

                if (courseForm.fechanac) {
                    courseForm.fechanac = courseForm.fechanac.split("T")[0];
                }
                isEditing = true;
                viewMode = "form";
            }
        }
    }

    async function handleDelete(event) {
        console.log("Eliminando curso:", event.detail);
        const projectid = event.detail;
        const data = await api.getData("curso", "", "", projectid, schemaName);

        if (data.status === "success") {
            courseToDelete = data.data;
            showDeleteModal = true;
        }
    }
    async function confirmDelete() {
        if (!courseToDelete) {
            console.error("No hay pasajeros seleccionado para eliminar");
            return;
        }
        const data = await api.deleteData(
            "curso",
            "",
            "",
            courseToDelete.id,
            schemaName,
        );

        if (data.status === "success") {
            Swal.fire(
                "Eliminado",
                "El pasajero se eliminó correctamente.",
                "success",
            );
            showDeleteModal = false;
            fetchData();
        } else {
            Swal.fire("Error", "Error al eliminar: " + data.message, "error");
        }
    }

    function openCreateForm() {
        courseForm = getInitialForm();
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
            const company_id = userData.company;
            courseForm.company_id = company_id;
            courseForm.fechanac = courseForm.fechanac + "T00:00:00Z";
            courseForm.sale_id = Number(courseForm.sale_id);
            courseForm.region_id = Number(courseForm.region_id);
            courseForm.comuna_id = Number(courseForm.comuna_id);
            const jsonData = JSON.stringify(courseForm);
            data = await api.updateData(
                "curso",
                jsonData,
                "",
                courseForm.id,
                schemaName,
            );
        } else {
            const company_id = userData.company;
            courseForm.company_id = company_id;
            courseForm.fechanac = courseForm.fechanac + "T00:00:00Z";
            courseForm.sale_id = Number(courseForm.sale_id);
            courseForm.region_id = Number(courseForm.region_id);
            courseForm.comuna_id = Number(courseForm.comuna_id);
            const jsonData = JSON.stringify(courseForm);
            data = await api.setData("curso", jsonData, "", "", schemaName);
        }
        if (data.status === "success") {
            Swal.fire(
                "Guardado",
                "El pasajero se guardó correctamente.",
                "success",
            );
            viewMode = "list";
            activeTab = "tab1";
            fetchData();
        } else {
            Swal.fire("Error", data.message, "error");
        }
    }

    function handleRutInput(field, e) {
        const val = e.target.value;
        const formatted = formatRut(val);
        courseForm[field] = formatted;

        if (val.length > 5) {
            errors[field] = !validateRut(formatted);
        } else {
            errors[field] = false;
        }
    }

    function handlePhoneInput(field, e) {
        const val = e.target.value;
        const formatted = formatPhone(val);
        courseForm[field] = formatted;

        if (val.length > 4) {
            errors[field] = !validatePhone(formatted);
        } else {
            errors[field] = false;
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
                        <h2 class="m-0">Gestión de Pasajeros</h2>
                    </div>
                    <p class="subtitle mt-1 mb-0">
                        Administra los pasajeros, sus datos y valores.
                    </p>
                </div>
                {#if hasPermissionPrograms(rol, "course", "INSERT")}
                    <button class="btn-new" on:click={openCreateForm}>
                        <i class="fa fa-plus"></i> Nuevo Pasajero
                    </button>
                {/if}
            </div>
            <div class="table-container p-3 pt-0 overflow-auto">
                {#key dtData}
                    <table
                        use:initDataTable={dtData}
                        class="table table-hover w-100"
                    ></table>
                {/key}
            </div>
        </div>
    {:else}
        <div class="card main-card shadow-sm border-0 mb-4">
            <div class="card-header-flex p-4 border-bottom">
                <div class="title-with-icon">
                    <i
                        class="fa {isEditing
                            ? 'fa-pencil'
                            : 'fa-plus'} icon-main text-primary"
                    ></i>
                    <h2 class="m-0">
                        {isEditing ? "Editar" : "Nuevo"} Pasajero
                    </h2>
                </div>
                <button class="btn-back" on:click={returnToList}>
                    <i class="fa fa-arrow-left"></i> Volver
                </button>
            </div>

            <div class="card-body p-4">
                <form on:submit|preventDefault={saveForm}>
                    <ul class="nav nav-tabs-custom mb-4">
                        <li class="nav-item">
                            <button
                                type="button"
                                class="nav-link {activeTab === 'tab1'
                                    ? 'active'
                                    : ''}"
                                on:click={() => (activeTab = "tab1")}
                            >
                                <i class="fa fa-info-circle me-2"></i> Pasajero
                            </button>
                        </li>
                        <li class="nav-item">
                            <button
                                type="button"
                                class="nav-link {activeTab === 'tab2'
                                    ? 'active'
                                    : ''}"
                                on:click={() => (activeTab = "tab2")}
                            >
                                <i class="fa fa-map-marker me-2"></i> Dirección
                            </button>
                        </li>
                        <li class="nav-item">
                            <button
                                type="button"
                                class="nav-link {activeTab === 'tab3'
                                    ? 'active'
                                    : ''}"
                                on:click={() => (activeTab = "tab3")}
                            >
                                <i class="fa fa-dollar me-2"></i> Valores
                            </button>
                        </li>
                    </ul>

                    <div class="tab-content mt-4">
                        {#if activeTab === "tab1"}
                            <div class="tab-pane active">
                                <div class="row g-3 mb-4">
                                    <div class="col-md-4">
                                        <div class="form-group-custom">
                                            <label for="sale_id">Venta</label>
                                            <select
                                                id="sale_id"
                                                class="form-select-custom"
                                                bind:value={courseForm.sale_id}
                                                required
                                                disabled={isEditing}
                                            >
                                                <option value="0"
                                                    >Seleccionar</option
                                                >
                                                {#each sales as sale}
                                                    <option value={sale.id}>
                                                        {sale.establecimiento_nombre ||
                                                            "N/A"} / {sale.curso}-{sale.idcurso}
                                                    </option>
                                                {/each}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div class="row g-3 mb-3">
                                    <div class="col-md-3">
                                        <div class="form-group-custom">
                                            <label for="rutalumno"
                                                >Rut Alumno</label
                                            >
                                            <input
                                                type="text"
                                                id="rutalumno"
                                                class="form-control-custom {errors.rutalumno
                                                    ? 'is-invalid'
                                                    : ''}"
                                                value={courseForm.rutalumno}
                                                on:input={(e) =>
                                                    handleRutInput(
                                                        "rutalumno",
                                                        e,
                                                    )}
                                                placeholder="12.345.678-9"
                                                required
                                            />
                                            {#if errors.rutalumno}
                                                <span class="error-text"
                                                    >RUT inválido</span
                                                >
                                            {/if}
                                        </div>
                                    </div>
                                    <div class="col-md-3">
                                        <div class="form-group-custom">
                                            <label for="pasaporte"
                                                >Pasaporte Alumno</label
                                            >
                                            <input
                                                type="text"
                                                id="pasaporte"
                                                class="form-control-custom"
                                                bind:value={
                                                    courseForm.pasaporte
                                                }
                                            />
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="form-group-custom">
                                            <label for="nombrealumno"
                                                >Nombre Alumno</label
                                            >
                                            <input
                                                type="text"
                                                id="nombrealumno"
                                                class="form-control-custom"
                                                bind:value={
                                                    courseForm.nombrealumno
                                                }
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div class="row g-3 mb-3">
                                    <div class="col-md-2">
                                        <div class="form-group-custom">
                                            <label for="fechanac"
                                                >Fecha Nacimiento</label
                                            >
                                            <input
                                                type="date"
                                                id="fechanac"
                                                class="form-control-custom"
                                                bind:value={courseForm.fechanac}
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div class="row g-3 mb-3 mt-2">
                                    <div class="col-md-3">
                                        <div class="form-group-custom">
                                            <label for="rutapod"
                                                >Rut Apoderado</label
                                            >
                                            <input
                                                type="text"
                                                id="rutapod"
                                                class="form-control-custom {errors.rutapod
                                                    ? 'is-invalid'
                                                    : ''}"
                                                value={courseForm.rutapod}
                                                on:input={(e) =>
                                                    handleRutInput(
                                                        "rutapod",
                                                        e,
                                                    )}
                                                placeholder="12.345.678-9"
                                                required
                                            />
                                            {#if errors.rutapod}
                                                <span class="error-text"
                                                    >RUT inválido</span
                                                >
                                            {/if}
                                        </div>
                                    </div>
                                    <div class="col-md-9">
                                        <div class="form-group-custom">
                                            <label for="nombreapod"
                                                >Nombre Apoderado</label
                                            >
                                            <input
                                                type="text"
                                                id="nombreapod"
                                                class="form-control-custom"
                                                bind:value={
                                                    courseForm.nombreapod
                                                }
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        {:else if activeTab === "tab2"}
                            <div class="tab-pane active">
                                <div class="row g-3 mb-3">
                                    <div class="col-md-6">
                                        <div class="form-group-custom">
                                            <label for="dircalle">Calle</label>
                                            <input
                                                type="text"
                                                id="dircalle"
                                                class="form-control-custom"
                                                bind:value={courseForm.dircalle}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div class="col-md-3">
                                        <div class="form-group-custom">
                                            <label for="dirnumero">Número</label
                                            >
                                            <input
                                                type="text"
                                                id="dirnumero"
                                                class="form-control-custom"
                                                bind:value={
                                                    courseForm.dirnumero
                                                }
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div class="col-md-3">
                                        <div class="form-group-custom">
                                            <label for="nrodepto">Depto</label>
                                            <input
                                                type="text"
                                                id="nrodepto"
                                                class="form-control-custom"
                                                bind:value={courseForm.nrodepto}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div class="row g-3 mb-3">
                                    <div class="col-md-6">
                                        <div class="form-group-custom">
                                            <label for="region_id">Región</label
                                            >
                                            <select
                                                id="region_id"
                                                class="form-select-custom"
                                                bind:value={
                                                    courseForm.region_id
                                                }
                                                on:change={() => {
                                                    courseForm.comuna_id = "";
                                                }}
                                            >
                                                <option value=""
                                                    >Seleccionar Región</option
                                                >
                                                {#each regions as region}
                                                    <option
                                                        value={Number(
                                                            region.id,
                                                        )}
                                                        >{region.description}</option
                                                    >
                                                {/each}
                                            </select>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="form-group-custom">
                                            <label for="comuna_id">Comuna</label
                                            >
                                            <select
                                                id="comuna_id"
                                                class="form-select-custom"
                                                bind:value={
                                                    courseForm.comuna_id
                                                }
                                            >
                                                <option value=""
                                                    >Seleccionar Comuna</option
                                                >
                                                {#each filteredComunas as comuna}
                                                    <option
                                                        value={Number(
                                                            comuna.id,
                                                        )}
                                                        >{comuna.description}</option
                                                    >
                                                {/each}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div class="row g-3 mb-3">
                                    <div class="col-md-3">
                                        <div class="form-group-custom">
                                            <label for="fono">Fono</label>
                                            <input
                                                type="text"
                                                id="fono"
                                                class="form-control-custom {errors.fono
                                                    ? 'is-invalid'
                                                    : ''}"
                                                value={courseForm.fono}
                                                on:input={(e) =>
                                                    handlePhoneInput("fono", e)}
                                                placeholder="+56 9 1234 5678"
                                                required
                                            />
                                            {#if errors.fono}
                                                <span class="error-text"
                                                    >Teléfono inválido</span
                                                >
                                            {/if}
                                        </div>
                                    </div>
                                    <div class="col-md-3">
                                        <div class="form-group-custom">
                                            <label for="celular">Celular</label>
                                            <input
                                                type="text"
                                                id="celular"
                                                class="form-control-custom {errors.celular
                                                    ? 'is-invalid'
                                                    : ''}"
                                                value={courseForm.celular}
                                                on:input={(e) =>
                                                    handlePhoneInput(
                                                        "celular",
                                                        e,
                                                    )}
                                                placeholder="+56 9 1234 5678"
                                            />
                                            {#if errors.celular}
                                                <span class="error-text"
                                                    >Celular inválido</span
                                                >
                                            {/if}
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="form-group-custom">
                                            <label for="correo">Correo</label>
                                            <input
                                                type="email"
                                                id="correo"
                                                class="form-control-custom"
                                                bind:value={courseForm.correo}
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        {:else if activeTab === "tab3"}
                            <div class="tab-pane active">
                                <div class="row g-3 mb-4">
                                    <div class="col-md-4">
                                        <div class="form-group-custom">
                                            <label for="vpagar">Valor</label>
                                            <input
                                                type="number"
                                                id="vpagar"
                                                class="form-control-custom text-end"
                                                bind:value={courseForm.vpagar}
                                                readonly
                                            />
                                        </div>
                                    </div>
                                    <div class="col-md-4">
                                        <div class="form-group-custom">
                                            <label for="descto">Descuento</label
                                            >
                                            <input
                                                type="number"
                                                id="descto"
                                                class="form-control-custom text-end"
                                                bind:value={courseForm.descto}
                                                readonly
                                            />
                                        </div>
                                    </div>
                                    <div class="col-md-4">
                                        <div class="form-group-custom">
                                            <label for="apagar">A Pagar</label>
                                            <input
                                                type="number"
                                                id="apagar"
                                                class="form-control-custom text-end fw-bold text-primary"
                                                bind:value={courseForm.apagar}
                                                readonly
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div class="row g-3">
                                    <div class="col-md-4">
                                        <div class="form-group-custom">
                                            <label
                                                for="liberado"
                                                class="d-block mb-2"
                                                >¿Liberado?</label
                                            >
                                            <div class="form-check form-switch">
                                                <input
                                                    class="form-check-input"
                                                    type="checkbox"
                                                    id="liberado"
                                                    checked={courseForm.liberado ===
                                                        "1"}
                                                    on:change={(e) =>
                                                        (courseForm.liberado = e
                                                            .target.checked
                                                            ? "1"
                                                            : "0")}
                                                />
                                                <label
                                                    class="form-check-label"
                                                    for="liberado"
                                                >
                                                    {courseForm.liberado == "1"
                                                        ? "SÍ"
                                                        : "NO"}
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        {/if}
                    </div>

                    <div class="form-actions border-top pt-4">
                        <button type="submit" class="btn btn-save">
                            <i class="fa fa-save"></i> Guardar Pasajero
                        </button>
                        <button
                            type="button"
                            class="btn btn-cancel"
                            on:click={returnToList}
                        >
                            <i class="fa fa-chevron-left"></i> Cancelar y Volver
                        </button>
                        <button
                            type="button"
                            class="btn btn-info"
                            on:click={() => {
                                selectedPdfCursoId = courseForm.id;
                                selectedPdfSaleId = courseForm.sale_id;
                                showMedicalPdf = true;
                            }}
                        >
                            <i class="fa fa-file-medical"></i> Ficha Médica
                        </button>
                    </div>
                </form>
            </div>
        </div>
    {/if}
</div>

{#if showMedicalPdf}
    <MedicalRecordPdf
        id={selectedPdfCursoId}
        sale_id={selectedPdfSaleId}
        onClose={() => {
            showMedicalPdf = false;
        }}
    />
{/if}

{#if showDeleteModal && courseToDelete}
    <div
        class="modal-backdrop"
        on:click|self={() => (showDeleteModal = false)}
        on:keydown|self={(e) =>
            (e.key === "Enter" || e.key === " ") && (showDeleteModal = false)}
        role="button"
        tabindex="-1"
    >
        <div class="modal-dialog">
            <div class="modal-header bg-danger text-white border-0">
                <h5 class="m-0">Confirmar Eliminación</h5>
                <button
                    type="button"
                    class="btn-close-custom"
                    on:click={() => (showDeleteModal = false)}
                    title="Cerrar"
                >
                    <i class="fa fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="warning-icon-container">
                    <i class="fa fa-exclamation-triangle fa-3x text-danger mb-3"
                    ></i>
                </div>
                <p class="mb-2">
                    ¿Estás seguro de que deseas eliminar al pasajero?
                </p>
                <div class="p-3 bg-light rounded border">
                    <strong class="d-block"
                        >{courseToDelete.nombrealumno}</strong
                    >
                    <span class="text-muted small"
                        >{courseToDelete.rutalumno}</span
                    >
                </div>
                <p class="text-danger mt-3 mb-0 small">
                    <i class="fa fa-info-circle me-1"></i> Esta acción no se puede
                    deshacer.
                </p>
            </div>
            <div class="modal-footer">
                <button
                    type="button"
                    class="btn-cancel-modal"
                    on:click={() => (showDeleteModal = false)}
                >
                    Cancelar
                </button>
                <button
                    type="button"
                    class="btn-danger-modal"
                    on:click={confirmDelete}
                >
                    Eliminar Pasajero
                </button>
            </div>
        </div>
    </div>
{/if}

{#if showMedicalPdf}
    <MedicalRecordPdf
        id={selectedPdfCursoId}
        sale_id={selectedPdfSaleId}
        onClose={() => {
            showMedicalPdf = false;
            selectedPdfCursoId = null;
            selectedPdfSaleId = null;
        }}
    />
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

    .nav-tabs-custom {
        display: flex;
        list-style: none;
        padding: 0;
        margin: 0 0 25px 0;
        border-bottom: 2px solid #f0f2f5;
    }

    .nav-tabs-custom .nav-item {
        margin-right: 1.5rem;
    }

    .nav-tabs-custom .nav-link {
        border: none;
        background: none;
        padding: 0.75rem 0.5rem;
        font-weight: 600;
        color: #64748b;
        cursor: pointer;
        position: relative;
        transition: all 0.3s ease;
        font-size: 0.95rem;
    }

    .nav-tabs-custom .nav-link:hover {
        color: #4e73df;
    }

    .nav-tabs-custom .nav-link.active {
        color: #4e73df;
    }

    .nav-tabs-custom .nav-link.active::after {
        content: "";
        position: absolute;
        bottom: -2px;
        left: 0;
        width: 100%;
        height: 2px;
        background-color: #4e73df;
        box-shadow: 0 2px 4px rgba(78, 115, 223, 0.3);
    }

    .form-group-custom {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 15px;
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
        height: 38px;
        background-color: #fff;
    }
    .form-control-custom:focus,
    .form-select-custom:focus {
        border-color: #bac8f3;
        outline: 0;
        box-shadow: 0 0 0 0.2rem rgba(78, 115, 223, 0.25);
    }

    .form-control-custom[readonly],
    .form-select-custom:disabled {
        background-color: #f8f9fc;
        cursor: not-allowed;
        opacity: 1;
    }

    /* Table Styles */
    :global(.dataTable-table thead th) {
        border-bottom: 2px solid #edf2f7 !important;
        background: #f8f9fc !important;
        padding: 15px !important;
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    :global(.action-buttons-mini) {
        display: flex;
        gap: 8px;
    }
    :global(.btn-mini-custom) {
        width: 32px;
        height: 32px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid #e3e6f0;
        background: white;
        cursor: pointer;
        transition: all 0.2s;
        color: #4e73df;
    }
    :global(.btn-mini-custom:hover) {
        background: #f8f9fc;
        transform: translateY(-1px);
    }
    :global(.btn-mini-custom.edit:hover) {
        background: #4e73df;
        color: white;
        border-color: #4e73df;
    }
    :global(.btn-mini-custom.delete:hover) {
        background: #e74a3b;
        color: white;
        border-color: #e74a3b;
    }
    /* Ancho Columnas */
    :global(.datatable-table td:nth-child(2)),
    :global(.datatable-table td:nth-child(3)),
    :global(.datatable-table td:nth-child(4)),
    :global(.datatable-table td:nth-child(5)),
    :global(.datatable-table td:nth-child(8)) {
        white-space: nowrap;
    }

    :global(.datatable-table td:nth-child(14)) {
        min-width: 160px;
        white-space: nowrap;
    }

    /* Badges */
    :global(.badge) {
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: 600;
        font-size: 10px;
        display: inline-flex;
        align-items: center;
        text-transform: uppercase;
    }
    :global(.bg-success-soft) {
        background-color: rgba(28, 200, 138, 0.15) !important;
        color: #1cc88a !important;
    }
    :global(.bg-danger-soft) {
        background-color: rgba(231, 74, 59, 0.15) !important;
        color: #e74a3b !important;
    }

    /* Actions */
    .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 30px;
    }
    .btn-save {
        background: #007bff;
        color: white;
        padding: 8px 20px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 0.9rem;
        border: 1px solid #0069d9;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .btn-save:hover {
        background: #0069d9;
        box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
        transform: translateY(-1px);
    }
    .btn-cancel {
        background: #212529;
        color: white;
        padding: 8px 20px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 0.9rem;
        border: 1px solid #1a1e21;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s;
    }
    .btn-cancel:hover {
        background: #1a1e21;
        transform: translateY(-1px);
    }

    /* Modal Styles */
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
        z-index: 1050;
        backdrop-filter: blur(4px);
    }
    .modal-dialog {
        background: white;
        border-radius: 12px;
        overflow: hidden;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        animation: zoomIn 0.3s ease-out;
    }
    .modal-header {
        padding: 15px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .modal-body {
        padding: 30px 20px;
        text-align: center;
    }
    .modal-footer {
        padding: 15px 20px;
        background: #f8f9fc;
        display: flex;
        justify-content: center;
        gap: 10px;
    }

    .btn-close-custom {
        background: transparent;
        border: none;
        color: white;
        font-size: 1.2rem;
        cursor: pointer;
        opacity: 0.8;
        transition: opacity 0.2s;
        padding: 5px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .btn-close-custom:hover {
        opacity: 1;
    }

    .btn-cancel-modal {
        background: #f1f5f9;
        color: #475569;
        border: 1px solid #e2e8f0;
        padding: 8px 20px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 0.9rem;
        cursor: pointer;
        transition: all 0.2s;
    }
    .btn-cancel-modal:hover {
        background: #e2e8f0;
    }

    .btn-danger-modal {
        background: #e74a3b;
        color: white;
        border: 1px solid #e74a3b;
        padding: 8px 20px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 0.9rem;
        cursor: pointer;
        transition: all 0.2s;
    }
    .btn-danger-modal:hover {
        background: #be2e21;
        box-shadow: 0 4px 12px rgba(231, 74, 59, 0.3);
    }

    .bg-danger {
        background-color: #e74a3b !important;
    }

    .warning-icon-container {
        display: flex;
        justify-content: center;
        width: 100%;
    }

    @keyframes zoomIn {
        from {
            opacity: 0;
            transform: scale(0.95);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
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
