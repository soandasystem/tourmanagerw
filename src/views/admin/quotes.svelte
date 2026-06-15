<script>
    import { onMount, onDestroy } from "svelte";
    import { DataTable } from "simple-datatables";
    import "simple-datatables/dist/style.css";
    import { secureStorage } from "../../lib/secureStore";
    import { hasPermissionPrograms } from "../../lib/utils";
    import { tenantStore } from "../../stores/tenant";
    import api from "../../lib/apis.js";
    import dayjs from "dayjs";
    import Swal from "sweetalert2";
    import QuotesPdf from "../generate_pdf/quotes_pdf.svelte";
    import {
        formatRut,
        validateRut,
        formatPhone,
        validatePhone,
    } from "../../lib/utils";

    let viewMode = "list";
    let isEditing = false;
    let showDeleteModal = false;
    let showPdfModal = false;
    let selectedQuoteId = null;
    let itemIdToDelete = null;
    let showNewQuoteDropdown = false;
    let identificador = Math.random().toString(16).slice(2, 14);

    // Cierre del dropdown al hacer clic fuera
    onMount(() => {
        const handleClickOutside = () => (showNewQuoteDropdown = false);
        window.addEventListener("click", handleClickOutside);
        return () => window.removeEventListener("click", handleClickOutside);
    });

    $: idcl = $tenantStore;
    const userData = secureStorage.getItem("_us_");
    const schemaName = userData.schema;
    const author = userData.username;
    const currentCompanyId = userData.company;
    const rol = userData.rol_id;

    const getInitialForm = (type = "") => ({
        fecha: dayjs().format("YYYY-MM-DD"),
        identificador: Math.random().toString(16).slice(2, 14),
        seller_id: 0,
        establecimiento_id: 0,
        curso: 0,
        idcurso: "",
        pasajeros: 0,
        programa_id: 0,
        subtotal: 0,
        desc: 0,
        vprograma: 0,
        liberados: 0,
        tipocambio: 1,
        contacto: "",
        contactofono: "",
        contactoemail: "",
        estado: "C",
        obsestado: "",
        company_id: currentCompanyId,
        from_quote: 0,
        author: author,
        type_sale: type,
        sale_id: 0,
    });

    let quotesForm = getInitialForm();
    let quotes = [];
    let sellers = [];
    let colegios = [];
    let programs = [];

    let startDate = dayjs().subtract(20, "day").format("YYYY-MM-DD");
    let endDate = dayjs().format("YYYY-MM-DD");
    let filterSeller = "";

    $: filteredSellers = sellers.filter(
        (s) =>
            s.rol?.description === "Vendedor" ||
            s.rol?.description === "Captador" ||
            s.rol?.description === "Administrador",
    );

    let quoteToDelete = null;
    let currentMatrix = [];

    // Cuando cambia el programa, cargar su matriz (detalles de precios)
    $: if (quotesForm.programa_id && programs.length > 0) {
        const prog = programs.find((p) => p.id == quotesForm.programa_id);
        if (prog && prog.matrix) {
            try {
                const parsed =
                    typeof prog.matrix === "string"
                        ? JSON.parse(prog.matrix)
                        : prog.matrix;
                currentMatrix = Array.isArray(parsed) ? parsed : [];
            } catch (e) {
                console.error("Error al parsear la matriz del programa:", e);
                currentMatrix = [];
            }
        } else {
            currentMatrix = [];
        }
    }

    // Calcular el monto (subtotal) automáticamente según los pasajeros y la matriz
    $: if (quotesForm.pasajeros > 0 && currentMatrix.length > 0) {
        let pax = Number(quotesForm.pasajeros);
        let montoUnitario = 0;

        for (let row of currentMatrix) {
            let desde = Number(row.desde_monto || row.desde);
            let hasta = Number(row.hasta_monto || row.hasta);
            if (pax >= desde && pax <= hasta) {
                montoUnitario = Number(row.monto);
                quotesForm.liberados = Number(row.liberado);
                break;
            }
        }

        if (montoUnitario > 0) {
            let nuevoMonto = Math.round(
                montoUnitario * Number(quotesForm.tipocambio),
            );
            if (
                quotesForm.vprograma !== nuevoMonto ||
                quotesForm.subtotal !== nuevoMonto
            ) {
                quotesForm.vprograma = nuevoMonto; // Valor unitario
                quotesForm.subtotal = nuevoMonto; // Total del grupo (Monto base)
            }
        }
    }

    // Calculo automático del total
    $: totalAmount = (
        Number(quotesForm.subtotal) - Number(quotesForm.desc)
    ).toFixed(0);
    $: if (quotesForm.idcurso)
        quotesForm.idcurso = quotesForm.idcurso.toUpperCase();

    $: isUpdate = hasPermissionPrograms(rol, "quotes", "UPDATE");
    $: isDelete = hasPermissionPrograms(rol, "quotes", "DELETE");
    // Formatear datos para Simple DataTable

    $: dtData = quotes.map((q) => {
        let acciones = `<div class="action-buttons-mini">`;
        if (isUpdate) {
            acciones += `<button class="btn-mini-custom edit" onclick="document.dispatchEvent(new CustomEvent('edit-quote', {detail: ${q.id}}))" title="Editar">
                <i class="fa fa-pencil"></i>
            </button>`;
        }
        if (isDelete) {
            acciones += `<button class="btn-mini-custom delete" onclick="document.dispatchEvent(new CustomEvent('delete-quote', {detail: ${q.id}}))" title="Eliminar">
                <i class="fa fa-trash"></i>
            </button>`;
        }
        acciones += `<button class="btn-mini-custom pdf" onclick="document.dispatchEvent(new CustomEvent('generate-pdf', {detail: ${q.id}}))" title="PDF">
            <i class="fa fa-file-pdf-o"></i>
        </button>`;
        acciones += `</div>`;

        return [
            q.id,
            q.identificador,
            q.type_sale == "GE" ? "Gira Estudio" : "Viaje Grupal",
            dayjs(q.fecha).format("DD/MM/YYYY"),
            q.users?.name || "N/A",
            q.colegios?.nombre || "N/A",
            q.pasajeros,
            q.programs?.name || "N/A",
            new Intl.NumberFormat("es-CL", {
                style: "currency",
                currency: "CLP",
            }).format(q.subtotal),
            new Intl.NumberFormat("es-CL", {
                style: "currency",
                currency: "CLP",
            }).format(q.desc),
            new Intl.NumberFormat("es-CL", {
                style: "currency",
                currency: "CLP",
            }).format(q.vprograma),
            q.contacto,
            q.contactofono,
            q.contactoemail,
            renderStatus(q),
            q.tipocambio,
            q.author,
            dayjs(q.UpdatedDate).format("DD/MM/YYYY HH:mm"),
            acciones,
        ];
    });

    const renderStatus = (q) => {
        if (q.estado === "C" && isUpdate) {
            return `
            <select class="form-select form-select-sm" 
                onchange="document.dispatchEvent(new CustomEvent('change-status', {detail: {id: ${q.id}, status: this.value}}))">
                <option value="C" selected>Cotizacion</option>
                <option value="A">Aceptado</option>
                <option value="R">Rechazado</option>
            </select>
        `;
        }
        if (q.estado === "R") {
            return '<span class="badge bg-warning">Rechazado</span>';
        }
        if (q.estado === "A") {
            return '<span class="badge bg-success">Aceptado</span>';
        }
        if (q.estado === "N") {
            return '<span class="badge bg-danger">Anulado</span>';
        }
    };

    let dataTableInstance = null;
    // Directiva para DataTable
    function initDataTable(node, dataConfig) {
        if (dataTableInstance) dataTableInstance.destroy();
        dataTableInstance = new DataTable(node, {
            searchable: true,
            sortable: true,
            perPage: 10,
            perPageSelect: [5, 10, 25, 50, 100],
            fixedColumns: true,
            labels: {
                placeholder: "Buscar cotizaciones...",
                perPage: "por página",
                noRows: "No se encontraron cotizaciones",
                info: "Mostrando {start} a {end} de {rows} registros",
                noResults: "No se encontraron cotizaciones",
            },
            data: {
                headings: [
                    "Cotizacion",
                    "Identificador",
                    "Tipo",
                    "Fecha",
                    "Vendedor",
                    "Colegio",
                    "N Pasajeros",
                    "programa",
                    "Subtotal",
                    "Descuento",
                    "Total",
                    "Contacto",
                    "Fono",
                    "Email",
                    "Estado",
                    "TC",
                    "Autor",
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
            let params = [];
            if (startDate) params.push(`start_date=${startDate}`);
            if (endDate) params.push(`end_date=${endDate}`);
            if (filterSeller) params.push(`vendedor=${filterSeller}`);
            let filterParams = params.join("&");

            const [quotesRes, usersRes, colegioRes, programsRes] =
                await Promise.all([
                    api.getData("quotes", "", filterParams, "", schemaName),
                    api.getData(
                        "users",
                        "",
                        "active=1&company_id=" + currentCompanyId,
                        "",
                        schemaName,
                    ),
                    api.getData("colegio", "", "", "", schemaName),
                    api.getData(
                        "programs",
                        "",
                        "active=1&company_id=" + currentCompanyId,
                        "",
                        schemaName,
                    ),
                ]);
            if (quotesRes.status === "success")
                quotes = Array.isArray(quotesRes.data) ? quotesRes.data : [];
            if (usersRes.status === "success")
                sellers = Array.isArray(usersRes.data) ? usersRes.data : [];
            if (colegioRes.status === "success")
                colegios = Array.isArray(colegioRes.data)
                    ? colegioRes.data
                    : [];
            if (programsRes.status === "success")
                programs = Array.isArray(programsRes.data)
                    ? programsRes.data
                    : [];

            // El filtrado es ahora reactivo ($:)
        } catch (error) {
            console.error("Error al cargar datos:", error);
        }
    };

    onMount(() => {
        fetchData();
        document.addEventListener("edit-quote", handleEdit);
        document.addEventListener("delete-quote", handleDelete);
        document.addEventListener("generate-pdf", handleGeneratePdf);
        document.addEventListener("change-status", handleChangeStatus);
    });

    onDestroy(() => {
        document.removeEventListener("edit-quote", handleEdit);
        document.removeEventListener("delete-quote", handleDelete);
        document.removeEventListener("generate-pdf", handleGeneratePdf);
        document.removeEventListener("change-status", handleChangeStatus);
    });

    function handleGeneratePdf(event) {
        selectedQuoteId = event.detail;
        showPdfModal = true;
    }

    async function handleChangeStatus(event) {
        const { id, status } = event.detail;

        // Obtenemos la cotización actual para tener todos los datos
        const res = await api.getData("quotes", "", "", id, schemaName);
        if (res.status === "success" && res.data) {
            const payload = {
                estado: status,
                author: author, // Actualizamos el autor de la modificación
            };

            const updateRes = await api.updateData(
                "quotes",
                payload,
                "",
                id,
                schemaName,
            );
            if (updateRes.status === "success") {
                Swal.fire(
                    "Éxito",
                    "Estado actualizado correctamente",
                    "success",
                );
                fetchData(); // Recargamos la tabla
            } else {
                Swal.fire("Error", updateRes.message, "error");
            }
        }
    }

    async function handleEdit(event) {
        const id = event.detail;
        const res = await api.getData("quotes", "", "", id, schemaName);
        if (res.status === "success" && res.data) {
            quotesForm = { ...res.data };
            isEditing = true;
            viewMode = "form";
        }
    }

    async function handleDelete(event) {
        const id = event.detail;
        const res = await api.getData("quotes", "", "", id, schemaName);
        if (res.status === "success" && res.data) {
            quoteToDelete = res.data;
            showDeleteModal = true;
        }
    }

    async function confirmDelete() {
        if (!quoteToDelete) return;
        const payload = {
            estado: "N",
            author: author, // Actualizamos el autor de la modificación
        };
        const res = await api.updateData(
            "quotes",
            payload,
            "",
            quoteToDelete.id,
            schemaName,
        );
        if (res.status === "success") {
            Swal.fire("Anulada", "Cotización anulada.", "success");
            showDeleteModal = false;
            fetchData();
        } else {
            Swal.fire("Error", res.message, "error");
        }
    }

    async function saveQuote() {
        const payload = {
            ...quotesForm,
            fecha: quotesForm.fecha + "T00:00:00Z",
            curso: Number(quotesForm.curso),
            pasajeros: Number(quotesForm.pasajeros),
            seller_id: Number(quotesForm.seller_id),
            establecimiento_id: Number(quotesForm.establecimiento_id),
            programa_id: Number(quotesForm.programa_id),
            author: author,
        };

        let res;
        if (isEditing) {
            res = await api.updateData(
                "quotes",
                payload,
                "",
                quotesForm.id,
                schemaName,
            );
        } else {
            res = await api.setData("quotes", payload, "", "", schemaName);
        }

        if (res.status === "success") {
            Swal.fire(
                "Guardado",
                `Cotización ${isEditing ? "actualizada" : "creada"} correctamente.`,
                "success",
            );
            viewMode = "list";
            fetchData();
        } else {
            Swal.fire("Error", res.message, "error");
        }
    }

    function openCreateForm(type) {
        quotesForm = getInitialForm(type);
        isEditing = false;
        viewMode = "form";
        showNewQuoteDropdown = false;
    }

    function handlePhoneInput(field, e) {
        quotesForm[field] = formatPhone(e.target.value);
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
                {#if hasPermissionPrograms(rol, "quotes", "INSERT")}
                    <div class="dropdown-container">
                        <button
                            class="btn-new"
                            on:click|stopPropagation={() =>
                                (showNewQuoteDropdown = !showNewQuoteDropdown)}
                        >
                            <i class="fa fa-plus"></i> Nueva Cotizacion
                            <i class="fa fa-caret-down ms-2"></i>
                        </button>
                        {#if showNewQuoteDropdown}
                            <div class="dropdown-menu-custom show shadow-lg">
                                <button
                                    class="dropdown-item"
                                    on:click={() => openCreateForm("GE")}
                                >
                                    <i class="fa fa-plus me-2 text-primary"></i>
                                    Gira Estudio
                                </button>
                                <button
                                    class="dropdown-item"
                                    on:click={() => openCreateForm("VG")}
                                >
                                    <i class="fa fa-plus me-2 text-primary"></i>
                                    Viaje Grupal
                                </button>
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>
            <div class="filters-container p-4 pb-0">
                <div class="row g-3">
                    <div class="col-md-3">
                        <div class="form-group-custom">
                            <label for="start_date">Fecha Desde</label>
                            <input
                                type="date"
                                id="start_date"
                                class="form-control-custom"
                                bind:value={startDate}
                                max={dayjs().format("YYYY-MM-DD")}
                            />
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="form-group-custom">
                            <label for="end_date">Fecha Hasta</label>
                            <input
                                type="date"
                                id="end_date"
                                class="form-control-custom"
                                bind:value={endDate}
                                max={dayjs().format("YYYY-MM-DD")}
                            />
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="form-group-custom">
                            <label for="filter_seller">Vendedor</label>
                            <select
                                id="filter_seller"
                                class="form-select-custom"
                                bind:value={filterSeller}
                            >
                                <option value="">Todas</option>
                                {#each filteredSellers as seller}
                                    <option value={seller.id}
                                        >{seller.name}</option
                                    >
                                {/each}
                            </select>
                        </div>
                    </div>
                    <div class="col-md-3 d-flex align-items-end">
                        <button class="btn-new w-100" on:click={fetchData}>
                            <i class="fa fa-search"></i> Buscar
                        </button>
                    </div>
                </div>
            </div>
            <hr class="mx-4 my-4" />

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
                        {isEditing ? "Editar" : "Nueva"} Cotización ({quotesForm.type_sale ===
                        "GE"
                            ? "Gira Estudio"
                            : "Viaje Grupal"})
                    </h2>
                </div>
                <button class="btn-back" on:click={() => (viewMode = "list")}>
                    <i class="fa fa-arrow-left"></i> Volver
                </button>
            </div>

            <div class="card-body p-4">
                <form on:submit|preventDefault={saveQuote}>
                    <!-- Sección Identificación -->
                    <div class="section-title mb-4">
                        Información de la Cotización
                    </div>
                    <div class="row g-2">
                        <div class="col-md-4">
                            <div class="form-group-custom">
                                <label for="identificador">Identificador</label>
                                <input
                                    type="text"
                                    id="identificador"
                                    class="form-control-custom"
                                    bind:value={quotesForm.identificador}
                                    placeholder="Ej: COT-2024-001"
                                    required
                                />
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="form-group-custom">
                                <label for="fecha">Fecha</label>
                                <input
                                    type="date"
                                    id="fecha"
                                    class="form-control-custom"
                                    bind:value={quotesForm.fecha}
                                    required
                                />
                            </div>
                        </div>
                        <div class="col-md-2">
                            <div class="form-group-custom">
                                <label for="tipocambio">Tipo Cambio</label>
                                <input
                                    type="number"
                                    id="tipocambio"
                                    class="form-control-custom text-end"
                                    bind:value={quotesForm.tipocambio}
                                    required
                                    min="1"
                                />
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="form-group-custom">
                                <label for="seller_id">Vendedor</label>
                                <select
                                    id="seller_id"
                                    class="form-select-custom"
                                    bind:value={quotesForm.seller_id}
                                    required
                                >
                                    <option value="0">Seleccionar</option>
                                    {#each sellers as seller}
                                        <option value={String(seller.id)}
                                            >{seller.name}</option
                                        >
                                    {/each}
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- Sección Cliente -->
                    <div class="section-title mb-4 mt-2">
                        Detalles del Cliente
                    </div>
                    <div class="row g-2">
                        {#if quotesForm.type_sale === "GE"}
                            <div class="col-md-6">
                                <div class="form-group-custom">
                                    <label for="establecimiento_id"
                                        >Colegio / Establecimiento</label
                                    >
                                    <select
                                        id="establecimiento_id"
                                        class="form-select-custom"
                                        bind:value={
                                            quotesForm.establecimiento_id
                                        }
                                        required
                                    >
                                        <option value="0">Seleccionar</option>
                                        {#each colegios as colegio}
                                            <option value={String(colegio.id)}
                                                >{colegio.nombre}</option
                                            >
                                        {/each}
                                    </select>
                                </div>
                            </div>
                            <div class="col-md-2">
                                <div class="form-group-custom">
                                    <label for="curso">Curso</label>
                                    <input
                                        type="numeric"
                                        id="curso"
                                        class="form-control-custom"
                                        bind:value={quotesForm.curso}
                                        placeholder="Ej: 8"
                                        min="1"
                                        required
                                    />
                                </div>
                            </div>
                            <div class="col-md-2">
                                <div class="form-group-custom">
                                    <label for="idcurso">Id Curso</label>
                                    <input
                                        type="text"
                                        id="idcurso"
                                        class="form-control-custom"
                                        style="text-transform: uppercase;"
                                        bind:value={quotesForm.idcurso}
                                        placeholder="Ej: A"
                                    />
                                </div>
                            </div>
                            <div class="col-md-2">
                                <div class="form-group-custom">
                                    <label for="pasajeros">N° Pasajeros</label>
                                    <input
                                        type="number"
                                        id="pasajeros"
                                        class="form-control-custom text-end"
                                        bind:value={quotesForm.pasajeros}
                                        min="1"
                                    />
                                </div>
                            </div>
                        {/if}
                    </div>

                    <div class="row g-2">
                        <div class="col-md-4">
                            <div class="form-group-custom">
                                <label for="contacto">Contacto</label>
                                <input
                                    type="text"
                                    id="contacto"
                                    class="form-control-custom"
                                    bind:value={quotesForm.contacto}
                                    placeholder="Nombre del apoderado/encargado"
                                    required
                                />
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="form-group-custom">
                                <label for="contactofono">Teléfono</label>
                                <input
                                    type="text"
                                    class="form-control {quotesForm.contactofono &&
                                    !validatePhone(quotesForm.contactofono)
                                        ? 'is-invalid'
                                        : ''}"
                                    id="contactofono"
                                    value={quotesForm.contactofono}
                                    on:input={(e) =>
                                        handlePhoneInput("contactofono", e)}
                                    maxlength="14"
                                />
                                {#if quotesForm.contactofono && !validatePhone(quotesForm.contactofono)}
                                    <div class="invalid-feedback">
                                        Fono inválido (+56 9...)
                                    </div>
                                {/if}
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="form-group-custom">
                                <label for="contactoemail">Email</label>
                                <input
                                    type="email"
                                    id="contactoemail"
                                    class="form-control-custom"
                                    bind:value={quotesForm.contactoemail}
                                    placeholder="email@ejemplo.com"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <!-- Sección Programa y Valores -->
                    <div class="section-title mb-4 mt-2">
                        Programa y Finanzas
                    </div>
                    <div class="row g-2">
                        <div class="col-md-4">
                            <div class="form-group-custom">
                                <label for="programa_id">Programa</label>
                                <select
                                    id="programa_id"
                                    class="form-select-custom"
                                    bind:value={quotesForm.programa_id}
                                    required
                                >
                                    <option value="0">Seleccionar</option>
                                    {#each programs as program}
                                        <option value={String(program.id)}
                                            >{program.name} ({program.code})</option
                                        >
                                    {/each}
                                </select>
                            </div>
                        </div>
                        <div class="col-md-2">
                            <div class="form-group-custom">
                                <label for="subtotal">Monto</label>
                                <input
                                    type="number"
                                    id="subtotal"
                                    class="form-control-custom text-end"
                                    bind:value={quotesForm.subtotal}
                                />
                            </div>
                        </div>
                        <div class="col-md-2">
                            <div class="form-group-custom">
                                <label for="desc">Descuento</label>
                                <input
                                    type="number"
                                    id="desc"
                                    class="form-control-custom text-end"
                                    bind:value={quotesForm.desc}
                                />
                            </div>
                        </div>
                        <div class="col-md-2">
                            <div class="form-group-custom">
                                <label for="total">Total</label>
                                <input
                                    type="text"
                                    id="total"
                                    class="form-control-custom text-end fw-bold text-primary"
                                    value={totalAmount}
                                    readonly
                                />
                            </div>
                        </div>
                        <div class="col-md-2">
                            <div class="form-group-custom">
                                <label for="liberados">N° Liberados</label>
                                <input
                                    type="number"
                                    id="liberados"
                                    class="form-control-custom text-end"
                                    bind:value={quotesForm.liberados}
                                    min="1"
                                />
                            </div>
                        </div>
                    </div>

                    <!-- Sección Estado -->
                    <div class="section-title mb-4 mt-2">Estado y Notas</div>
                    <div class="row g-2 mb-5">
                        <div class="col-md-4">
                            <div class="form-group-custom">
                                <label for="estado">Estado</label>
                                <select
                                    id="estado"
                                    class="form-select-custom"
                                    bind:value={quotesForm.estado}
                                    required
                                >
                                    <option value="C">Cotización</option>
                                    <option value="A">Aceptado</option>
                                    <option value="R">Rechazado</option>
                                </select>
                            </div>
                        </div>
                        <div class="col-md-8">
                            <div class="form-group-custom">
                                <label for="obsestado">Observaciones</label>
                                <textarea
                                    id="obsestado"
                                    class="form-control-custom"
                                    rows="3"
                                    bind:value={quotesForm.obsestado}
                                    placeholder="Notas adicionales sobre el estado o la cotización..."
                                ></textarea>
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
{#if showDeleteModal && quoteToDelete}
    <div class="modal-backdrop fade show"></div>
    <div class="modal show d-block" tabindex="-1">
        <div class="modal-dialog modal-sm modal-dialog-centered">
            <div class="modal-content border-0 shadow">
                <div class="modal-header bg-danger text-white border-0">
                    <h5 class="modal-title">Anular Cotización</h5>
                    <button
                        type="button"
                        title="eliminar"
                        class="btn-close btn-close-white"
                        on:click={() => (showDeleteModal = false)}
                    ></button>
                </div>
                <div class="modal-body text-center p-4">
                    <i class="fa fa-warning fa-3x text-danger mb-3"></i>
                    <p class="mb-2">
                        Estás por anular la cotización de
                        <span
                            class="badge {quoteToDelete.type_sale === 'GE'
                                ? 'bg-primary text-white'
                                : 'bg-info text-white'}"
                        >
                            {quoteToDelete.type_sale === "GE"
                                ? "Gira de Estudio"
                                : "Viaje Grupal"}
                        </span>
                    </p>
                    <p class="mb-0">
                        ¿Confirmas anular la cotización <strong
                            >{quoteToDelete.identificador}</strong
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
                        on:click={confirmDelete}>Anular</button
                    >
                </div>
            </div>
        </div>
    </div>
{/if}

{#if showPdfModal}
    <QuotesPdf
        id={selectedQuoteId}
        onClose={() => {
            showPdfModal = false;
            selectedQuoteId = null;
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

    /* Dropdown Styles */
    .dropdown-container {
        position: relative;
    }
    .dropdown-menu-custom {
        position: absolute;
        top: 100%;
        right: 0;
        z-index: 1000;
        display: none;
        min-width: 180px;
        padding: 8px 0;
        margin: 8px 0 0;
        background-color: #fff;
        border: 1px solid #e3e6f0;
        border-radius: 10px;
        animation: zoomIn 0.2s ease-out;
    }
    .dropdown-menu-custom.show {
        display: block;
    }
    .dropdown-item {
        display: block;
        width: 100%;
        padding: 10px 20px;
        clear: both;
        font-weight: 600;
        color: #4a5568;
        text-align: inherit;
        white-space: nowrap;
        background-color: transparent;
        border: 0;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 0.9rem;
    }
    .dropdown-item:hover {
        background-color: #f8f9fc;
        color: #4e73df;
        padding-left: 25px;
    }
    .dropdown-item i {
        width: 20px;
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

    /* Actions */
    .btn-save {
        background: #4e73df;
        color: white;
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
    .table-container {
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        border-radius: 0 0 12px 12px;
    }

    /* Global Table Overrides */
    :global(.dataTable-wrapper) {
        font-family: inherit;
        overflow-x: auto;
    }
    :global(.dataTable-table) {
        width: 100% !important;
        white-space: nowrap !important;
        table-layout: auto !important;
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
    :global(.btn-mini-custom.pdf:hover) {
        background: #2563eb;
        color: white;
        border-color: #2563eb;
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
    /* Ancho Columnas */
    :global(.datatable-table td:nth-child(3)),
    :global(.datatable-table td:nth-child(7)),
    :global(.datatable-table td:nth-child(13)),
    :global(.datatable-table td:nth-child(18)) {
        white-space: nowrap;
    }

    :global(.datatable-table td:nth-child(15)) {
        min-width: 160px;
        white-space: nowrap;
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
