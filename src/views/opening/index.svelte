<script>
    import { onMount } from "svelte";
    import { fade, fly } from "svelte/transition";
    import { navigate } from "svelte-routing";
    import { openingStore } from "../../stores/openingStore";
    import { tenantStore } from "../../stores/tenant";
    import { logout } from "../../stores/auth";
    import { secureStorage } from "../../lib/secureStore";
    import api from "../../lib/apis";
    import dayjs from "dayjs";

    $: idcl = $tenantStore;


    // Obtener datos del usuario desde secureStorage
    const userData = secureStorage.getItem("_us_") || {};
    const schema = userData.schema || "global";
    const currentCompanyId = userData.company || 0;

    /** @type {any[]} */
    let company_name="";

    $: ({
        programa,
        curso,
        colegio,
        fechaultimo,
        fechasalida,
        user_curso_id,
        user_contrato,
        pasoActual,
    } = $openingStore);

    // Lógica de habilitación de pasos
    $: canGoToStep2 = user_curso_id !== "";
    $: canGoToStep3 = user_contrato !== "";

    function formatDate(date) {
        if (!date) return "N/A";
        return dayjs(date).format("DD/MM/YYYY");
    }

    function handleLogout() {
        logout();
        navigate(`/${idcl}/login`);
    }

    async function fetchData() {
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
    }
    onMount(() => {
        fetchData();
    });
</script>

<div class="opening-container">
    <input type="hidden" name="paso" id="paso" value={pasoActual} />
    <!-- Header Hero Section -->
    <header class="opening-header" in:fade={{ duration: 800 }}>
        <button class="logout-btn-discrete" on:click={handleLogout} title="Cerrar Sesión">
            <i class="fa fa-sign-out"></i> Salir
        </button>
        <div class="header-content">
            <div class="welcome-badge">
                ¡Bienvenido a la familia {company_name}!
            </div>
            <h1>
                Prepárate para tu <span class="text-gradient"
                    >Gran Aventura</span
                >
            </h1>

            <div class="info-grid">
                <div class="info-item">
                    <i class="fa fa-map-signs"></i>
                    <div>
                        <span class="info-label">Programa</span>
                        <span>{programa}</span>
                    </div>
                </div>
                <div class="info-item">
                    <i class="fa fa-graduation-cap"></i>
                    <div>
                        <span class="info-label">Colegio / Curso</span>
                        <span>{colegio} - {curso}</span>
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
        </div>
    </header>

    <div class="steps-section">
        <div class="section-title">
            <h2>Tus Opciones</h2>
            <div class="underline"></div>
        </div>

        <div class="steps-grid">
            <!-- Paso 1: Alumno -->
            <div
                class="step-card"
                in:fly={{ y: 50, delay: 200, duration: 600 }}
            >
                <div class="step-number">01</div>
                <div class="step-icon">
                    <i class="fa fa-user"></i>
                </div>
                <h3>Pasajeros</h3>
                <p>Ingresa los datos personales de los pasajeros.</p>
                <div class="card-footer">
                    <button
                        type="button"
                        on:click={() => navigate(`/${idcl}/opening/passengers`)}
                        class="btn-step active"
                    >
                        Ir <i class="fa fa-arrow-right"></i>
                    </button>
                </div>
            </div>

            <!-- Paso 2: Contrato -->
            <div
                class="step-card {!canGoToStep2 ? 'locked' : ''}"
                in:fly={{ y: 50, delay: 400, duration: 600 }}
            >
                <div class="step-number">02</div>
                {#if !canGoToStep2}
                    <div class="lock-overlay"><i class="fa fa-lock"></i></div>
                {/if}
                <div class="step-icon">
                    <i class="fa fa-file-text"></i>
                </div>
                <h3>Contrato</h3>
                <p>Revisa y acepta los términos del servicio.</p>
                <div class="card-footer">
                    {#if canGoToStep2}
                        <button
                            type="button"
                            on:click={() =>
                                navigate(`/${idcl}/opening/contrattravel`)}
                            class="btn-step active"
                        >
                            Ir <i class="fa fa-arrow-right"></i>
                        </button>
                    {:else}
                        <button
                            class="btn-step disabled"
                            title="Completa el paso 1 primero"
                        >
                            Ir <i class="fa fa-arrow-right"></i>
                        </button>
                    {/if}
                </div>
            </div>

            <!-- Paso 3: Pagos -->
            <div
                class="step-card {!canGoToStep3 ? 'locked' : ''}"
                in:fly={{ y: 50, delay: 600, duration: 600 }}
            >
                <div class="step-number">03</div>
                {#if !canGoToStep3}
                    <div class="lock-overlay"><i class="fa fa-lock"></i></div>
                {/if}
                <div class="step-icon">
                    <i class="fa fa-credit-card"></i>
                </div>
                <h3>Pagos</h3>
                <p>Paga tu reserva para asegurar tu cupo.</p>
                <br />
                <div class="card-footer">
                    {#if canGoToStep3}
                        <button
                            type="button"
                            on:click={() =>
                                navigate(`/${idcl}/opening/paymentrsv`)}
                            class="btn-step active"
                        >
                            Ir <i class="fa fa-arrow-right"></i>
                        </button>
                    {:else}
                        <button
                            class="btn-step disabled"
                            title="Acepta el contrato primero"
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

    .info-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        max-width: 1000px;
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
    }

    .info-item i {
        font-size: 1.5rem;
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
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
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
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }

    .step-card:hover:not(.locked) {
        transform: translateY(-10px);
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        border-color: #4e73df;
    }

    .step-number {
        position: absolute;
        top: 20px;
        left: 20px;
        font-size: 3rem;
        font-weight: 900;
        color: #f1f5f9;
        z-index: 0;
        line-height: 1;
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
        font-size: 1.5rem;
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
        background: #f1f5f9;
    }

    .lock-overlay {
        position: absolute;
        top: 20px;
        right: 20px;
        width: 35px;
        height: 35px;
        background: #e2e8f0;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #94a3b8;
    }

    @media (max-width: 768px) {
        .opening-header h1 {
            font-size: 2rem;
        }
        .info-grid {
            grid-template-columns: 1fr;
        }
    }
</style>
