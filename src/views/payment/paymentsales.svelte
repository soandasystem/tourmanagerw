<script>
    import { onMount } from "svelte";
    import { fade } from "svelte/transition";
    import { navigate } from "svelte-routing";
    import { secureStorage } from "../../lib/secureStore";
    import { tenantStore } from "../../stores/tenant";
    import dayjs from "dayjs";
    import api from "../../lib/apis.js";
    import Swal from "sweetalert2";
    import { formatCurrency } from "../../lib/utils";

    // Props recibidos desde el router: 'single' = 1 cuota, 'multi' = varias cuotas
    export let mode = "single"; // "single" | "multi"

    $: idcl = $tenantStore;

    const userData = secureStorage.getItem("_us_") || {};
    const saleId = userData.sale || 0;
    const companyId = userData.company || 0;
    const schema = userData.schema || "";
    const passengerCursoId = userData.id || 0;

    let loading = true;
    let submitting = false;
    let voucher = "";
    // Monto ingresado para el pago online (no puede superar la deuda pendiente)
    let apagarInput = 0;


    // Datos de la venta
    let saleData = {};
    let gatewaysc = [];

    // Modo cuota única: saldo total a pagar
    let totalAPagar = 0;
    let totalVpagar = 0;
    let totalPagado = 0;

    // Modo multi-cuota: lista de cuotas pendientes
    /** @type {any[]} */
    let cuotasPendientes = [];
    /** @type {number|null} */
    let selectedInstallmentId = null;
    let selectedInstallmentAmount = 0;

    $: isSingle = mode === "single";
    $: apagar = isSingle ? totalAPagar : selectedInstallmentAmount;

    // ─────────────────────────────────────────────────────
    //  CARGA DE DATOS
    // ─────────────────────────────────────────────────────
    const fetchData = async () => {
        try {
            loading = true;

            // 1. Datos de la venta
            const saleRes = await api.getData(
                "sale/informe",
                "",
                `id=${saleId}`,
                "",
                schema,
            );
            if (
                saleRes.status === "success" &&
                Array.isArray(saleRes.data) &&
                saleRes.data.length > 0
            ) {
                saleData = saleRes.data[0];
            }

            // 2. Cuotas del pasajero
            const instRes = await api.getData(
                "installment",
                "",
                `sale_id=${saleId}&passenger_id=${passengerCursoId}&company_id=${companyId}`,
                "",
                schema,
            );

            if (
                instRes.status === "success" &&
                Array.isArray(instRes.data) &&
                instRes.data.length > 0
            ) {
                if (isSingle) {
                    // Cuota única: tomar la primera (o la única)
                    const inst = instRes.data[0];
                    totalVpagar = Number(inst.amount || 0);
                    totalPagado = Number(inst.paid_amount || 0);
                    totalAPagar = Number(inst.balance || 0);
                } else {
                    // Multi-cuota: filtrar solo las que tienen saldo > 0
                    cuotasPendientes = instRes.data.filter(
                        (inst) => Number(inst.balance || 0) > 0,
                    );
                    // Pre-seleccionar la primera cuota pendiente
                    if (cuotasPendientes.length > 0) {
                        selectedInstallmentId = cuotasPendientes[0].id;
                        selectedInstallmentAmount = Number(
                            cuotasPendientes[0].balance || 0,
                        );
                    }
                }
            }

            // 3. Gateways activos para la compañía
            const gwRes = await api.getData("gatewaysc", "", "", "", "global");
            if (gwRes.status === "success") {
                const items = Array.isArray(gwRes.data) ? gwRes.data : [];
                const activeGateways = [];
                for (const item of items) {
                    const resExist = await api.getData(
                        "gateways",
                        "",
                        `company_id=${companyId}&gateway_id=${item.id}`,
                        "",
                        schema,
                    );
                    if (
                        resExist.status === "success" &&
                        resExist.data &&
                        resExist.data.length > 0
                    ) {
                        activeGateways.push(item);
                    }
                }
                gatewaysc = activeGateways;
            }
        } catch (e) {
            console.error(e);
            Swal.fire("Error", "No se pudo cargar la información de pago.", "error");
        } finally {
            loading = false;
        }
    };

    onMount(fetchData);

    // ─────────────────────────────────────────────────────
    //  SELECCIÓN DE CUOTA (modo multi)
    // ─────────────────────────────────────────────────────
    function selectInstallment(inst) {
        selectedInstallmentId = inst.id;
        selectedInstallmentAmount = Number(inst.balance || 0);
    }

    // ─────────────────────────────────────────────────────
    //  HELPERS
    // ─────────────────────────────────────────────────────
    function getGatewayImage(gw) {
        if (!gw || !gw.gateway_image) return "/assets/logo-mercadopago.png";
        if (gw.gateway_image.startsWith("http")) return gw.gateway_image;
        if (gw.gateway_image.startsWith("/")) return gw.gateway_image;
        if (gw.gateway_image.startsWith("assets/")) return "/" + gw.gateway_image;
        return `/assets/${gw.gateway_image}`;
    }

    function getInstallmentLabel(inst, idx) {
        if (inst.due_date) {
            return `Cuota ${idx + 1} — Vence ${dayjs(inst.due_date).format("DD/MM/YYYY")}`;
        }
        return `Cuota ${idx + 1}`;
    }

    // ─────────────────────────────────────────────────────
    //  PAGO CON VOUCHER
    // ─────────────────────────────────────────────────────
    async function handleVoucherSubmit(event) {
        event.preventDefault();

        const montoAPagar = apagar;
        const installmentId = isSingle
            ? null // se resolverá dentro
            : selectedInstallmentId;

        if (!isSingle && !installmentId) {
            Swal.fire("Atención", "Selecciona una cuota pendiente para pagar.", "warning");
            return;
        }
        if (montoAPagar <= 0) {
            Swal.fire("Atención", "El saldo a pagar es $0. No hay monto pendiente.", "info");
            return;
        }

        try {
            submitting = true;
            Swal.fire({
                title: "Procesando...",
                text: "Validando el comprobante de pago",
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading(),
            });

            // 1. Validar voucher
            const nro_voucher = voucher.trim();
            const responseVoucher = await api.getData(
                "voucher",
                "",
                `voucher=${nro_voucher}&sale_id=${saleId}&used=0`,
                "",
                schema,
            );

            if (
                responseVoucher.status !== "success" ||
                !responseVoucher.data ||
                responseVoucher.data.length === 0
            ) {
                Swal.fire(
                    "Comprobante no válido",
                    "El número de comprobante ingresado no es válido o ya fue utilizado.",
                    "error",
                );
                return;
            }

            const voucherData = responseVoucher.data[0];

            // 2. Verificar si ya existe un pago con ese voucher
            const responsePago = await api.getData(
                "payment",
                "",
                `identifier=${nro_voucher}&sale_id=${saleId}`,
                "",
                schema,
            );
            const existe_pago = responsePago.data || [];
            if (Array.isArray(existe_pago) && existe_pago.length > 0) {
                Swal.fire(
                    "Comprobante ya utilizado",
                    "Este número de comprobante ya ha sido ingresado en el sistema.",
                    "warning",
                );
                return;
            }

            // 3. Registrar pago
            const fechaActual = dayjs().format("YYYY-MM-DD");
            const paymentData = {
                passenger_id: Number(passengerCursoId),
                amount: Number(montoAPagar),
                payment_method: "Voucher",
                payment_date: fechaActual + "T00:00:00Z",
                identifier: nro_voucher,
                notes: "",
                transaction_ref: "",
                transaction_type: "IN",
                card_number: "",
                auth_code: "",
                auth_date: fechaActual + "T00:00:00Z",
                peyment_token: "",
                company_id: Number(companyId),
                sale_id: Number(saleId),
            };

            const ResinsertPayment = await api.setData(
                "payment",
                JSON.stringify(paymentData),
                "",
                "",
                schema,
            );
            if (ResinsertPayment.status !== "success") {
                throw new Error("Error al registrar el pago: " + ResinsertPayment.message);
            }

            const insertPayment = Array.isArray(ResinsertPayment.data)
                ? ResinsertPayment.data[0]
                : ResinsertPayment.data;
            const paymentId = insertPayment?.data?.return_id;

            // 4. Actualizar installment
            let instIdToUpdate = installmentId;
            if (isSingle) {
                // Obtener la cuota única
                const instRes = await api.getData(
                    "installment",
                    "",
                    `sale_id=${saleId}&passenger_id=${passengerCursoId}&company_id=${companyId}`,
                    "",
                    schema,
                );
                if (
                    instRes.status === "success" &&
                    Array.isArray(instRes.data) &&
                    instRes.data.length > 0
                ) {
                    instIdToUpdate = instRes.data[0].id;
                }
            }

            if (instIdToUpdate) {
                // Buscar la cuota para calcular nuevo saldo
                const allInstRes = await api.getData(
                    "installment",
                    "",
                    `sale_id=${saleId}&passenger_id=${passengerCursoId}&company_id=${companyId}`,
                    "",
                    schema,
                );
                const allInst = Array.isArray(allInstRes.data) ? allInstRes.data : [];
                const inst = allInst.find((i) => Number(i.id) === Number(instIdToUpdate));

                if (inst) {
                    const newPaid = Number(inst.paid_amount || 0) + Number(montoAPagar);
                    const newBalance = Number(inst.balance || 0) - Number(montoAPagar);
                    await api.updateData(
                        "installment",
                        JSON.stringify({ paid_amount: newPaid, balance: Math.max(0, newBalance) }),
                        "",
                        inst.id,
                        schema,
                    );

                    // 5. Vincular pago con cuota
                    if (paymentId) {
                        await api.setData(
                            "payment_installment",
                            JSON.stringify({
                                payment_id: Number(paymentId),
                                installment_id: Number(inst.id),
                                applied_amount: Number(montoAPagar),
                            }),
                            "",
                            "",
                            schema,
                        );
                    }
                }
            }

            // 6. Marcar voucher como usado
            await api.updateData(
                "voucher",
                JSON.stringify({ used: 1 }),
                "",
                voucherData.id,
                schema,
            );

            Swal.fire({
                title: "¡Pago Registrado!",
                text: "El comprobante de pago ha sido validado y procesado correctamente.",
                icon: "success",
            }).then(() => {
                navigate(`/${idcl}/payment`);
            });
        } catch (error) {
            console.error("Error al procesar el voucher:", error);
            Swal.fire({
                title: "Error",
                text: error.message || "Ocurrió un error inesperado al validar el comprobante.",
                icon: "error",
            });
        } finally {
            submitting = false;
        }
    }
</script>

<div class="page-wrapper" in:fade={{ duration: 300 }}>
    <div class="card main-card shadow-sm border-0">
        <!-- Header -->
        <div
            class="card-header-flex p-4 border-bottom d-flex align-items-center justify-content-between flex-wrap gap-3"
        >
            <div class="d-flex align-items-center gap-3">
                <i class="fa fa-credit-card text-primary fa-lg"></i>
                <h3 class="m-0 text-dark fw-bold header-title">
                    {isSingle ? "Pago de Saldo Pendiente" : "Pago de Cuotas"}
                </h3>
            </div>
            <button
                type="button"
                class="btn-back"
                on:click={() => navigate(`/${idcl}/payment`)}
            >
                <i class="fa fa-chevron-left me-1"></i> Volver
            </button>
        </div>

        <!-- Body -->
        <div class="card-body p-4">
            {#if loading}
                <div class="loading-container">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                    <p class="text-muted mt-3 fw-medium">Cargando información de pago...</p>
                </div>
            {:else}
                <!-- Info de la venta -->
                {#if saleData.program_name || saleData.establecimiento_nombre}
                    <div class="sale-info-banner mb-4">
                        <div class="sale-info-item">
                            <i class="fa fa-map-signs text-primary"></i>
                            <div>
                                <span class="label">Programa</span>
                                <span class="value">{saleData.program_name || "N/A"}</span>
                            </div>
                        </div>
                        <div class="sale-info-item">
                            <i class="fa fa-university text-primary"></i>
                            <div>
                                <span class="label">Colegio</span>
                                <span class="value">{saleData.establecimiento_nombre || "N/A"}</span>
                            </div>
                        </div>
                        <div class="sale-info-item">
                            <i class="fa fa-plane text-primary"></i>
                            <div>
                                <span class="label">Fecha de Salida</span>
                                <span class="value">
                                    {saleData.fechasalida
                                        ? dayjs(saleData.fechasalida).format("DD/MM/YYYY")
                                        : "N/A"}
                                </span>
                            </div>
                        </div>
                    </div>
                {/if}

                <div class="row g-4">
                    <!-- ══════════ COLUMNA IZQUIERDA: Monto ══════════ -->
                    <div class="col-md-5">

                        {#if isSingle}
                            <!-- MODO CUOTA ÚNICA: saldo pendiente -->
                            <div class="payment-detail-card p-4 rounded-4 mb-4">
                                <h5 class="fw-bold mb-3 text-dark">
                                    <i class="fa fa-money text-success me-2"></i>
                                    Resumen de Saldo
                                </h5>
                                <div class="detail-row py-3 border-bottom d-flex justify-content-between align-items-center">
                                    <span class="text-muted fw-medium">Valor Total del Viaje</span>
                                    <span class="price-value fw-bold text-dark">{formatCurrency(totalVpagar)}</span>
                                </div>
                                <div class="detail-row py-3 border-bottom d-flex justify-content-between align-items-center">
                                    <span class="text-muted fw-medium">Total Abonado</span>
                                    <span class="price-value fw-bold text-success">{formatCurrency(totalPagado)}</span>
                                </div>
                                <div class="detail-row py-3 d-flex justify-content-between align-items-center">
                                    <span class="text-dark fw-bold">Saldo Pendiente</span>
                                    <span class="price-total fw-bold text-primary">
                                        {formatCurrency(totalAPagar)}
                                    </span>
                                </div>
                                {#if totalAPagar <= 0}
                                    <div class="alert-paid mt-3">
                                        <i class="fa fa-check-circle me-2"></i>
                                        ¡Sin deuda pendiente!
                                    </div>
                                {/if}
                            </div>

                        {:else}
                            <!-- MODO MULTI-CUOTA: listar cuotas pendientes -->
                            <div class="payment-detail-card p-4 rounded-4 mb-4">
                                <h5 class="fw-bold mb-3 text-dark">
                                    <i class="fa fa-list-ol text-primary me-2"></i>
                                    Cuotas Pendientes
                                </h5>

                                {#if cuotasPendientes.length === 0}
                                    <div class="alert-paid">
                                        <i class="fa fa-check-circle me-2"></i>
                                        No tienes cuotas pendientes.
                                    </div>
                                {:else}
                                    <p class="text-muted small mb-3">
                                        Selecciona la cuota que deseas pagar:
                                    </p>
                                    <div class="installments-list">
                                        {#each cuotasPendientes as inst, idx}
                                            <button
                                                type="button"
                                                class="installment-item {selectedInstallmentId === inst.id ? 'selected' : ''}"
                                                on:click={() => selectInstallment(inst)}
                                            >
                                                <div class="inst-left">
                                                    <div class="inst-check">
                                                        {#if selectedInstallmentId === inst.id}
                                                            <i class="fa fa-check-circle text-primary"></i>
                                                        {:else}
                                                            <i class="fa fa-circle-o text-muted"></i>
                                                        {/if}
                                                    </div>
                                                    <div>
                                                        <span class="inst-label">{getInstallmentLabel(inst, idx)}</span>
                                                        {#if inst.due_date}
                                                            <span class="inst-due text-muted">
                                                                Vto. {dayjs(inst.due_date).format("DD/MM/YYYY")}
                                                            </span>
                                                        {/if}
                                                    </div>
                                                </div>
                                                <div class="inst-right">
                                                    <span class="inst-amount">
                                                        {formatCurrency(Number(inst.balance || 0))}
                                                    </span>
                                                    <span class="inst-badge">Pendiente</span>
                                                </div>
                                            </button>
                                        {/each}
                                    </div>

                                    {#if selectedInstallmentId}
                                        <div class="selected-summary mt-3 p-3 rounded-3">
                                            <div class="d-flex justify-content-between align-items-center">
                                                <span class="fw-bold text-dark">Total a Pagar:</span>
                                                <span class="price-total fw-bold text-primary">
                                                    {formatCurrency(selectedInstallmentAmount)}
                                                </span>
                                            </div>
                                        </div>
                                    {/if}
                                {/if}
                            </div>
                        {/if}

                        <!-- Input monto a pagar -->
                        <div class="voucher-box p-4 rounded-4">
                            <h5 class="fw-bold mb-2 text-dark">
                                <i class="fa fa-money-bill-wave text-primary me-2"></i>
                                Monto a Pagar
                            </h5>
                            <p class="text-muted small mb-3">
                                Ingresa un monto que no puede ser superior a la deuda
                                pendiente.
                            </p>

                            <form
                                on:submit|preventDefault={() => {
                                    // el monto se usa en la lógica de voucher/pago
                                }}
                            >
                                <div class="form-group-custom mb-3">
                                    <label class="control-label" for="monto_apagar">
                                        Monto
                                    </label>
                                    <input
                                        type="text"
                                        id="monto_apagar"
                                        name="monto_apagar"
                                        value={apagarInput}
                                        on:input={(e) => {
                                            const raw = e.target.value || '';
                                            const num = Number(String(raw).replace(/[^0-9]/g, ''));
                                            const deuda = apagar;
                                            apagarInput = Number.isFinite(num) ? num : 0;
                                            if (apagarInput > deuda) apagarInput = deuda;
                                        }}

                                        class="form-control-custom"
                                        inputmode="numeric"
                                        placeholder="Ej: 50000"
                                        required
                                    />
                                </div>

                                <div class="d-flex gap-2">
                                    <button
                                        type="button"
                                        class="btn-save w-100 py-3"
                                        on:click={() => {
                                            apagarInput = apagar;
                                        }}
                                    >
                                        Usar deuda completa
                                    </button>
                                </div>
                            </form>
                        </div>

                    </div>

                    <!-- ══════════ COLUMNA DERECHA: Gateways ══════════ -->
                    <div class="col-md-7 border-start-md ps-md-4">
                        <h5 class="fw-bold mb-3 text-dark">
                            <i class="fa fa-globe text-primary me-2"></i>
                            Pago Online Inmediato
                        </h5>
                        <p class="text-muted mb-4">
                            Selecciona uno de los medios de pago seguros para realizar tu
                            transacción de manera automatizada.
                        </p>

                        {#if gatewaysc.length > 0 && apagar > 0}
                            <div class="row g-3">
                                {#each gatewaysc as gw}
                                    <div class="col-sm-6">
                                        <form
                                            method="post"
                                            action={gw.gateway_url}
                                            target="_blank"
                                            class="h-100"
                                        >
                                            <input type="hidden" name="mpagar" value={apagar} />
                                            <button
                                                type="submit"
                                                class="gateway-card-btn w-100 h-100 p-4 d-flex flex-column align-items-center justify-content-center text-center"
                                            >
                                                <div class="gateway-logo-wrapper mb-3 d-flex align-items-center justify-content-center">
                                                    <img
                                                        src={getGatewayImage(gw)}
                                                        alt={gw.gateway_name || gw.name || gw.gateway_type}
                                                        class="gateway-image"
                                                    />
                                                </div>
                                                <span class="gateway-name fw-bold text-dark">
                                                    {gw.gateway_name || gw.name || gw.gateway_type}
                                                </span>
                                                <div class="gateway-pay-text mt-2 d-flex align-items-center justify-content-center">
                                                    <i class="fa fa-external-link ms-1 text-primary"></i>
                                                </div>

                                            </button>
                                        </form>
                                    </div>
                                {/each}
                            </div>
                        {:else if apagar <= 0}
                            <div class="no-gateways-card p-5 text-center rounded-4 border d-flex flex-column align-items-center justify-content-center">
                                <i class="fa fa-check-circle fa-2x mb-3 text-success"></i>
                                <span class="text-muted fw-medium">
                                    {!isSingle && cuotasPendientes.length === 0
                                        ? "No tienes cuotas pendientes de pago."
                                        : "No hay saldo pendiente."}
                                </span>
                            </div>
                        {:else}
                            <div class="no-gateways-card p-5 text-center rounded-4 border d-flex flex-column align-items-center justify-content-center">
                                <i class="fa fa-info-circle fa-2x mb-3 text-secondary"></i>
                                <span class="text-muted fw-medium">
                                    No hay pasarelas de pago online habilitadas. Puede informar
                                    su comprobante al costado izquierdo.
                                </span>
                            </div>
                        {/if}
                    </div>
                </div>

                <!-- Botón volver -->
                <div class="d-flex justify-content-start border-top mt-5 pt-4">
                    <button
                        type="button"
                        class="btn-back px-4 py-2"
                        on:click={() => navigate(`/${idcl}/payment`)}
                    >
                        <i class="fa fa-chevron-left me-2"></i> Volver a Opciones
                    </button>
                </div>
            {/if}
        </div>
    </div>
</div>

<style>
    .page-wrapper {
        padding: 40px 20px;
        background-color: #f8fafc;
        min-height: 100vh;
        display: flex;
        align-items: flex-start;
        justify-content: center;
    }

    .main-card {
        max-width: 980px;
        width: 100%;
        background: white;
        border-radius: 20px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05) !important;
        overflow: hidden;
    }

    .card-header-flex {
        background-color: #ffffff;
        border-bottom: 1px solid #e2e8f0;
    }

    .header-title {
        font-size: 1.4rem;
    }

    /* Loading */
    .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 300px;
    }

    /* Sale Info Banner */
    .sale-info-banner {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        padding: 16px 20px;
    }

    .sale-info-item {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1 1 200px;
    }

    .sale-info-item i {
        font-size: 1.3rem;
        width: 24px;
        text-align: center;
    }

    .sale-info-item .label {
        display: block;
        font-size: 0.72rem;
        text-transform: uppercase;
        color: #94a3b8;
        font-weight: 600;
        letter-spacing: 0.5px;
    }

    .sale-info-item .value {
        display: block;
        font-weight: 700;
        color: #1e293b;
        font-size: 0.9rem;
    }

    /* Payment Detail Card */
    .payment-detail-card {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
    }

    .price-value {
        font-size: 1.1rem;
        color: #1e293b;
    }

    .price-total {
        font-size: 1.5rem;
        color: #4e73df !important;
        letter-spacing: -0.5px;
    }

    /* Alert Paid */
    .alert-paid {
        background: #dcfce7;
        color: #166534;
        border: 1px solid #bbf7d0;
        border-radius: 10px;
        padding: 12px 16px;
        font-weight: 600;
        font-size: 0.9rem;
        display: flex;
        align-items: center;
    }

    /* Installments List */
    .installments-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .installment-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 14px;
        border: 2px solid #e2e8f0;
        border-radius: 12px;
        background: white;
        cursor: pointer;
        transition: all 0.2s ease;
        width: 100%;
        text-align: left;
    }

    .installment-item:hover {
        border-color: #4e73df;
        background: #f8fafc;
    }

    .installment-item.selected {
        border-color: #4e73df;
        background: #eff3ff;
    }

    .inst-left {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .inst-check {
        font-size: 1.2rem;
    }

    .inst-label {
        display: block;
        font-weight: 700;
        color: #1e293b;
        font-size: 0.88rem;
    }

    .inst-due {
        display: block;
        font-size: 0.78rem;
    }

    .inst-right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 4px;
    }

    .inst-amount {
        font-weight: 800;
        color: #4e73df;
        font-size: 1rem;
    }

    .inst-badge {
        display: inline-block;
        background: #fef3c7;
        color: #92400e;
        border-radius: 20px;
        padding: 2px 8px;
        font-size: 0.7rem;
        font-weight: 600;
    }

    .selected-summary {
        background: #eff3ff;
        border: 1px solid #c7d2fe;
    }

    /* Voucher Box */
    .voucher-box {
        background-color: #fffbeb;
        border: 1px solid #fef3c7;
    }

    .form-group-custom {
        margin-bottom: 1.25rem;
    }

    .form-group-custom label,
    .control-label {
        display: block;
        font-weight: 600;
        color: #475569;
        margin-bottom: 8px;
        font-size: 0.9rem;
    }

    .form-control-custom {
        width: 100%;
        padding: 12px 15px;
        border-radius: 10px;
        border: 1px solid #cbd5e1;
        font-size: 1rem;
        transition: all 0.2s ease-in-out;
        background-color: white;
    }

    .form-control-custom:focus {
        outline: none;
        border-color: #4e73df;
        box-shadow: 0 0 0 3px rgba(78, 115, 223, 0.15);
    }

    .btn-save {
        background: #4e73df;
        color: white;
        border: none;
        border-radius: 12px;
        font-weight: 700;
        font-size: 1rem;
        padding: 12px 20px;
        transition: all 0.2s ease-in-out;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 6px rgba(78, 115, 223, 0.15);
    }

    .btn-save:hover:not(:disabled) {
        background: #2e59d9;
        transform: translateY(-2px);
        box-shadow: 0 8px 16px rgba(78, 115, 223, 0.25);
    }

    .btn-save:disabled {
        background: #a0aec0;
        cursor: not-allowed;
    }

    /* Gateways */
    .gateway-card-btn {
        background: white;
        border: 2px solid #e2e8f0;
        border-radius: 16px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        cursor: pointer;
        position: relative;
        overflow: hidden;
    }

    .gateway-card-btn:hover {
        transform: translateY(-4px);
        border-color: #4e73df;
        box-shadow: 0 12px 20px rgba(78, 115, 223, 0.08);
    }

    .gateway-logo-wrapper {
        width: 100%;
        height: 70px;
        background: #f8fafc;
        border-radius: 12px;
        padding: 10px;
    }

    .gateway-image {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
    }

    .gateway-name {
        font-size: 1rem;
        margin-top: 5px;
    }

    .gateway-pay-text {
        font-size: 0.82rem;
    }

    .no-gateways-card {
        border: 2px dashed #e2e8f0;
        background: #f8fafc;
        min-height: 200px;
    }

    /* Back button */
    .btn-back {
        background: #f8fafc;
        color: #475569;
        border: 1px solid #e2e8f0;
        padding: 10px 20px;
        border-radius: 12px;
        font-weight: 600;
        font-size: 0.9rem;
        transition: all 0.2s ease-in-out;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    .btn-back:hover {
        background: #f1f5f9;
        color: #1e293b;
        border-color: #cbd5e1;
        transform: translateX(-2px);
    }

    /* Responsive */
    @media (max-width: 768px) {
        .page-wrapper {
            padding: 16px;
        }

        .border-start-md {
            border-left: none !important;
            padding-left: 0 !important;
            margin-top: 30px;
            border-top: 1px solid #e2e8f0;
            padding-top: 30px;
        }

        .sale-info-banner {
            flex-direction: column;
        }

        .price-total {
            font-size: 1.2rem;
        }
    }
</style>
