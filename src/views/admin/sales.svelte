<script>
    import { onMount, onDestroy } from "svelte";
    import { DataTable } from "simple-datatables";
    import "simple-datatables/dist/style.css";
    import { secureStorage } from "../../lib/secureStore";
    import {
        hasPermissionPrograms,
        formatCurrency,
        formatDateSave,
        formatDate,
    } from "../../lib/utils";
    import api from "../../lib/apis.js";
    import PasajerosPdf from "../generate_pdf/pasajeros_pdf.svelte";
    import dayjs from "dayjs";
    import Swal from "sweetalert2";

    let viewMode = "list";
    let isEditing = false;
    let showDeleteModal = false;
    let showNewQuoteDropdown = false;
    let identificador = Math.random().toString(16).slice(2, 14);

    // Cierre del dropdown al hacer clic fue
    onMount(() => {
        const handleClickOutside = () => (showNewQuoteDropdown = false);
        window.addEventListener("click", handleClickOutside);
        return () => window.removeEventListener("click", handleClickOutside);
    });

    const userData = secureStorage.getItem("_us_");
    const schemaName = userData.schema;
    const author = userData.username;
    const currentCompanyId = userData.company;
    const rol = userData.rol_id;

    const getInitialForm = (type = "") => ({
        fecha: dayjs().format("YYYY-MM-DD"),
        seller_id: 0,
        identificador: Math.random().toString(16).slice(2, 14),
        establecimiento_id: 0,
        programa_id: 0,
        quote_id: 0,
        curso: 0,
        idcurso: "",
        nroalumno: 0,
        liberados: 0,
        subtotal: 0,
        descm: 0,
        vprograma: 0,
        description: "",
        obs: "",
        fechasalida: dayjs().format("YYYY-MM-DD"),
        activo: 1,
        state: "",
        author: author,
        encargado: "",
        correo_encargado: "",
        password: "",
        fecha_ultpag: dayjs().format("YYYY-MM-DD"),
        sendemail: 0,
        comision: 0,
        tipocambio: 1,
        comision_pagada: 0,
        cuotas: 0,
        fechacuota: dayjs().format("YYYY-MM-DD"),
        company_id: currentCompanyId,
        accesscode: "",
        type_sale: type,
    });

    let salesForm = getInitialForm();
    let sales = [];
    let sellers = [];
    let colegios = [];
    let programs = [];
    let quotes = [];

    let startDate = dayjs().subtract(20, "day").format("YYYY-MM-DD");
    let endDate = dayjs().format("YYYY-MM-DD");
    let filterSeller = "";

    $: filteredSellers = sellers.filter(
        (s) =>
            s.rol?.description === "Vendedor" ||
            s.rol?.description === "Captador" ||
            s.rol?.description === "Administrador",
    );

    $: filteredQuotes = quotes.filter(
        (q) =>
            q.type_sale === salesForm.type_sale &&
            q.estado === "A" &&
            q.sale_id === 0,
    );

    let saleToDelete = null;
    let currentMatrix = [];

    // Variables para el control de los PDFs
    let showPdfModal = false;
    let selectedQuoteId = null;
    let showPassengersPdf = false;
    let selectedSaleId = null;

    // Cuando cambia el programa, cargar su matriz (detalles de precios)
    $: if (salesForm.programa_id && programs.length > 0) {
        const prog = programs.find((p) => p.id == salesForm.programa_id);
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
    $: if (salesForm.nroalumno > 0 && currentMatrix.length > 0) {
        let pax = Number(salesForm.nroalumno);
        let montoUnitario = 0;

        for (let row of currentMatrix) {
            let desde = Number(row.desde_monto || row.desde);
            let hasta = Number(row.hasta_monto || row.hasta);
            if (pax >= desde && pax <= hasta) {
                montoUnitario = Number(row.monto);
                salesForm.liberados = Number(row.liberado);
                break;
            }
        }

        if (montoUnitario > 0) {
            let nuevoMonto = Math.round(
                montoUnitario * Number(salesForm.tipocambio),
            );
            if (salesForm.subtotal !== Number(nuevoMonto)) {
                salesForm.subtotal = Number(nuevoMonto); // Total del grupo (Monto base)
            }
        }
    }

    // Calculo automático del vprograma (Total)
    $: {
        const calculatedTotal = Math.max(
            0,
            Number(salesForm.subtotal) - Number(salesForm.descm),
        );
        if (salesForm.vprograma !== calculatedTotal) {
            salesForm.vprograma = calculatedTotal;
        }
    }
    // Calculo automático del total
    let totalAmount = 0;
    $: totalAmount = salesForm.vprograma;
    $: if (salesForm.idcurso)
        salesForm.idcurso = salesForm.idcurso.toUpperCase();

    // Cargar datos de la cotización seleccionada
    $: if (salesForm.quote_id > 0 && !isEditing) {
        const q = quotes.find((q) => q.id == salesForm.quote_id);
        if (q) {
            salesForm.establecimiento_id = String(
                q.establecimiento_id || q.colegio_id || q.colegios?.id || 0,
            );
            salesForm.seller_id = String(q.seller_id || "0");
            salesForm.curso = q.curso || 0;
            salesForm.idcurso = q.idcurso || "";
            salesForm.nroalumno = Number(q.pasajeros || 0);
            salesForm.programa_id = String(
                q.programa_id ||
                    q.program_id ||
                    q.programa?.id ||
                    q.program?.id ||
                    q.programs?.id ||
                    0,
            );
            salesForm.tipocambio = Number(q.tipocambio || 1);
            let baseUnit = Number(q.vprograma || 0) * salesForm.tipocambio;
            salesForm.subtotal = baseUnit;
            salesForm.descm = Number(q.desc || 0);
            salesForm.encargado = q.contacto || "";
            salesForm.correo_encargado = q.contactoemail || "";
            salesForm.liberados = Number(q.liberados || 0);
        }
    }
    $: isUpdate = hasPermissionPrograms(rol, "sales", "UPDATE");
    $: isDelete = hasPermissionPrograms(rol, "sales", "DELETE");

    $: dtData = sales.map((s) => {
        let acciones = `<div class="action-buttons-mini">`;
        if (isUpdate) {
            acciones += `<button class="btn-mini-custom edit" onclick="document.dispatchEvent(new CustomEvent('edit-sale', {detail: ${s.id}}))" title="Editar">
                <i class="fa fa-pencil"></i>
            </button>`;
        }
        if (isDelete) {
            acciones += `<button class="btn-mini-custom delete" onclick="document.dispatchEvent(new CustomEvent('delete-sale', {detail: ${s.id}}))" title="Eliminar">
                <i class="fa fa-trash"></i>
            </button>`;
        }
        acciones += `</div>`;

        let lstpsajeros = "";
        if (s.total_curso > 0) {
            lstpsajeros = `<button class="btn-mini-custom pdf" onclick="document.dispatchEvent(new CustomEvent('generate-passengers-pdf', {detail: ${s.id}}))" title="Pasajeros PDF">
            <i class="fa fa-file-pdf-o"></i>
        </button>`;
        } else {
            lstpsajeros = "";
        }

        let typesale = "Viaje Grupal";
        if (s.type_sale == "GE") {
            typesale = "Gira Estudio";
        }

        let alumnos_curso = s.total_curso;
        return [
            '<input type="checkbox" name="sales[]" value="' + s.id + '">',
            s.id,
            typesale,
            s.identificador,
            formatDate(s.fecha),
            s.establecimiento_nombre || "N/A",
            s.curso + "-" + s.idcurso,
            s.program_name || "N/A",
            s.nroalumno,
            s.liberados,
            formatCurrency(
                s.nroalumno > 0 ? Number(s.subtotal || 0) / s.nroalumno : 0,
            ),
            formatCurrency(s.vprograma),
            s.seller_name || "N/A",
            renderStatus(s),
            alumnos_curso + " / " + s.nroalumno,
            lstpsajeros,
            s.author,
            acciones,
        ];
    });

    const renderStatus = (q) => {
        if (q.state === "V" && isUpdate) {
            return `
            <select class="form-select form-select-sm" 
                onchange="document.dispatchEvent(new CustomEvent('change-status', {detail: {id: ${q.id}, status: this.value}}))">
                <option value="V" selected>Venta</option>
                <option value="F">Cerrado</option>
                <option value="R">Rechazado</option>
            </select>
        `;
        } else if (q.state === "R") {
            return "Rechazado";
        }
        if (q.activo == 2) {
            return "Nulo";
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
                placeholder: "Buscar ventas...",
                perPage: "por página",
                noRows: "No se encontraron ventas",
                info: "Mostrando {start} a {end} de {rows} registros",
                noResults: "No se encontraron ventas",
            },
            data: {
                headings: [
                    "Id",
                    "Venta",
                    "Tipo Venta",
                    "Identificador",
                    "Fecha",
                    "Colegio",
                    "Curso",
                    "programa",
                    "Pasajeros",
                    "Liberados",
                    "valor",
                    "Total",
                    "Vendedor",
                    "Estado",
                    "Pasajeros",
                    "Lista Pasajeros",
                    "Autor",
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

            const [salesRes, usersRes, colegioRes, programsRes, quotesRes] =
                await Promise.all([
                    api.getData(
                        "sale/informe",
                        "",
                        filterParams,
                        "",
                        schemaName,
                    ),
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
                    api.getData(
                        "quotes",
                        "",
                        "estado=A&company_id=" + currentCompanyId,
                        "",
                        schemaName,
                    ),
                ]);
            if (salesRes.status === "success")
                sales = Array.isArray(salesRes.data) ? salesRes.data : [];
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
            if (quotesRes.status === "success")
                quotes = Array.isArray(quotesRes.data) ? quotesRes.data : [];

            // El filtrado es ahora reactivo ($:)
        } catch (error) {
            console.error("Error al cargar datos:", error);
        }
    };

    onMount(() => {
        fetchData();
        document.addEventListener("edit-sale", handleEdit);
        document.addEventListener("delete-sale", handleDelete);
        document.addEventListener("change-status", handleChangeStatus);
        document.addEventListener("generate-pdf", handleGeneratePdf);
        document.addEventListener(
            "generate-passengers-pdf",
            handleGeneratePassengersPdf,
        );
    });

    onDestroy(() => {
        document.removeEventListener("edit-sale", handleEdit);
        document.removeEventListener("delete-sale", handleDelete);
        document.removeEventListener("change-status", handleChangeStatus);
        document.removeEventListener("generate-pdf", handleGeneratePdf);
        document.removeEventListener(
            "generate-passengers-pdf",
            handleGeneratePassengersPdf,
        );
    });

    function handleGeneratePdf(event) {
        selectedQuoteId = event.detail;
        showPdfModal = true;
    }

    function handleGeneratePassengersPdf(event) {
        selectedSaleId = event.detail;
        showPassengersPdf = true;
    }

    async function handleChangeStatus(event) {
        const { id, status } = event.detail;

        // Obtenemos la cotización actual para tener todos los datos
        const res = await api.getData("sale", "", "", id, schemaName);
        if (res.status === "success" && res.data) {
            const payload = {
                estado: status,
                author: author, // Actualizamos el autor de la modificación
            };

            const updateRes = await api.updateData(
                "sale",
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
        const res = await api.getData("sale", "", "", id, schemaName);
        if (res.status === "success" && res.data) {
            salesForm = { ...res.data };
            // Mapear y convertir a string para que los select funcionen correctamente
            salesForm.establecimiento_id = String(
                res.data.establecimiento_id || 0,
            );
            salesForm.seller_id = String(
                res.data.seller_id || res.data.vendedor_id || 0,
            );
            salesForm.programa_id = String(
                res.data.programa_id || res.data.program_id || 0,
            );

            // Asegurar que las fechas tengan el formato correcto para los inputs de tipo date
            if (salesForm.fecha)
                salesForm.fecha = salesForm.fecha.split("T")[0];
            if (salesForm.fechasalida)
                salesForm.fechasalida = salesForm.fechasalida.split("T")[0];
            if (salesForm.fechacuota)
                salesForm.fechacuota = salesForm.fechacuota.split("T")[0];
            if (salesForm.fecha_ultpag)
                salesForm.fecha_ultpag = salesForm.fecha_ultpag.split("T")[0];

            isEditing = true;
            viewMode = "form";
        }
    }

    async function handleDelete(event) {
        const id = event.detail;
        const res = await api.getData("sale", "", "", id, schemaName);
        if (res.status === "success" && res.data) {
            saleToDelete = res.data;
            showDeleteModal = true;
        }
    }

    async function confirmDelete() {
        if (!saleToDelete) return;
        const payload = {
            estado: "N",
            author: author, // Actualizamos el autor de la modificación
        };
        const res = await api.updateData(
            "sale",
            payload,
            "",
            saleToDelete.id,
            schemaName,
        );
        if (res.status === "success") {
            Swal.fire("Anulada", "Venta anulada.", "success");
            showDeleteModal = false;
            fetchData();
        } else {
            Swal.fire("Error", res.message, "error");
        }
    }

    async function saveSale() {
        const payload = {
            ...salesForm,
            fecha: salesForm.fecha + "T00:00:00Z",
            fecha_ultpag: salesForm.fecha_ultpag
                ? salesForm.fecha_ultpag + "T00:00:00Z"
                : null,
            fechasalida: salesForm.fechasalida
                ? salesForm.fechasalida + "T00:00:00Z"
                : null,
            fechacuota: salesForm.fechacuota
                ? salesForm.fechacuota + "T00:00:00Z"
                : null,
            curso: Number(salesForm.curso),
            nroalumno: Number(salesForm.nroalumno),
            liberados: Number(salesForm.liberados),
            seller_id: Number(salesForm.seller_id),
            establecimiento_id:
                Number(salesForm.establecimiento_id) == 0
                    ? 1
                    : Number(salesForm.establecimiento_id),
            program_id: Number(salesForm.programa_id),
            author: author,
        };

        let res;
        if (isEditing) {
            res = await api.updateData(
                "sale",
                payload,
                "",
                salesForm.id,
                schemaName,
            );
        } else {
            res = await api.setData("sale", payload, "", "", schemaName);
        }

        if (res.status === "success") {
            // Vincular la venta con la cotización de origen
            const saleId = isEditing ? salesForm.id : res.data?.id;
            if (salesForm.quote_id && salesForm.quote_id != "0" && saleId) {
                await api.updateData(
                    "quotes",
                    { sale_id: saleId },
                    "",
                    salesForm.quote_id,
                    schemaName,
                );
            }

            Swal.fire(
                "Guardado",
                `Venta ${isEditing ? "actualizada" : "creada"} correctamente.`,
                "success",
            );
            viewMode = "list";
            fetchData();
        } else {
            Swal.fire("Error", res.message, "error");
        }
    }

    function openCreateForm(type) {
        salesForm = getInitialForm(type);
        isEditing = false;
        viewMode = "form";
        showNewQuoteDropdown = false;
    }

    function generateCode() {
        salesForm.accesscode = Math.random()
            .toString(36)
            .substring(2, 10)
            .toUpperCase();
    }
</script>

<div class="page-wrapper">
    {#if viewMode === "list"}
        <div class="card main-card shadow-sm border-0 mb-4">
            <div class="card-header-flex p-4">
                <div class="title-group">
                    <div class="title-with-icon">
                        <i class="fa fa-map-o icon-main text-primary"></i>
                        <h2 class="m-0">Gestión de Ventas</h2>
                    </div>
                    <p class="subtitle mt-1 mb-0">
                        Administra las ventas y sus valores.
                    </p>
                </div>
                {#if hasPermissionPrograms(rol, "sales", "INSERT")}
                    <div class="dropdown-container">
                        <button
                            class="btn-new"
                            on:click|stopPropagation={() =>
                                (showNewQuoteDropdown = !showNewQuoteDropdown)}
                        >
                            <i class="fa fa-plus"></i> Nueva Venta
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
                                    <option value={String(seller.id)}
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
        <div class="card main-card shadow-sm border-0 mb-4">
            <div class="card-header-flex p-4 border-bottom">
                <div class="title-with-icon">
                    <i
                        class="fa {isEditing
                            ? 'fa-pencil'
                            : 'fa-plus'} icon-main text-primary"
                    ></i>
                    <h2 class="m-0">
                        {isEditing ? "Editar" : "Nueva"} Venta ({salesForm.type_sale ===
                        "GE"
                            ? "Gira de Estudio"
                            : "Viaje Grupal"})
                    </h2>
                </div>
                <button class="btn-back" on:click={() => (viewMode = "list")}>
                    <i class="fa fa-arrow-left"></i> Volver
                </button>
            </div>

            <div class="card-body p-4">
                <form on:submit|preventDefault={saveSale}>
                    {#if salesForm.type_sale === "GE"}
                        <!-- Sección Información General -->
                        <div class="section-title mb-4">
                            Información de la Venta
                        </div>
                        <div class="row g-2 mb-3">
                            <div class="col-md-3">
                                <div class="form-group-custom">
                                    <label for="quote_id"
                                        >Desde Cotización</label
                                    >
                                    <select
                                        id="quote_id"
                                        class="form-select-custom"
                                        bind:value={salesForm.quote_id}
                                    >
                                        <option value="0">Seleccionar</option>
                                        {#each filteredQuotes as quote}
                                            <option value={quote.id}
                                                >{quote.id}</option
                                            >
                                        {/each}
                                    </select>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="form-group-custom">
                                    <label for="fecha">Fecha Contrato</label>
                                    <input
                                        type="date"
                                        id="fecha"
                                        bind:value={salesForm.fecha}
                                        class="form-control-custom"
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
                                        step="0.01"
                                        class="form-control-custom text-end"
                                        bind:value={salesForm.tipocambio}
                                        required
                                    />
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="form-group-custom">
                                    <label for="seller_id">Vendedor</label>
                                    <select
                                        id="seller_id"
                                        class="form-select-custom"
                                        bind:value={salesForm.seller_id}
                                        required
                                    >
                                        <option value="0">Seleccionar</option>
                                        {#each filteredSellers as seller}
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
                            Detalles del Cliente y Curso
                        </div>
                        <div class="row g-2 mb-3">
                            <div class="col-md-6">
                                <div class="form-group-custom">
                                    <label for="establecimiento_id"
                                        >Colegio / Establecimiento</label
                                    >
                                    <select
                                        id="establecimiento_id"
                                        class="form-select-custom"
                                        bind:value={
                                            salesForm.establecimiento_id
                                        }
                                        required
                                    >
                                        <option value="0">Seleccionar</option>
                                        {#each colegios as school}
                                            <option value={String(school.id)}
                                                >{school.nombre}</option
                                            >
                                        {/each}
                                    </select>
                                </div>
                            </div>
                            <div class="col-md-2">
                                <div class="form-group-custom">
                                    <label for="curso">Curso</label>
                                    <input
                                        type="number"
                                        id="curso"
                                        class="form-control-custom text-end"
                                        bind:value={salesForm.curso}
                                        required
                                    />
                                </div>
                            </div>
                            <div class="col-md-2">
                                <div class="form-group-custom">
                                    <label for="idcurso">Ident (Letra)</label>
                                    <input
                                        type="text"
                                        id="idcurso"
                                        class="form-control-custom text-center"
                                        style="text-transform: uppercase;"
                                        bind:value={salesForm.idcurso}
                                        maxlength="5"
                                        placeholder="Ej: A"
                                    />
                                </div>
                            </div>
                            <div class="col-md-2">
                                <div class="form-group-custom">
                                    <label for="nroalumno">Nro Alumnos</label>
                                    <input
                                        type="number"
                                        id="nroalumno"
                                        class="form-control-custom text-end"
                                        bind:value={salesForm.nroalumno}
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <!-- Sección Programa -->
                        <div class="section-title mb-4 mt-2">
                            Programa y Valores
                        </div>
                        <div class="row g-2 mb-3">
                            <div class="col-md-4">
                                <div class="form-group-custom">
                                    <label for="programa_id">Programa</label>
                                    <select
                                        id="programa_id"
                                        class="form-select-custom"
                                        bind:value={salesForm.programa_id}
                                        required
                                    >
                                        <option value="0">Seleccionar</option>
                                        {#each programs as program}
                                            <option value={String(program.id)}
                                                >{program.name}</option
                                            >
                                        {/each}
                                    </select>
                                </div>
                            </div>
                            <div class="col-md-2">
                                <div class="form-group-custom">
                                    <label for="vprograma">Valor Programa</label
                                    >
                                    <input
                                        type="text"
                                        id="vprograma"
                                        class="form-control-custom text-end"
                                        value={formatCurrency(
                                            salesForm.subtotal,
                                        )}
                                        readonly
                                    />
                                </div>
                            </div>
                            <div class="col-md-2">
                                <div class="form-group-custom">
                                    <label for="descm">Descuento</label>
                                    <input
                                        type="number"
                                        id="descm"
                                        class="form-control-custom text-end"
                                        bind:value={salesForm.descm}
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
                                        value={formatCurrency(
                                            totalAmount == 0
                                                ? salesForm.subtotal
                                                : totalAmount,
                                        )}
                                        readonly
                                    />
                                </div>
                            </div>
                            <div class="col-md-2">
                                <div class="form-group-custom">
                                    <label for="liberados">Liberados</label>
                                    <input
                                        type="text"
                                        id="liberados"
                                        class="form-control-custom text-end fw-bold text-primary"
                                        bind:value={salesForm.liberados}
                                        readonly
                                    />
                                </div>
                            </div>
                        </div>

                        <!-- Sección Fechas y Pagos -->
                        <div class="section-title mb-4 mt-2">
                            Logística y Pagos
                        </div>
                        <div class="row g-2 mb-3">
                            <div class="col-md-2">
                                <div class="form-group-custom">
                                    <label for="cuotas">Nro Cuotas</label>
                                    <input
                                        type="number"
                                        id="cuotas"
                                        class="form-control-custom text-end"
                                        bind:value={salesForm.cuotas}
                                    />
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="form-group-custom">
                                    <label for="fechacuota"
                                        >Fecha Inicio Cobro</label
                                    >
                                    <input
                                        type="date"
                                        id="fechacuota"
                                        bind:value={salesForm.fechacuota}
                                        min={dayjs().format("YYYY-MM-DD")}
                                        class="form-control-custom"
                                    />
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="form-group-custom">
                                    <label for="fechasalida">Fecha Salida</label
                                    >
                                    <input
                                        type="date"
                                        id="fechasalida"
                                        bind:value={salesForm.fechasalida}
                                        class="form-control-custom"
                                    />
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="form-group-custom">
                                    <label for="fecha_ultpag"
                                        >Fecha Fin Pagos</label
                                    >
                                    <input
                                        type="date"
                                        id="fecha_ultpag"
                                        bind:value={salesForm.fecha_ultpag}
                                        class="form-control-custom"
                                    />
                                </div>
                            </div>
                            <div class="col-md-1">
                                <div class="form-group-custom">
                                    <label for="comision">% Com.</label>
                                    <input
                                        type="number"
                                        id="comision"
                                        class="form-control-custom text-end"
                                        bind:value={salesForm.comision}
                                    />
                                </div>
                            </div>
                        </div>

                        <!-- Sección Coordinación -->
                        <div class="section-title mb-4 mt-2">
                            Coordinación y Contacto
                        </div>
                        <div class="row g-2 mb-3">
                            <div class="col-md-4">
                                <div class="form-group-custom">
                                    <label for="encargado"
                                        >Coordinador / Encargado</label
                                    >
                                    <input
                                        type="text"
                                        id="encargado"
                                        class="form-control-custom"
                                        bind:value={salesForm.encargado}
                                        required
                                    />
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="form-group-custom">
                                    <label for="correo_encargado"
                                        >Correo Coordinador</label
                                    >
                                    <input
                                        type="email"
                                        id="correo_encargado"
                                        class="form-control-custom"
                                        bind:value={salesForm.correo_encargado}
                                        required
                                    />
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="form-group-custom">
                                    <label for="state">Estado de la Venta</label
                                    >
                                    <select
                                        id="state"
                                        class="form-select-custom"
                                        bind:value={salesForm.state}
                                        required
                                    >
                                        <option value="">Seleccionar</option>
                                        <option value="V">Venta</option>
                                        <option value="F">Cerrado</option>
                                        <option value="R">Rechazado</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div class="row g-2 mb-3">
                            <div class="col-md-8">
                                <div class="form-group-custom">
                                    <label for="obs">Observaciones</label>
                                    <textarea
                                        id="obs"
                                        bind:value={salesForm.obs}
                                        class="form-control-custom"
                                        rows="3"
                                    ></textarea>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="row g-2 align-items-end">
                                    <div class="col-md-7">
                                        <div class="form-group-custom">
                                            <label for="accesscode"
                                                >Código Ingreso</label
                                            >
                                            <input
                                                type="text"
                                                id="accesscode"
                                                class="form-control-custom fw-bold"
                                                bind:value={
                                                    salesForm.accesscode
                                                }
                                                required
                                                maxlength="12"
                                                minlength="6"
                                            />
                                        </div>
                                    </div>
                                    <div class="col-md-5">
                                        <button
                                            type="button"
                                            class="btn btn-secondary w-100"
                                            on:click={generateCode}
                                        >
                                            <i class="fa fa-gears"></i> Generar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    {:else if salesForm.type_sale === "VG"}
                        <!-- Sección Información General -->
                        <div class="section-title mb-4">
                            Información de la Venta (Viaje Grupal)
                        </div>
                        <div class="row g-2 mb-3">
                            <div class="col-md-3">
                                <div class="form-group-custom">
                                    <label for="quote_id_vg"
                                        >Desde Cotización</label
                                    >
                                    <select
                                        id="quote_id_vg"
                                        class="form-select-custom"
                                        bind:value={salesForm.quote_id}
                                    >
                                        <option value="0">Seleccionar</option>
                                        {#each filteredQuotes as quote}
                                            <option value={quote.id}
                                                >{quote.id}</option
                                            >
                                        {/each}
                                    </select>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="form-group-custom">
                                    <label for="fecha_vg">Fecha Contrato</label>
                                    <input
                                        type="date"
                                        id="fecha_vg"
                                        bind:value={salesForm.fecha}
                                        class="form-control-custom"
                                        required
                                    />
                                </div>
                            </div>
                            <div class="col-md-2">
                                <div class="form-group-custom">
                                    <label for="tipocambio_vg"
                                        >Tipo Cambio</label
                                    >
                                    <input
                                        type="number"
                                        id="tipocambio_vg"
                                        step="0.01"
                                        class="form-control-custom text-end"
                                        bind:value={salesForm.tipocambio}
                                        required
                                    />
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="form-group-custom">
                                    <label for="seller_id_vg">Vendedor</label>
                                    <select
                                        id="seller_id_vg"
                                        class="form-select-custom"
                                        bind:value={salesForm.seller_id}
                                        required
                                    >
                                        <option value="0">Seleccionar</option>
                                        {#each filteredSellers as seller}
                                            <option value={String(seller.id)}
                                                >{seller.name}</option
                                            >
                                        {/each}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <!-- Sección Programa y Valores -->
                        <div class="section-title mb-4 mt-2">
                            Programa y Valores
                        </div>
                        <div class="row g-2 mb-3">
                            <div class="col-md-2">
                                <div class="form-group-custom">
                                    <label for="programa_id_vg">Programa</label>
                                    <select
                                        id="programa_id_vg"
                                        class="form-select-custom"
                                        bind:value={salesForm.programa_id}
                                        required
                                    >
                                        <option value="0">Seleccionar</option>
                                        {#each programs as program}
                                            <option value={String(program.id)}
                                                >{program.name}</option
                                            >
                                        {/each}
                                    </select>
                                </div>
                            </div>
                            <div class="col-md-2">
                                <div class="form-group-custom">
                                    <label for="nroalumno_vg"
                                        >Nro Pasajeros</label
                                    >
                                    <input
                                        type="number"
                                        id="nroalumno_vg"
                                        class="form-control-custom text-end"
                                        bind:value={salesForm.nroalumno}
                                        required
                                    />
                                </div>
                            </div>
                            <div class="col-md-2">
                                <div class="form-group-custom">
                                    <label for="vprograma_vg"
                                        >Valor Programa</label
                                    >
                                    <input
                                        type="text"
                                        id="vprograma_vg"
                                        class="form-control-custom text-end"
                                        value={formatCurrency(
                                            salesForm.subtotal,
                                        )}
                                        readonly
                                    />
                                </div>
                            </div>
                            <div class="col-md-2">
                                <div class="form-group-custom">
                                    <label for="descm_vg">Descuento</label>
                                    <input
                                        type="number"
                                        id="descm_vg"
                                        class="form-control-custom text-end"
                                        bind:value={salesForm.descm}
                                    />
                                </div>
                            </div>
                            <div class="col-md-2">
                                <div class="form-group-custom">
                                    <label for="total_vg">Total</label>
                                    <input
                                        type="text"
                                        id="total_vg"
                                        class="form-control-custom text-end fw-bold text-primary"
                                        value={formatCurrency(
                                            totalAmount == 0
                                                ? salesForm.subtotal
                                                : totalAmount,
                                        )}
                                        readonly
                                    />
                                </div>
                            </div>
                            <div class="col-md-2">
                                <div class="form-group-custom">
                                    <label for="liberados_vg">Liberados</label>
                                    <input
                                        type="number"
                                        id="liberados_vg"
                                        class="form-control-custom text-end fw-bold text-primary"
                                        bind:value={salesForm.liberados}
                                        readonly
                                    />
                                </div>
                            </div>
                        </div>

                        <!-- Sección Logística -->
                        <div class="section-title mb-4 mt-2">
                            Logística y Pagos
                        </div>
                        <div class="row g-2 mb-3">
                            <div class="col-md-1">
                                <div class="form-group-custom">
                                    <label for="cuotas_vg">Cuotas</label>
                                    <input
                                        type="number"
                                        id="cuotas_vg"
                                        class="form-control-custom text-end"
                                        bind:value={salesForm.cuotas}
                                    />
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="form-group-custom">
                                    <label for="fechacuota_vg"
                                        >Inicio Cobro</label
                                    >
                                    <input
                                        type="date"
                                        id="fechacuota_vg"
                                        bind:value={salesForm.fechacuota}
                                        class="form-control-custom"
                                    />
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="form-group-custom">
                                    <label for="fechasalida_vg"
                                        >Fecha Salida</label
                                    >
                                    <input
                                        type="date"
                                        id="fechasalida_vg"
                                        bind:value={salesForm.fechasalida}
                                        class="form-control-custom"
                                    />
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="form-group-custom">
                                    <label for="fecha_ultpag_vg"
                                        >Fin Pagos</label
                                    >
                                    <input
                                        type="date"
                                        id="fecha_ultpag_vg"
                                        bind:value={salesForm.fecha_ultpag}
                                        class="form-control-custom"
                                    />
                                </div>
                            </div>
                            <div class="col-md-2">
                                <div class="form-group-custom">
                                    <label for="comision_vg">% Comisión</label>
                                    <input
                                        type="number"
                                        id="comision_vg"
                                        class="form-control-custom text-end"
                                        bind:value={salesForm.comision}
                                    />
                                </div>
                            </div>
                        </div>

                        <!-- Sección Coordinación -->
                        <div class="section-title mb-4 mt-2">
                            Coordinación y Contacto
                        </div>
                        <div class="row g-2 mb-3">
                            <div class="col-md-4">
                                <div class="form-group-custom">
                                    <label for="encargado_vg">Coordinador</label
                                    >
                                    <input
                                        type="text"
                                        id="encargado_vg"
                                        class="form-control-custom"
                                        bind:value={salesForm.encargado}
                                        required
                                    />
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="form-group-custom">
                                    <label for="correo_encargado_vg"
                                        >Correo</label
                                    >
                                    <input
                                        type="email"
                                        id="correo_encargado_vg"
                                        class="form-control-custom"
                                        bind:value={salesForm.correo_encargado}
                                        required
                                    />
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="form-group-custom">
                                    <label for="state_vg">Estado</label>
                                    <select
                                        id="state_vg"
                                        class="form-select-custom"
                                        bind:value={salesForm.state}
                                        required
                                    >
                                        <option value="">Seleccionar</option>
                                        <option value="V">Venta</option>
                                        <option value="F">Cerrado</option>
                                        <option value="R">Rechazado</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div class="row g-2 mb-3">
                            <div class="col-md-8">
                                <div class="form-group-custom">
                                    <label for="obs_vg">Observaciones</label>
                                    <textarea
                                        id="obs_vg"
                                        bind:value={salesForm.obs}
                                        class="form-control-custom"
                                        rows="3"
                                    ></textarea>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="row g-2 align-items-end">
                                    <div class="col-md-7">
                                        <div class="form-group-custom">
                                            <label for="accesscode_vg"
                                                >Código Ingreso</label
                                            >
                                            <input
                                                type="text"
                                                id="accesscode_vg"
                                                class="form-control-custom fw-bold"
                                                bind:value={
                                                    salesForm.accesscode
                                                }
                                                required
                                                maxlength="12"
                                                minlength="6"
                                            />
                                        </div>
                                    </div>
                                    <div class="col-md-5">
                                        <button
                                            type="button"
                                            class="btn btn-secondary w-100"
                                            on:click={generateCode}
                                        >
                                            <i class="fa fa-gears"></i> Generar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    {/if}

                    <div class="form-actions border-top pt-4">
                        <button type="submit" class="btn btn-save">
                            <i class="fa fa-save"></i> Guardar Venta
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

{#if showDeleteModal && saleToDelete}
    <div class="modal-backdrop fade show"></div>
    <div class="modal show d-block" tabindex="-1">
        <div class="modal-dialog modal-sm modal-dialog-centered">
            <div class="modal-content border-0 shadow">
                <div class="modal-header bg-danger text-white border-0">
                    <h5 class="modal-title">Anular Venta</h5>
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
                        Estás por anular la venta de
                        <span
                            class="badge {saleToDelete.type_sale === 'GE'
                                ? 'bg-primary text-white'
                                : 'bg-info text-white'}"
                        >
                            {saleToDelete.type_sale === "GE"
                                ? "Gira de Estudio"
                                : "Viaje Grupal"}
                        </span>
                    </p>
                    <p class="mb-0">
                        ¿Confirmas anular la venta <strong
                            >{saleToDelete.identificador}</strong
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

{#if showPassengersPdf}
    <PasajerosPdf
        id={selectedSaleId}
        onClose={() => {
            showPassengersPdf = false;
            selectedSaleId = null;
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
    :global(.datatable-table td:nth-child(6)),
    :global(.datatable-table td:nth-child(8)) {
        white-space: nowrap;
    }

    :global(.datatable-table td:nth-child(14)) {
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
