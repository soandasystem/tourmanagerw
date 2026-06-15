clear<script>
    import { onMount } from "svelte";
    import { fade } from "svelte/transition";
    import { navigate } from "svelte-routing";
    import { secureStorage } from "../../lib/secureStore";
    import { tenantStore } from "../../stores/tenant";
    import { openingStore } from "../../stores/openingStore";
    import dayjs from "dayjs";
    import api from "../../lib/apis.js";
    import Swal from "sweetalert2";
    import {
        formatRut,
        validateRut,
        formatPhone,
        validatePhone,
        formatCurrency,
    } from "../../lib/utils";

    let valorv = 0;
    let apagar = 0;
    let gatewaysc = [];
    let voucher = "";
    let loading = true;

    const userData = secureStorage.getItem("_us_") || {};
    const saleId = userData.sale || 0;
    const companyId = userData.company || 0;
    const schema = userData.schema || "";

    const fetchData = async () => {
        try {
            loading = true;
            // Obtener venta
            const saleRes = await api.getData(
                "sale",
                "",
                `id=${saleId}`,
                "",
                schema,
            );

            if (saleRes.status === "success") {
                const saleData = Array.isArray(saleRes.data)
                    ? saleRes.data[0]
                    : saleRes.data;
                const programId = saleData.program_id;
                console.log("saleData", saleData);
                console.log("programId", programId);
                // Obtener programa para obtener valor reserva
                const progRes = await api.getData(
                    "programs",
                    "",
                    `id=${programId}`,
                    "",
                    schema,
                );
                if (progRes.status === "success") {
                    const progData = Array.isArray(progRes.data)
                        ? progRes.data[0]
                        : progRes.data;
                    valorv = progData.reserva || 0;
                    apagar = valorv;
                }
            }

            // OBTENER GATEWAYS CONFIGURADOS PARA LA COMPAÑÍA
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
                console.log("Gateways activos cargados:", gatewaysc);
            }
        } catch (e) {
            console.error(e);
            Swal.fire(
                "Error",
                "No se pudo cargar la información de pago.",
                "error",
            );
        } finally {
            loading = false;
        }
    };

    onMount(() => {
        fetchData();
    });

    function getGatewayImage(gw) {
        if (!gw || !gw.gateway_image) return "/assets/logo-mercadopago.png";
        if (gw.gateway_image.startsWith("http")) return gw.gateway_image;
        if (gw.gateway_image.startsWith("/")) return gw.gateway_image;
        if (gw.gateway_image.startsWith("assets/"))
            return "/" + gw.gateway_image;
        return `/assets/${gw.gateway_image}`;
    }

    async function handleVoucherSubmit(event) {
        event.preventDefault();
        try {
            Swal.fire({
                title: "Procesando...",
                text: "Validando el comprobante de pago",
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                },
            });

            // 1. Obtener voucher: buscar en 'voucher' global o local con used=0
            const nro_voucher = voucher.trim();
            const consultaVoucher = `voucher=${nro_voucher}&sale_id=${saleId}&used=0`;
            const responseVoucher = await api.getData(
                "voucher",
                "",
                consultaVoucher,
                "",
                schema,
            );

            if (
                responseVoucher.status === "success" &&
                responseVoucher.data &&
                responseVoucher.data.length > 0
            ) {
                const voucherData = responseVoucher.data[0];

                // 2. Buscar si existe el voucher en pagos para evitar duplicados
                const consultaPago = `identifier=${nro_voucher}&sale_id=${saleId}`;
                const responsePago = await api.getData(
                    "payment",
                    "",
                    consultaPago,
                    "",
                    schema,
                );
                const existe_pago = responsePago.data || [];

                if (!Array.isArray(existe_pago) || existe_pago.length === 0) {
                    // 3. Obtener Venta
                    const saleRes = await api.getData(
                        "sale",
                        "",
                        `id=${saleId}`,
                        "",
                        schema,
                    );
                    if (saleRes.status !== "success" || !saleRes.data) {
                        throw new Error(
                            "No se pudo obtener la información de la venta.",
                        );
                    }
                    const venta = Array.isArray(saleRes.data)
                        ? saleRes.data[0]
                        : saleRes.data;

                    // 4. Obtener Curso (Pasajero)
                    const userCursoId =
                        secureStorage.getItem("user_curso_id") ||
                        $openingStore.user_curso_id ||
                        0;
                    const cursoRes = await api.getData(
                        "curso",
                        "",
                        `id=${userCursoId}`,
                        "",
                        schema,
                    );
                    if (cursoRes.status !== "success" || !cursoRes.data) {
                        throw new Error(
                            "No se pudo obtener la información del pasajero.",
                        );
                    }
                    const curso = Array.isArray(cursoRes.data)
                        ? cursoRes.data[0]
                        : cursoRes.data;

                    // 5. Generar identificador único ING_...
                    const uniqid = () =>
                        Math.random().toString(36).substring(2, 9) +
                        Math.random().toString(36).substring(2, 9);
                    const identificador = "ING_" + uniqid();

                    const RutAl =
                        secureStorage.getItem("user_ruta") ||
                        $openingStore.user_ruta ||
                        curso.rutalumno ||
                        "";
                    const fechaActual = dayjs().format("YYYY-MM-DD");

                    // 8. Grabar el pago en tabla payment
                    const paymentData = {
                        passenger_id: Number(curso.id),
                        amount: Number(apagar),
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
                        sale_id: Number(venta.id),
                    };

                    console.log("paymentData", paymentData);
                    const ResinsertPayment = await api.setData(
                        "payment",
                        JSON.stringify(paymentData),
                        "",
                        "",
                        schema,
                    );
                    if (ResinsertPayment.status !== "success") {
                        throw new Error(
                            "Error al registrar el pago: " +
                                ResinsertPayment.message,
                        );
                    }
                    const insertPayment = Array.isArray(ResinsertPayment.data)
                        ? ResinsertPayment.data[0]
                        : ResinsertPayment.data;
                    const paymentId = insertPayment.data.return_id;

                    // 9. Actualizar installment
                    const instRes = await api.getData(
                        "installment",
                        "",
                        `passenger_id=${curso.id}&sale_id=${venta.id}`,
                        "",
                        schema,
                    );
                    if (
                        instRes.status === "success" &&
                        Array.isArray(instRes.data) &&
                        instRes.data.length > 0
                    ) {
                        const installment = instRes.data[0]; // asumimos la primera cuota
                        const newPaid =
                            Number(installment.paid_amount) + Number(apagar);
                        const newBalance =
                            Number(installment.balance) - Number(apagar);
                        const updateInst = await api.updateData(
                            "installment",
                            JSON.stringify({
                                paid_amount: newPaid,
                                balance: newBalance,
                            }),
                            "",
                            installment.id,
                            schema,
                        );

                        if (updateInst.status !== "success") {
                            console.log(
                                "Error al registrar el updateInst",
                                updateInst.message,
                            );
                        }

                        // 10. Registrar en payment_installments
                        const paymentInstData = {
                            payment_id: Number(paymentId),
                            installment_id: Number(installment.id),
                            applied_amount: Number(apagar),
                        };
                        const payment_installment = await api.setData(
                            "payment_installment",
                            JSON.stringify(paymentInstData),
                            "",
                            "",
                            schema,
                        );
                        console.log("payment_installment", paymentInstData);
                        if (payment_installment.status !== "success") {
                            console.log(
                                "Error al registrar el payment_installment",
                                payment_installment.message,
                            );
                        }
                    }

                    // 9. Actualizar Voucher a used = 1
                    const updateVoucher = await api.updateData(
                        "voucher",
                        JSON.stringify({ used: 1 }),
                        "",
                        voucherData.id,
                        schema,
                    );
                    if (updateVoucher.status !== "success") {
                        throw new Error(
                            "Error al actualizar el comprobante: " +
                                updateVoucher.message,
                        );
                    }

                    // Actualizar sesión y store
                    openingStore.update((s) => ({
                        ...s,
                        pasoActual: 3,
                        user_pagado: "S",
                    }));
                    secureStorage.setItem("paso", "3");
                    secureStorage.setItem("user_pagado", "S");

                    Swal.fire({
                        title: "¡Pago Exitoso!",
                        text: "El comprobante de pago ha sido validado y procesado de manera correcta.",
                        icon: "success",
                    }).then(() => {
                        navigate(`/${$tenantStore}/opening`);
                    });
                } else {
                    // Si el voucher ya fue usado
                    openingStore.update((s) => ({
                        ...s,
                        pasoActual: 4,
                        user_pagado: "",
                    }));
                    secureStorage.setItem("paso", "4");
                    secureStorage.setItem("user_pagado", "");

                    Swal.fire({
                        title: "Comprobante ya utilizado",
                        text: "Este número de comprobante ya ha sido ingresado en el sistema.",
                        icon: "warning",
                    }).then(() => {
                        navigate(`/${$tenantStore}/opening`);
                    });
                }
            } else {
                // Si el voucher no es válido
                openingStore.update((s) => ({
                    ...s,
                    pasoActual: 5,
                    user_pagado: "",
                }));
                secureStorage.setItem("paso", "5");
                secureStorage.setItem("user_pagado", "");

                Swal.fire({
                    title: "Comprobante no válido",
                    text: "El número de comprobante ingresado no es válido o ya fue utilizado.",
                    icon: "error",
                });
            }
        } catch (error) {
            console.error("Error al procesar el voucher:", error);
            Swal.fire({
                title: "Error",
                text:
                    error.message ||
                    "Ocurrió un error inesperado al validar el comprobante.",
                icon: "error",
            });
        }
    }
</script>

<div class="page-wrapper" in:fade={{ duration: 300 }}>
    <div class="card main-card shadow-sm border-0">
        <!-- Header (igual a paymentsales.svelte) -->
        <div
            class="card-header-flex p-4 border-bottom d-flex align-items-center justify-content-between flex-wrap gap-3"
        >
            <div class="d-flex align-items-center gap-3">
                <i class="fa fa-credit-card text-primary fa-lg"></i>
                <h3 class="m-0 text-dark fw-bold header-title">
                    Pago Reserva
                </h3>
            </div>
            <button
                type="button"
                class="btn-back"
                on:click={() => navigate(`/${$tenantStore}/opening`)}
            >
                <i class="fa fa-chevron-left me-1"></i> Volver
            </button>
        </div>


        <div class="card-body p-4">
            <div class="row g-4">
                <!-- Columna de detalles de pago -->
                <div class="col-md-5">
                    <div class="payment-detail-card p-4 rounded-4 mb-4">
                        <h5 class="fw-bold mb-3 text-dark">
                            <i class="fa fa-money text-success me-2"></i> Detalle
                            del Monto
                        </h5>

                        <div
                            class="detail-row py-3 border-bottom d-flex justify-content-between align-items-center"
                        >
                            <span class="text-muted fw-medium"
                                >Valor de la Reserva</span
                            >
                            <span class="price-value fw-bold text-dark"
                                >{formatCurrency(valorv)}</span
                            >
                        </div>

                        <div
                            class="detail-row py-3 d-flex justify-content-between align-items-center"
                        >
                            <span class="text-dark fw-bold">Total a Pagar</span>
                            <span class="price-total fw-extrabold text-primary"
                                >{formatCurrency(apagar)}</span
                            >
                        </div>
                    </div>

                    <!-- Formulario de voucher -->
                    <div class="voucher-box p-4 rounded-4">
                        <h5 class="fw-bold mb-2 text-dark">
                            <i class="fa fa-file-text-o text-warning me-2"></i>
                            ¿Ya pagaste?
                        </h5>
                        <p class="text-muted small mb-3">
                            Si realizaste una transferencia o depósito, ingresa el
                            número de comprobante para informar tu pago.
                        </p>


                        <form on:submit|preventDefault={handleVoucherSubmit}>
                            <div class="form-group-custom mb-3">
                                <label class="control-label" for="voucher"
                                    >Nro. de Comprobante</label
                                >
                                <input
                                    type="text"
                                    name="voucher"
                                    bind:value={voucher}
                                    class="form-control-custom"
                                    placeholder="Ej: 12345678"
                                    required
                                />
                            </div>
                            <button type="submit" class="btn-save w-100 py-3">
                                <i class="fa fa-check-circle me-1"></i> Informar
                                Pago y Continuar
                            </button>
                        </form>
                    </div>
                </div>

                <!-- Columna de formas de pago online -->
                <div class="col-md-7 border-start-md ps-md-4">
                    <h5 class="fw-bold mb-3 text-dark">
                        <i class="fa fa-globe text-primary me-2"></i> Pago Online
                        Inmediato
                    </h5>
                    <p class="text-muted mb-4">
                        Selecciona uno de los siguientes medios de pago seguros
                        y autorizados para realizar tu transacción de manera
                        automatizada.
                    </p>

                    {#if loading}
                        <div
                            class="no-gateways-card p-5 text-center rounded-4 border d-flex flex-column align-items-center justify-content-center"
                        >
                            <div
                                class="spinner-border text-primary mb-3"
                                role="status"
                            >
                                <span class="visually-hidden">Cargando...</span>
                            </div>
                            <span class="text-muted fw-medium"
                                >Buscando métodos de pago disponibles...</span
                            >
                        </div>
                    {:else if gatewaysc.length > 0}
                        <div class="row g-3">
                            {#each gatewaysc as gw}
                                <div class="col-sm-6">
                                    <form
                                        method="post"
                                        action={gw.gateway_url}
                                        target="_blank"
                                        class="h-100"
                                    >
                                        <input
                                            type="hidden"
                                            name="mpagar"
                                            value={apagar}
                                        />
                                        <button
                                            type="submit"
                                            class="gateway-card-btn w-100 h-100 p-4 d-flex flex-column align-items-center justify-content-center text-center"
                                        >
                                            <div
                                                class="gateway-logo-wrapper mb-3 d-flex align-items-center justify-content-center"
                                            >
                                                <img
                                                    src={getGatewayImage(gw)}
                                                    alt={gw.gateway_name ||
                                                        gw.name ||
                                                        gw.gateway_type}
                                                    class="gateway-image"
                                                />
                                            </div>
                                            <span
                                                class="gateway-name fw-bold text-dark"
                                                >{gw.gateway_name ||
                                                    gw.name ||
                                                    gw.gateway_type}</span
                                            >
                                            <span
                                                class="gateway-pay-text mt-2 text-primary small fw-semibold"
                                            >
                                                Pagar ahora <i
                                                    class="fa fa-external-link ms-1"
                                                ></i>
                                            </span>
                                        </button>
                                    </form>
                                </div>
                            {/each}
                        </div>
                    {:else}
                        <div
                            class="no-gateways-card p-5 text-center rounded-4 border d-flex flex-column align-items-center justify-content-center"
                        >
                            <i
                                class="fa fa-info-circle fa-2x mb-3 text-secondary"
                            ></i>
                            <span class="text-muted fw-medium"
                                >No hay pasarelas de pago online habilitadas en
                                este momento. Puede informar su comprobante al
                                costado izquierdo.</span
                            >
                        </div>
                    {/if}
                </div>
            </div>

            <!-- Botón de Volver -->
            <div
                class="d-flex justify-content-between align-items-center border-top mt-5 pt-4"
            >
                <button
                    type="button"
                    class="btn-back px-4 py-2"
                    on:click={() => navigate(`/${$tenantStore}/opening`)}
                >
                    <i class="fa fa-chevron-left me-2"></i> Volver a Opciones
                </button>
            </div>
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
        max-width: 960px;
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
        font-size: 1.5rem;
    }

    .payment-detail-card {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
    }

    .price-value {
        font-size: 1.15rem;
        color: #1e293b;
    }

    .price-total {
        font-size: 1.45rem;
        color: #4e73df !important;
        letter-spacing: -0.5px;
    }

    .voucher-box {
        background-color: #fffbeb;
        border: 1px solid #fef3c7;
    }

    .form-group-custom {
        margin-bottom: 1.25rem;
    }

    .form-group-custom label {
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

    .btn-save:hover {
        background: #2e59d9;
        transform: translateY(-2px);
        box-shadow: 0 8px 16px rgba(78, 115, 223, 0.25);
    }

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

    /* Gateway button card */
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

    .gateway-card-btn:hover .gateway-pay-text {
        color: #2e59d9 !important;
    }

    .gateway-logo-wrapper {
        width: 100%;
        height: 70px;
        background: #f8fafc;
        border-radius: 12px;
        padding: 10px;
        transition: background-color 0.2s;
    }

    .gateway-card-btn:hover .gateway-logo-wrapper {
        background-color: #ffffff;
    }

    .gateway-image {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
    }

    .gateway-name {
        font-size: 1.05rem;
        margin-top: 5px;
    }

    .gateway-pay-text {
        font-size: 0.8rem;
        transition: color 0.2s;
    }

    .no-gateways-card {
        border: 2px dashed #e2e8f0;
        background: #f8fafc;
        min-height: 200px;
    }

    @media (max-width: 768px) {
        .border-start-md {
            border-left: none !important;
            padding-left: 0 !important;
            margin-top: 30px;
            border-top: 1px solid #e2e8f0;
            padding-top: 30px;
        }
    }
</style>
