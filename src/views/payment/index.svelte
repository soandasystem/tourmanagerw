<script>
    import { onMount } from "svelte";
    import { fade, fly } from "svelte/transition";
    import { navigate } from "svelte-routing";
    import { tenantStore } from "../../stores/tenant";
    import { secureStorage } from "../../lib/secureStore";
    import api from "../../lib/apis";
    import dayjs from "dayjs";
    import { formatDate } from "../../lib/utils";
    import { logout } from "../../stores/auth";
    $: idcl = $tenantStore;

    // Obtener datos del usuario desde secureStorage
    const userData = secureStorage.getItem("_us_") || {};
    const schema = userData.schema || "";
    const saleId = userData.sale || 0;
    const isGeneral = userData.position === "General";
    const isApoderado = userData.position === "Apoderado";
    const isAuthorized = isGeneral || isApoderado;
    const currentCompanyId = userData.company || 0;

    /** @type {any[]} */
    let installments = [];
    // Estado reactivo
    let loading = true;
    let programa = "";
    let curso = "";
    let colegio = "";
    let fechaultimo = "";
    let fechasalida = "";
    let apoderado = userData.name || "";
    let alumno = "";
    let cuotas = 1;
    let contratoFirmado = false;
    let company_name = "";

    async function fetchData() {
        try {
            loading = true;

            // 1. Obtener datos de la Venta (Sale)
            if (saleId) {
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
                    const sale = saleRes.data[0];
                    programa = sale.program_name || "";
                    curso = (sale.curso || "") + " / " + (sale.idcurso || "");
                    colegio = sale.establecimiento_nombre || "";
                    //   fechaultimo = sale.fecha_ultpag || "";
                    fechasalida = sale.fechasalida || "";
                    cuotas = Number(sale.cuotas) || 1;
                } else {
                    // Fallback a endpoint 'sale' directo si es necesario
                    const saleResDirect = await api.getData(
                        "sale",
                        "",
                        `id=${saleId}`,
                        "",
                        schema,
                    );
                    if (saleResDirect.status === "success") {
                        const sale = Array.isArray(saleResDirect.data)
                            ? saleResDirect.data[0]
                            : saleResDirect.data;
                        if (sale) {
                            programa = sale.program_name || "";
                            colegio = sale.establecimiento_nombre || "";
                            fechasalida = sale.fechasalida || "";
                            //   fechaultimo = sale.fecha_ultpag || "";
                            cuotas = Number(sale.cuotas) || 1;
                        }
                    }
                }
            }

            // 2. Obtener datos del Alumno si es Apoderado
            if (isApoderado && userData.id) {
                const cursoRes = await api.getData(
                    "curso",
                    "",
                    `id=${userData.id}`,
                    "",
                    schema,
                );
                if (cursoRes.status === "success") {
                    const student = Array.isArray(cursoRes.data)
                        ? cursoRes.data[0]
                        : cursoRes.data;
                    if (student) {
                        alumno = student.nombrealumno || "";
                        apoderado = student.nombreapod || apoderado;
                        contratoFirmado =
                            student.acepta_contrato == 1 ? false : true;
                    }
                }
            }

            // 3. Obtener el la fecha del ultimo pago
            const installmentRes = await api.getData(
                "installment",
                "",
                `sale_id=${saleId}&passenger_id=${userData.id}&company_id=${userData.company}`,
                "",
                schema,
            );

            if (installmentRes.status === "success") {
                const installments = Array.isArray(installmentRes.data)
                    ? installmentRes.data[0]
                    : installmentRes.data;
                if (installments) {
                    fechaultimo = installments.UpdatedDate?.split("T")[0];
                }
            }

            // 4. obtener datos de la compañia
            const companyRes = await api.getData(
                "company",
                "",
                `id=${currentCompanyId}`,
                "",
                "global",
            );
            if (companyRes.status === "success") {
                const company = Array.isArray(companyRes.data)
                    ? companyRes.data[0]
                    : companyRes.data;
                if (company) {
                    company_name = company.nomfantasia || "";
                }
            }
        } catch (error) {
            console.error("Error al obtener la información:", error);
        } finally {
            loading = false;
        }
    }

    onMount(() => {
        fetchData();
    });

    function handleLogout() {
        logout();
        navigate(`/${idcl}/login`);
    }
</script>

<div class="opening-container">
    <!-- Header Hero Section -->
    <header class="opening-header" in:fade={{ duration: 800 }}>
        <button
            class="logout-btn-discrete"
            on:click={handleLogout}
            title="Cerrar Sesión"
        >
            <i class="fa fa-sign-out"></i> Salir
        </button>
        <div class="header-content">
            <div class="welcome-badge">
                ¡Bienvenido a tu Panel de Gestión {company_name}!
            </div>

            {#if isGeneral}
                <h1>
                    Panel de <span class="text-gradient">Registro</span>
                </h1>
            {:else}
                <h1>
                    Hola, <span class="text-gradient"
                        >{apoderado || "Bienvenido"}</span
                    >
                </h1>
            {/if}

            {#if loading}
                <div class="loader-container">
                    <div class="spinner-border text-light" role="status">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                </div>
            {:else}
                <div class="info-grid">
                    {#if !isGeneral}
                        <div class="info-item">
                            <i class="fa fa-user-circle-o"></i>
                            <div>
                                <span class="info-label">Alumno</span>
                                <span>{alumno || "No registrado"}</span>
                            </div>
                        </div>
                        <div class="info-item">
                            <i class="fa fa-university"></i>
                            <div>
                                <span class="info-label">Colegio</span>
                                <span>{colegio || "No registrado"}</span>
                            </div>
                        </div>
                    {/if}
                    <div class="info-item">
                        <i class="fa fa-map-signs"></i>
                        <div>
                            <span class="info-label">Programa</span>
                            <span>{programa || "N/A"}</span>
                        </div>
                    </div>
                    <div class="info-item">
                        <i class="fa fa-graduation-cap"></i>
                        <div>
                            <span class="info-label">Curso</span>
                            <span>{curso || "N/A"}</span>
                        </div>
                    </div>
                    <div class="info-item">
                        <i class="fa fa-calendar-check-o"></i>
                        <div>
                            <span class="info-label">Último Abono</span>
                            <span>{formatDate(fechaultimo)}</span>
                        </div>
                    </div>
                    <div class="info-item">
                        <i class="fa fa-plane"></i>
                        <div>
                            <span class="info-label">Fecha Salida</span>
                            <span>{formatDate(fechasalida)}</span>
                        </div>
                    </div>
                </div>
            {/if}
        </div>
    </header>

    <div class="steps-section">
        <!-- Tarjeta Informativa de Cuenta Genérica si es General -->
        {#if isGeneral && !loading}
            <div class="alert-card shadow-sm" in:fly={{ y: 20, duration: 600 }}>
                <div class="alert-icon-box">
                    <i class="fa fa-info-circle"></i>
                </div>
                <div class="alert-content">
                    <h4 class="alert-title">Acceso de Cuenta Genérica</h4>
                    <p class="alert-text">
                        Has ingresado con una cuenta genérica que te permitirá
                        registrar al alumno que viajará. Una vez registrado, se
                        te enviará su usuario y contraseña al correo electrónico
                        ingresado para que puedas completar la Ficha Médica,
                        revisar los pagos realizados, realizar abonos al viaje y
                        firmar el contrato de manera digital e imprimirlo o
                        descargarlo.
                    </p>
                </div>
            </div>
        {/if}

        <div class="section-title">
            <h2>Tus Opciones</h2>
            <div class="underline"></div>
        </div>

        <div class="steps-grid">
            <!-- Opción 1: Alumno -->
            <div
                class="step-card {contratoFirmado ? 'locked' : ''}"
                in:fly={{ y: 50, delay: 100, duration: 600 }}
            >
                {#if contratoFirmado}
                    <div
                        class="lock-overlay"
                        title="Contrato firmado. Información bloqueada."
                    >
                        <i class="fa fa-lock"></i>
                    </div>
                {/if}
                <div class="step-icon">
                    <i class="fa fa-user"></i>
                </div>
                <h3>Alumno</h3>
                <p>
                    Revisa y corrige la información de tu hija(o). Podrás
                    hacerlo mientras no firmes el contrato.
                </p>
                <div class="card-footer">
                    {#if contratoFirmado}
                        <button
                            class="btn-step disabled"
                            title="La información está bloqueada porque el contrato ya fue firmado"
                            disabled
                        >
                            Bloqueado <i class="fa fa-lock"></i>
                        </button>
                    {:else}
                        <button
                            type="button"
                            on:click={() =>
                                navigate(`/${idcl}/payment/passengers`)}
                            class="btn-step active"
                        >
                            Ir <i class="fa fa-arrow-right"></i>
                        </button>
                    {/if}
                </div>
            </div>

            <!-- Opción 2: Ficha Médica -->
            <div
                class="step-card {!isAuthorized ? 'locked' : ''}"
                in:fly={{ y: 50, delay: 200, duration: 600 }}
            >
                {#if !isAuthorized}
                    <div class="lock-overlay" title="Acceso restingido.">
                        <i class="fa fa-lock"></i>
                    </div>
                {/if}
                <div class="step-icon">
                    <i class="fa fa-file"></i>
                </div>
                <h3>Ficha Médica</h3>
                <p>
                    Llena los datos de la ficha médica de tu hijo(a) para que
                    estemos al tanto de sus necesidades médicas.
                </p>
                <div class="card-footer">
                    {#if isAuthorized}
                        <button
                            type="button"
                            on:click={() =>
                                navigate(`/${idcl}/payment/medicalrecord`)}
                            class="btn-step active"
                        >
                            Ir <i class="fa fa-arrow-right"></i>
                        </button>
                    {:else}
                        <button
                            class="btn-step disabled"
                            title="Requiere cuenta de Apoderado o General"
                            disabled
                        >
                            Ir <i class="fa fa-arrow-right"></i>
                        </button>
                    {/if}
                </div>
            </div>

            <!-- Opción 3: Contrato -->
            <div
                class="step-card {!isAuthorized ? 'locked' : ''}"
                in:fly={{ y: 50, delay: 300, duration: 600 }}
            >
                {#if !isAuthorized}
                    <div class="lock-overlay" title="Acceso restingido.">
                        <i class="fa fa-lock"></i>
                    </div>
                {/if}
                <div class="step-icon">
                    <i class="fa fa-file-text"></i>
                </div>
                <h3>Contrato</h3>
                <p>
                    Aquí podrás revisar y firmar el contrato. Una vez firmado ya
                    no podrás modificar la información de tu hijo(a).
                </p>
                <div class="card-footer">
                    {#if isAuthorized}
                        <button
                            type="button"
                            on:click={() =>
                                navigate(`/${idcl}/payment/contrattravel`)}
                            class="btn-step active"
                        >
                            Ir <i class="fa fa-arrow-right"></i>
                        </button>
                    {:else}
                        <button
                            class="btn-step disabled"
                            title="Requiere cuenta de Apoderado o General"
                            disabled
                        >
                            Ir <i class="fa fa-arrow-right"></i>
                        </button>
                    {/if}
                </div>
            </div>

            <!-- Opción 4: Pagos -->
            <div
                class="step-card {!isAuthorized ? 'locked' : ''}"
                in:fly={{ y: 50, delay: 400, duration: 600 }}
            >
                {#if !isAuthorized}
                    <div class="lock-overlay" title="Acceso restingido.">
                        <i class="fa fa-lock"></i>
                    </div>
                {/if}
                <div class="step-icon">
                    <i class="fa fa-credit-card"></i>
                </div>
                <h3>Pagos</h3>
                <p>
                    Revisa pagos realizados. Además podrás realizar abonos o
                    pagar el monto total del viaje.
                </p>
                <div class="card-footer">
                    {#if isAuthorized}
                        <button
                            type="button"
                            on:click={() =>
                                navigate(`/${idcl}/payment/paymentsales`)}
                            class="btn-step active"
                        >
                            Ir <i class="fa fa-arrow-right"></i>
                        </button>
                    {:else}
                        <button
                            class="btn-step disabled"
                            title="Requiere cuenta de Apoderado o General"
                            disabled
                        >
                            Ir <i class="fa fa-arrow-right"></i>
                        </button>
                    {/if}
                </div>
            </div>
        </div>
    </div>
</div>

<style>
    .opening-container {
        min-height: 100vh;
        background-color: #f8fafc;
        padding-bottom: 50px;
    }

    /* Header Styles */
    .opening-header {
        position: relative;
        background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
        color: white;
        padding: 60px 20px;
        text-align: center;
        border-radius: 0 0 50px 50px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
        margin-bottom: 40px;
    }

    .logout-btn-discrete {
        position: absolute;
        top: 20px;
        right: 20px;
        background: rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.8);
        border: 1px solid rgba(255, 255, 255, 0.2);
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 0.85rem;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        gap: 6px;
        backdrop-filter: blur(5px);
        z-index: 10;
    }

    .logout-btn-discrete:hover {
        background: rgba(255, 255, 255, 0.2);
        color: white;
        border-color: rgba(255, 255, 255, 0.4);
    }

    .welcome-badge {
        display: inline-block;
        background: rgba(255, 255, 255, 0.1);
        padding: 8px 20px;
        border-radius: 20px;
        font-size: 0.9rem;
        margin-bottom: 15px;
        border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .opening-header h1 {
        font-size: 2.8rem;
        font-weight: 800;
        margin-bottom: 40px;
        color: white;
    }

    .text-gradient {
        background: linear-gradient(to right, #60a5fa, #a78bfa);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
    }

    .loader-container {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100px;
    }

    .info-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 20px;
        max-width: 1100px;
        margin: 0 auto;
    }

    .info-item {
        background: rgba(255, 255, 255, 0.05);
        padding: 15px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        gap: 15px;
        text-align: left;
        backdrop-filter: blur(5px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        transition: transform 0.2s ease;
    }

    .info-item:hover {
        transform: translateY(-2px);
        background: rgba(255, 255, 255, 0.08);
    }

    .info-item i {
        font-size: 1.6rem;
        color: #60a5fa;
    }

    .info-item .info-label {
        display: block;
        font-size: 0.75rem;
        text-transform: uppercase;
        opacity: 0.6;
        margin-bottom: 2px;
    }

    .info-item span {
        font-weight: 600;
        font-size: 0.95rem;
    }

    /* Steps Section */
    .steps-section {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 20px;
    }

    /* Alert Card for General position */
    .alert-card {
        display: flex;
        gap: 20px;
        background: #eff6ff;
        border-left: 5px solid #3b82f6;
        border-radius: 16px;
        padding: 24px;
        margin-bottom: 40px;
        align-items: flex-start;
    }

    .alert-icon-box {
        font-size: 2rem;
        color: #3b82f6;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .alert-content {
        flex: 1;
    }

    .alert-title {
        font-size: 1.15rem;
        font-weight: 700;
        color: #1e3a8a;
        margin: 0 0 8px 0;
    }

    .alert-text {
        font-size: 0.95rem;
        line-height: 1.6;
        color: #1e40af;
        margin: 0;
    }

    .section-title {
        text-align: center;
        margin-bottom: 40px;
    }

    .section-title h2 {
        font-size: 2rem;
        font-weight: 700;
        color: #1e293b;
    }

    .underline {
        width: 60px;
        height: 4px;
        background: #4e73df;
        margin: 10px auto;
        border-radius: 2px;
    }

    .steps-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 30px;
    }

    .step-card {
        background: white;
        border-radius: 20px;
        padding: 40px 30px;
        text-align: center;
        position: relative;
        transition: all 0.3s ease;
        border: 1px solid #e2e8f0;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-height: 340px;
    }

    .step-card:hover:not(.locked) {
        transform: translateY(-10px);
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        border-color: #4e73df;
    }

    .step-icon {
        width: 80px;
        height: 80px;
        background: #f8fafc;
        border-radius: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 25px;
        position: relative;
        z-index: 1;
        transition: all 0.3s ease;
    }

    .step-card:hover:not(.locked) .step-icon {
        background: #4e73df;
        color: white;
    }

    .step-icon i {
        font-size: 2rem;
    }

    .step-card h3 {
        font-size: 1.4rem;
        font-weight: 700;
        margin-bottom: 15px;
        color: #1e293b;
        position: relative;
        z-index: 1;
    }

    .step-card p {
        color: #64748b;
        font-size: 0.95rem;
        margin-bottom: 30px;
        line-height: 1.6;
    }

    .card-footer {
        position: relative;
        z-index: 1;
    }

    .btn-step {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 12px 35px;
        border-radius: 12px;
        font-weight: 700;
        text-decoration: none;
        transition: all 0.2s;
        width: 100%;
        justify-content: center;
        border: none;
        cursor: pointer;
    }

    .btn-step.active {
        background: #4e73df;
        color: white;
    }

    .btn-step.active:hover {
        background: #2e59d9;
        box-shadow: 0 4px 12px rgba(78, 115, 223, 0.4);
    }

    .btn-step.disabled {
        background: #e2e8f0;
        color: #94a3b8;
        cursor: not-allowed;
    }

    /* Locked State */
    .step-card.locked {
        opacity: 0.7;
        background: #f8fafc;
    }

    .lock-overlay {
        position: absolute;
        top: 20px;
        right: 20px;
        width: 35px;
        height: 35px;
        background: #fee2e2;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ef4444;
        font-size: 0.95rem;
    }

    @media (max-width: 768px) {
        .opening-header h1 {
            font-size: 2rem;
        }
        .info-grid {
            grid-template-columns: 1fr;
        }
        .alert-card {
            flex-direction: column;
            gap: 12px;
        }
    }
</style>
