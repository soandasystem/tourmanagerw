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

    const userData = secureStorage.getItem("_us_");
    const schemaName = userData.schema;
    const author = userData.username;
    const CompanyId = userData.company;
    const rol = userData.rol_id;
    const saleId = userData.sale;

    const getInitialForm = () => ({
        id: null,
        fecha: dayjs().format("YYYY-MM-DD"),
        nroventa: "",
        rutapoderado: "",
        nombreapoderado: "",
        rutalumno: "",
        nombrealumno: "",
        vviaje: "",
        vsaldo: "",
        reserva: true,
        fpago: "",
        voucher: "",
        apagar: "",
        passenger_id: null,
        sale_id: null,
    });

    let entryForm = getInitialForm();

    function openCreateForm() {
        entryForm = getInitialForm();
        isEditing = false;
        viewMode = "form";
    }

    const fetchSaleData = () => {
        if (!entryForm.nroventa) return;
        const sale = sales.find(
            (s) =>
                s.id == entryForm.nroventa || s.nroventa == entryForm.nroventa,
        );
        if (sale) {
            entryForm.vviaje = sale.vprograma || 0;
            entryForm.sale_id = sale.id;
        } else {
            Swal.fire(
                "Aviso",
                "No se encontró la venta con Nro " + entryForm.nroventa,
                "info",
            );
        }
    };

    const calculateBalance = async (passengerId) => {
        const instRes = await api.getData(
            "installment",
            "",
            `passenger_id=${passengerId}&company_id=${CompanyId}`,
            "",
            schemaName,
        );
        if (instRes.status === "success" && instRes.data) {
            let saldo = 0;
            let viaje = 0;
            const installments = Array.isArray(instRes.data)
                ? instRes.data
                : [instRes.data];
            installments.forEach((i) => {
                saldo += parseFloat(i.balance || 0);
                viaje += parseFloat(i.amount || 0);
            });
            entryForm.vsaldo = saldo;
            if (!entryForm.vviaje || entryForm.vviaje == 0) {
                entryForm.vviaje = viaje;
            }
        }
    };

    const fetchByApoderado = async () => {
        if (!entryForm.rutapoderado) return;
        try {
            const res = await api.getData(
                "curso",
                "",
                `rutapod=${entryForm.rutapoderado}`,
                "",
                schemaName,
            );
            if (res.status === "success" && res.data && res.data.length > 0) {
                const pass = res.data[0]; // Toma el primer estudiante asociado
                entryForm.nombreapoderado = pass.nombreapod;
                entryForm.rutalumno = pass.rutalumno;
                entryForm.nombrealumno = pass.nombrealumno;
                entryForm.passenger_id = pass.id;
                if (!entryForm.nroventa) entryForm.nroventa = pass.sale_id;

                await calculateBalance(pass.id);
            } else {
                Swal.fire(
                    "Aviso",
                    "No se encontró información en el curso para el apoderado " +
                        entryForm.rutapoderado,
                    "info",
                );
            }
        } catch (error) {
            console.error("Error buscando apoderado:", error);
        }
    };

    const fetchByAlumno = async () => {
        if (!entryForm.rutalumno) return;
        try {
            const res = await api.getData(
                "curso",
                "",
                `rutalumno=${entryForm.rutalumno}`,
                "",
                schemaName,
            );
            if (res.status === "success" && res.data && res.data.length > 0) {
                const pass = res.data[0];
                entryForm.rutapoderado = pass.rutapod;
                entryForm.nombreapoderado = pass.nombreapod;
                entryForm.nombrealumno = pass.nombrealumno;
                entryForm.passenger_id = pass.id;
                if (!entryForm.nroventa) entryForm.nroventa = pass.sale_id;

                await calculateBalance(pass.id);
            } else {
                Swal.fire(
                    "Aviso",
                    "No se encontró información en el curso para el alumno " +
                        entryForm.rutalumno,
                    "info",
                );
            }
        } catch (error) {
            console.error("Error buscando alumno:", error);
        }
    };

    async function saveEntry() {
        if (!entryForm.passenger_id) {
            Swal.fire(
                "Error",
                "Debe buscar un pasajero válido antes de grabar.",
                "error",
            );
            return;
        }

        const apagar = parseFloat(entryForm.apagar);
        if (isNaN(apagar) || apagar <= 0) {
            Swal.fire("Error", "El valor a pagar debe ser mayor a 0.", "error");
            return;
        }

        try {
            // 1. Crear el pago en payments
            const paymentPayload = {
                passenger_id: Number(entryForm.passenger_id),
                amount: apagar,
                payment_method: entryForm.fpago,
                payment_date:
                    dayjs(entryForm.fecha).format("YYYY-MM-DD") + "T00:00:00Z",
                identifier: entryForm.voucher || "",
                notes: entryForm.reserva ? "Pago Reserva" : "",
                company_id: Number(CompanyId),
                sale_id: Number(entryForm.nroventa),
                transaction_ref: "",
                transaction_type: "IN",
                card_number: "",
                auth_code: "",
                auth_date:
                    dayjs(entryForm.fecha).format("YYYY-MM-DD") + "T00:00:00Z",
                peyment_token: "",
            };

            const paymentRes = await api.setData(
                "payment",
                paymentPayload,
                "",
                "",
                schemaName,
            );
            if (paymentRes.status !== "success") {
                throw new Error(
                    "No se pudo crear el pago: " + paymentRes.message,
                );
            }

            // El backend debe retornar el id en el objeto o similar. Se asume paymentRes.data.id
            const insertPayment = Array.isArray(paymentRes.data)
                ? paymentRes.data[0]
                : paymentRes.data;
            const paymentId = insertPayment.data.return_id;

            // 2. Obtener cuotas e iterar para descontar
            const instRes = await api.getData(
                "installment",
                "",
                `passenger_id=${entryForm.passenger_id}&company_id=${CompanyId}`,
                "",
                schemaName,
            );
            if (instRes.status !== "success" || !instRes.data) {
                throw new Error("No se pudieron obtener las cuotas.");
            }

            let installments = Array.isArray(instRes.data)
                ? instRes.data
                : [instRes.data];
            // Ordenar por cuota si es necesario
            installments.sort(
                (a, b) => (a.quota_number || 0) - (b.quota_number || 0),
            );

            let amountToDistribute = apagar;

            for (let i = 0; i < installments.length; i++) {
                if (amountToDistribute <= 0) break;

                let inst = installments[i];
                let balance = parseFloat(inst.balance || 0);

                if (balance > 0) {
                    let discount = Math.min(balance, amountToDistribute);

                    let newBalance = balance - discount;
                    let newPaidAmount =
                        parseFloat(inst.paid_amount || 0) + discount;
                    let newStatus = newBalance <= 0 ? "PAID" : "PARTIAL";

                    // Actualizar installment
                    await api.updateData(
                        "installment",
                        {
                            balance: newBalance,
                            paid_amount: newPaidAmount,
                            status: newStatus,
                        },
                        "",
                        inst.id,
                        schemaName,
                    );

                    // 3. Crear relación payment_installments
                    const paymentinstallmentPayLoad = {
                        payment_id: Number(paymentId),
                        installment_id: Number(inst.id),
                        applied_amount: discount,
                    };
                    console.log(
                        "paymentinstallmentPayLoad",
                        paymentinstallmentPayLoad,
                    );
                    await api.setData(
                        "payment_installment",
                        paymentinstallmentPayLoad,
                        "",
                        "",
                        schemaName,
                    );

                    amountToDistribute -= discount;
                }
            }

            Swal.fire(
                "Éxito",
                "Pago registrado y cuotas actualizadas.",
                "success",
            );
            viewMode = "list";
            fetchEntry(); // Refrescar lista de ingresos
        } catch (error) {
            Swal.fire("Error", error.message, "error");
            console.error(error);
        }
    }

    let entryToDelete = null;
    let entry = [];
    let sales = [];
    let tenant = {};

    // Mapeo dinámico para Simple-Datatables
    $: isUpdate = hasPermissionPrograms(rol, "entry", "UPDATE");
    $: isDelete = hasPermissionPrograms(rol, "entry", "DELETE");
    $: isCreate = hasPermissionPrograms(rol, "entry", "CREATE");

    $: dtData = entry.map((s) => {
        let acciones = `<div class="action-buttons-mini">`;
        if (isUpdate) {
            acciones += `<button class="btn-mini-custom edit" data-id="${s.id}" data-action="edit" title="Editar">
                <i class="fa fa-pencil"></i>
            </button>`;
        }
        if (isDelete) {
            acciones += `<button class="btn-mini-custom delete" data-id="${s.id}" data-action="delete" title="Anular">
                <i class="fa fa-ban"></i>
            </button>`;
        }
        acciones += `</div>`;
        return [
            s.id,
            s.transaction_type,
            s.payment_date
                ? dayjs(s.payment_date).format("DD/MM/YYYY")
                : "Reciente",
            s.sale_id,
            s.curso.nombrealumno,
            s.curso.nombreapod,
            s.sale.establecimiento.nombre,
            s.sale.curso + "/" + s.sale.idcurso,
            formatCurrency(s.amount),
            s.payment_method,
            s.status || (s.transaction_type === "reverse" ? "ANULADO" : "OK"),
            acciones,
        ];
    });

    let dataTableInstance = null;

    function initDataTable(node, dataConfig) {
        if (dataTableInstance) dataTableInstance.destroy();
        dataTableInstance = new DataTable(node, {
            searchable: true,
            sortable: true,
            perPage: 10,
            labels: {
                placeholder: "Buscar ingresos...",
                perPage: "por página",
                noRows: "No se encontraron ingresos",
                info: "Mostrando {start} a {end} de {rows} registros",
                noResults: "No se encontraron ingresos",
            },
            data: {
                headings: [
                    "Nro Comp",
                    "Tipo",
                    "Fecha",
                    "Nro Venta",
                    "Alumno",
                    "Apoderado",
                    "Colegio",
                    "Curso",
                    "Monto",
                    "Forma Pago",
                    "Estado",
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

    const fetchEntry = async () => {
        try {
            const res = await api.getData(
                "payment",
                "",
                `company_id=${CompanyId}`,
                "",
                schemaName,
            );
            if (res.status === "success") {
                entry = Array.isArray(res.data) ? res.data : [];
            }
        } catch (error) {
            console.error("Error fetching pagos:", error);
        }
    };

    function handleTableClick(e) {
        const target = e.target.closest("button");
        if (!target) return;
        const id = target.getAttribute("data-id");
        const action = target.getAttribute("data-action");
        if (!id || !action) return;

        if (action === "delete") {
            const payment = entry.find((p) => p.id == id);
            if (payment) {
                entryToDelete = payment;
                showDeleteModal = true;
            }
        }
    }

    async function confirmDelete() {
        if (!entryToDelete) return;
        try {
            // 1. Obtener payment_installments para saber qué cuotas restaurar
            const piRes = await api.getData(
                "payment_installments",
                "",
                `payment_id=${entryToDelete.id}`,
                "",
                schemaName,
            );
            let paymentInstallments = [];
            if (piRes.status === "success" && piRes.data) {
                paymentInstallments = Array.isArray(piRes.data)
                    ? piRes.data
                    : [piRes.data];
            }

            // 2. Crear pago de reverso
            const reversePayload = {
                ...entryToDelete,
                id: undefined, // Remover ID original
                amount: -parseFloat(entryToDelete.amount || 0),
                transaction_type: "reverse",
                notes: `Reversa del pago #${entryToDelete.id}`,
            };
            const revRes = await api.setData(
                "payments",
                reversePayload,
                "",
                "",
                schemaName,
            );
            if (revRes.status !== "success")
                throw new Error("Error creando pago de reverso");
            const reversePaymentId = revRes.data.id || revRes.data;

            // 3. Restaurar cuotas y registrar relación en negativo
            for (let pi of paymentInstallments) {
                const amountRestored = parseFloat(pi.amount || 0);

                // Obtener la cuota
                const instRes = await api.getData(
                    "installments",
                    "",
                    "",
                    pi.installment_id,
                    schemaName,
                );
                if (instRes.status === "success" && instRes.data) {
                    let inst = Array.isArray(instRes.data)
                        ? instRes.data[0]
                        : instRes.data;
                    let newBalance =
                        parseFloat(inst.balance || 0) + amountRestored;
                    let newPaidAmount =
                        parseFloat(inst.paid_amount || 0) - amountRestored;
                    let newStatus =
                        newBalance > 0
                            ? newPaidAmount > 0
                                ? "PARTIAL"
                                : "PENDING"
                            : "PAID";

                    await api.updateData(
                        "installments",
                        {
                            balance: newBalance,
                            paid_amount: newPaidAmount,
                            status: newStatus,
                        },
                        "",
                        inst.id,
                        schemaName,
                    );
                }

                // Insertar registro negativo
                await api.setData(
                    "payment_installments",
                    {
                        payment_id: reversePaymentId,
                        installment_id: pi.installment_id,
                        amount: -amountRestored,
                    },
                    "",
                    "",
                    schemaName,
                );
            }

            Swal.fire("Éxito", "Pago anulado y cuotas restauradas.", "success");
            showDeleteModal = false;
            fetchEntry();
        } catch (error) {
            Swal.fire("Error", error.message, "error");
        }
    }
    const fetchExtraData = async () => {
        try {
            const resSales = await api.getData(
                "sale",
                "",
                `company_id=${CompanyId}`,
                "",
                schemaName,
            );
            if (resSales.status === "success")
                sales = Array.isArray(resSales.data) ? resSales.data : [];
        } catch (error) {
            console.error("Error fetching extra data:", error);
        }
    };

    onMount(() => {
        fetchEntry();
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
                        <h2 class="m-0">Gestión de Ingresos</h2>
                    </div>
                    <p class="subtitle mt-1 mb-0">
                        Administra los ingresos y sus valores.
                    </p>
                </div>
                {#if hasPermissionPrograms(rol, "entry", "INSERT")}
                    <button class="btn-new" on:click={openCreateForm}>
                        <i class="fa fa-plus"></i> Nuevo Ingreso
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
        <div class="card main-card shadow-sm border-0 mb-4">
            <div class="card-header-flex p-4 border-bottom">
                <div class="title-with-icon">
                    <i
                        class="fa {isEditing
                            ? 'fa-pencil'
                            : 'fa-plus'} icon-main text-primary"
                    ></i>
                    <h2 class="m-0">
                        {isEditing ? "Editar" : "Nuevo"} Ingreso
                    </h2>
                </div>
                <button class="btn-back" on:click={() => (viewMode = "list")}>
                    <i class="fa fa-arrow-left"></i> Volver
                </button>
            </div>

            <div class="card-body p-4">
                <form on:submit|preventDefault={saveEntry}>
                    <div class="section-title mb-4">Detalle</div>

                    <div class="row g-2 mb-3">
                        <div class="col-md-2">
                            <div class="form-group-custom">
                                <label for="fecha">Fecha Ingreso</label>
                                <input
                                    type="date"
                                    id="fecha"
                                    class="form-control-custom"
                                    bind:value={entryForm.fecha}
                                    required
                                />
                            </div>
                        </div>
                        <div class="col-md-4"></div>
                        <div class="col-md-2">
                            <div class="form-group-custom">
                                <label for="nroventa">Nro Venta</label>
                                <input
                                    type="text"
                                    id="nroventa"
                                    class="form-control-custom"
                                    bind:value={entryForm.nroventa}
                                    on:blur={fetchSaleData}
                                    maxlength="20"
                                />
                            </div>
                        </div>
                    </div>

                    <div class="row g-2 mb-3">
                        <div class="col-md-2">
                            <div class="form-group-custom">
                                <label for="rutapoderado">Rut Apoderado</label>
                                <input
                                    type="text"
                                    id="rutapoderado"
                                    class="form-control-custom"
                                    bind:value={entryForm.rutapoderado}
                                    on:blur={fetchByApoderado}
                                    maxlength="20"
                                />
                            </div>
                        </div>
                        <div class="col-md-4"></div>
                        <div class="col-md-6">
                            <div class="form-group-custom">
                                <label for="nombreapoderado"
                                    >Nombre Apoderado</label
                                >
                                <input
                                    type="text"
                                    id="nombreapoderado"
                                    class="form-control-custom"
                                    bind:value={entryForm.nombreapoderado}
                                    maxlength="100"
                                    readonly
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div class="row g-2 mb-3">
                        <div class="col-md-2">
                            <div class="form-group-custom">
                                <label for="rutalumno">Rut Alumno</label>
                                <input
                                    type="text"
                                    id="rutalumno"
                                    class="form-control-custom"
                                    bind:value={entryForm.rutalumno}
                                    on:blur={fetchByAlumno}
                                    maxlength="20"
                                    required
                                />
                            </div>
                        </div>
                        <div class="col-md-4"></div>
                        <div class="col-md-6">
                            <div class="form-group-custom">
                                <label for="nombrealumno">Nombre Alumno</label>
                                <input
                                    type="text"
                                    id="nombrealumno"
                                    class="form-control-custom"
                                    bind:value={entryForm.nombrealumno}
                                    maxlength="100"
                                    readonly
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div class="row g-2 mb-3">
                        <div class="col-md-4">
                            <div class="form-group-custom">
                                <label for="vviaje">Valor Programa</label>
                                <div class="input-group-custom">
                                    <input
                                        type="text"
                                        id="vviaje"
                                        class="form-control-custom"
                                        value={formatCurrency(entryForm.vviaje)}
                                        maxlength="100"
                                        readonly
                                    />
                                </div>
                            </div>
                        </div>
                        <div class="col-md-2"></div>
                        <div class="col-md-4">
                            <div class="form-group-custom">
                                <label for="vsaldo">Saldo a Pagar</label>
                                <div class="input-group-custom">
                                    <input
                                        type="text"
                                        id="vsaldo"
                                        class="form-control-custom"
                                        value={formatCurrency(entryForm.vsaldo)}
                                        maxlength="100"
                                        readonly
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="row g-2 mb-5">
                        <div class="col-md-3">
                            <div class="form-group-custom">
                                <label for="reserva">¿Es pago Reserva?</label>
                                <div class="d-flex align-items-center mt-2">
                                    <label class="switch-container">
                                        <input
                                            type="checkbox"
                                            id="reserva"
                                            bind:checked={entryForm.reserva}
                                        />
                                        <span class="slider round"></span>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="form-group-custom">
                                <label for="fpago">Forma de Pago</label>
                                <select
                                    id="fpago"
                                    class="form-select-custom"
                                    bind:value={entryForm.fpago}
                                    required
                                >
                                    <option value="">Seleccionar</option>
                                    {#each Object.entries( { EF: "Efectivo", CH: "Cheque", TC: "Tarj. Crédito", TR: "Transferencia", IN: "Ingreso", VO: "Voucher", FW: "Flow" }, ) as [key, value]}
                                        <option value={key}>{value}</option>
                                    {/each}
                                </select>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="form-group-custom">
                                <label for="voucher">Nro Docto</label>
                                <input
                                    type="text"
                                    id="voucher"
                                    class="form-control-custom text-end"
                                    bind:value={entryForm.voucher}
                                    maxlength="10"
                                />
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="form-group-custom">
                                <label for="apagar">Valor</label>
                                <div class="input-group-custom">
                                    <span class="input-prefix">$</span>
                                    <input
                                        type="number"
                                        id="apagar"
                                        class="form-control-custom text-end"
                                        bind:value={entryForm.apagar}
                                        maxlength="10"
                                        required
                                    />
                                </div>
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

<!-- Modal de Anulación -->
{#if showDeleteModal && entryToDelete}
    <div class="modal-backdrop fade show"></div>
    <div class="modal show d-block" tabindex="-1">
        <div class="modal-dialog modal-sm modal-dialog-centered">
            <div class="modal-content border-0 shadow">
                <div class="modal-header bg-danger text-white border-0">
                    <h5 class="modal-title">Anular Ingreso</h5>
                    <button
                        type="button"
                        title="anular"
                        class="btn-close btn-close-white"
                        on:click={() => (showDeleteModal = false)}
                    ></button>
                </div>
                <div class="modal-body text-center p-4">
                    <i class="fa fa-warning fa-3x text-danger mb-3"></i>
                    <p class="mb-0">
                        ¿Estás seguro de anular el ingreso <strong
                            >Nro {entryToDelete.id}</strong
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
    /* Ancho Columnas */
    :global(.datatable-table td:nth-child(2)),
    :global(.datatable-table td:nth-child(5)),
    :global(.datatable-table td:nth-child(6)),
    :global(.datatable-table td:nth-child(7)),
    :global(.datatable-table td:nth-child(8)) {
        white-space: nowrap;
    }

    :global(.datatable-table td:nth-child(1)),
    :global(.datatable-table td:nth-child(4)) {
        min-width: 100px;
        white-space: nowrap;
    }
    :global(.datatable-table td:nth-child(10)) {
        min-width: 120px;
        white-space: nowrap;
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
