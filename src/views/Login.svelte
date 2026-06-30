<script>
    import { onMount } from "svelte";
    import { navigate } from "svelte-routing";
    import CryptoJS from "crypto-js";
    import api from "../lib/apis";
    import { secureStorage } from "../lib/secureStore";
    import { authStore } from "../stores/auth";
    import { tenantStore } from "../stores/tenant";
    import { get } from "svelte/store";
    import { clearOpeningStore, fetchSaleInfo } from "../stores/openingStore";

    // Props
    export let idcl = "";

    // Variables de estado
    let username = "";
    let password = "";
    let accesscode = "";
    let currentStep = "selection"; // selection, user, password, accessCode, forgotUser, forgotCode, forgotReset

    // Forgot password flow state
    let forgotUsername = "";
    let forgotEmail = "";
    let generatedCode = "";
    let enteredCode = "";
    let newPassword = "";
    let confirmPassword = "";
    let userId = null;

    let errorMessage = "";
    let loading = false;
    let companyImage = "";

    // Configuración base (como en el PHP)
    const IMAGE_BASE = import.meta.env.VITE_FRURL || "http://localhost:5173";
    const API_BASE =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api/v3.5";

    const HASH_KEY = import.meta.env.VITE_HASH_KEY || "";

    // Si la API es remota pero las imágenes están locales en public/upload,
    // usamos una ruta relativa para que Vite las sirva correctamente.
    const ROOT_URL = import.meta.env.DEV
        ? ""
        : API_BASE.split("/api/")[0] + "/";

    // Definimos el código de la compañía en un solo bloque reactivo
    // para garantizar que idcl se procese antes de asignar code_company.
    let code_company = "";

    $: {
        const clean = idcl ? idcl.replace(".png", "") : "";
        if (clean) {
            tenantStore.set(clean);
            code_company = clean;
        } else {
            code_company = "GRL_999";
        }
        console.log("code company ", code_company);
        // Actualizar imagen
        companyImage = `${IMAGE_BASE}/login_logo_${code_company}.png`;
        console.log("companyImage ", companyImage);
    }

    let imageLoaded = false;
    let imageError = false;

    onMount(() => {
        // Limpiar sesión previa
        secureStorage.removeItem("_tk_");
        secureStorage.removeItem("_us_");
        clearOpeningStore();
    });

    function handleImageError() {
        console.warn("Logo not found, using fallback");
        imageError = true;
        // Fallback a una imagen por defecto si existe o un placeholder
        companyImage = "/vite.svg";
    }

    async function handleNextToPassword() {
        if (!username) {
            errorMessage = "Debe ingresar un usuario";
            return;
        }
        errorMessage = "";
        currentStep = "password";
    }

    async function handleLogin() {
        loading = true;
        errorMessage = "";

        try {
            // 1. Buscar parámetros de la compañía
            let schema_name = "global";
            let plan = 0;
            let company_id = 0;
            if (code_company !== "GRL_999") {
                const queryParams = `identificador=${code_company}`;
                const resp = await api.getData(
                    "company",
                    "",
                    queryParams,
                    "",
                    "global",
                );
                if (resp.status === "success" && resp.data.length > 0) {
                    const company = resp.data[0];
                    company_id = company.id;
                    schema_name = company.schema_name;
                    plan = company.plancode_id;
                }
            }

            let login_status = "invalid";
            let user_data = null;
            let redirect_url = "/admin/index";

            // Si es Login con Usuario y Clave
            if (username && password) {
                // El PHP usa MD5 con una HASH_KEY.
                //       const HASH_KEY = "749d50a656fb9";
                const hashedPassword = CryptoJS.HmacMD5(
                    password,
                    HASH_KEY,
                ).toString();
                const queryParams = `active=1&username=${username}&password=${hashedPassword}`;
                const resp = await api.getData(
                    "users",
                    "",
                    queryParams,
                    "",
                    schema_name,
                );
                if (resp.status === "success" && resp.data.length > 0) {
                    const user = resp.data[0];
                    user_data = {
                        id: user.id,
                        name: user.name,
                        username: user.username,
                        position: user.rol?.description || "Otro",
                        company: user.company_id,
                        schema: schema_name,
                        plancode: plan,
                        rol_id: user.roles_id,
                        permissions:
                            typeof user.rol?.permissions === "string"
                                ? JSON.parse(user.rol.permissions)
                                : user.rol?.permissions || {},
                    };
                    login_status = "success";
                } else {
                    // Buscar en "curso" (Apoderados)
                    // El PHP limpia el RUT: $RutAp=str_replace('.','',$username);
                    const cleanRut = username.replace(/\./g, "");
                    // El password para apoderados parece ser los primeros 4 dígitos del RUT?
                    // $password=Hash::getHash("md5", substr($RutAp,0,4), HASH_KEY);
                    const apoderadoPass = cleanRut.substring(0, 4);
                    const hashedApoPass =
                        CryptoJS.MD5(apoderadoPass).toString();

                    const apoQueryParams = `rutapod=${username.toUpperCase()}&password=${hashedApoPass}&company_id=${company_id}`;
                    const apoResp = await api.getData(
                        "curso",
                        "",
                        apoQueryParams,
                        "",
                        schema_name,
                    );

                    if (
                        apoResp.status === "success" &&
                        apoResp.data.length > 0
                    ) {
                        const course = apoResp.data[0];
                        user_data = {
                            id: course.id,
                            name: course.nombreapod,
                            position: "Apoderado",
                            company: course.company_id,
                            schema: schema_name,
                            plancode: plan,
                            sale: course.sale_id,
                            user_rut: course.rutapod,
                        };
                        login_status = "success";
                        redirect_url = "/payment";
                    } else {
                        errorMessage =
                            "No se ha logrado encontrar el usuario en el sistema.";
                    }
                }
            }
            // Si es Login con Código de Acceso
            else if (accesscode) {
                const queryParams = `accesscode=${accesscode}&activo=1`;
                const resp = await api.getData(
                    "sale",
                    "",
                    queryParams,
                    "",
                    schema_name,
                );

                if (resp.status === "success" && resp.data.length > 0) {
                    const sale = resp.data[0];
                    user_data = {
                        id: "0",
                        name: sale.encargado,
                        position: "General",
                        company: sale.company_id,
                        schema: schema_name,
                        plancode: plan,
                        sale: sale.id,
                        access_code: sale.accesscode,
                    };

                    // Obtener los detalles de la venta de forma asíncrona
                    await fetchSaleInfo(sale.accesscode, schema_name);

                    login_status = "success";
                    redirect_url = "/opening";
                } else {
                    errorMessage =
                        "No se ha logrado encontrar el código de acceso en el sistema.";
                }
            }

            if (login_status === "success") {
                // Guardar datos del usuario (sin token según pedido)
                secureStorage.setItem("_us_", user_data);

                // Actualizar store (isAuthenticated = true)
                authStore.update((s) => ({
                    ...s,
                    isAuthenticated: true,
                    user: user_data,
                    token: null,
                }));

                navigate(`/${code_company}${redirect_url}`);
            }
        } catch (error) {
            console.error("Login error:", error);
            errorMessage = "Ocurrió un error al intentar iniciar sesión.";
        } finally {
            loading = false;
        }
    }

    function resetSteps() {
        currentStep = "selection";
        username = "";
        password = "";
        accesscode = "";
        errorMessage = "";
    }

    // Acción para manejar el foco de forma accesible (reemplaza autofocus)
    function focus(node) {
        node.focus();
    }

    // Forgot password: request code
    async function handleForgotUser() {
        errorMessage = "";
        loading = true;
        try {
            // Check user in 'users' table
            const userResp = await api.getData(
                "users",
                "",
                `username=${forgotUsername}`,
            );
            if (userResp.status === "success" && userResp.data.length > 0) {
                const user = userResp.data[0];
                userId = user.id;
                forgotEmail = user.email;
            } else {
                // Check in 'curso' table
                const cursoResp = await api.getData(
                    "curso",
                    "",
                    `username=${forgotUsername}`,
                );
                if (
                    cursoResp.status === "success" &&
                    cursoResp.data.length > 0
                ) {
                    const curso = cursoResp.data[0];
                    userId = curso.id;
                    forgotEmail = curso.email;
                } else {
                    errorMessage = "Usuario no encontrado.";
                    loading = false;
                    return;
                }
            }
            // Generate 6‑digit code
            generatedCode = String(Math.floor(100000 + Math.random() * 900000));
            // Send email (placeholder endpoint)
            await api.postData("send-code", {
                email: forgotEmail,
                code: generatedCode,
            });
            currentStep = "forgotCode";
        } catch (e) {
            console.error(e);
            errorMessage = "Error al solicitar el código.";
        } finally {
            loading = false;
        }
    }

    // Verify code entered by user
    function handleVerifyCode() {
        if (enteredCode === generatedCode) {
            currentStep = "forgotReset";
            errorMessage = "";
        } else {
            errorMessage = "Código incorrecto.";
        }
    }

    // Reset password
    async function handleResetPassword() {
        if (newPassword !== confirmPassword) {
            errorMessage = "Las contraseñas no coinciden.";
            return;
        }
        loading = true;
        try {
            await api.postData("reset-password", {
                id: userId,
                password: newPassword,
            });
            // Return to login
            resetSteps();
            alert("Contraseña actualizada. Por favor, inicia sesión.");
        } catch (e) {
            console.error(e);
            errorMessage = "Error al actualizar la contraseña.";
        } finally {
            loading = false;
        }
    }
</script>

<!-- Bootstrap CSS e Icons desde CDN (aunque idealmente se instalan, se respetan los links del usuario) -->
<svelte:head>
    <link
        href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css"
        rel="stylesheet"
    />
    <link
        href="https://cdn.jsdelivr.net/npm/bootstrap-icons/font/bootstrap-icons.css"
        rel="stylesheet"
    />
</svelte:head>

<div class="split-container">
    <!-- Columna izquierda: Imagen -->
    <div class="left-panel">
        <div class="image-wrapper {imageLoaded ? 'loaded' : ''}">
            {#if !imageError}
                <img
                    src={companyImage}
                    alt="Logo Empresa"
                    class="img-fluid logo-img"
                    on:load={() => (imageLoaded = true)}
                    on:error={handleImageError}
                />
            {:else}
                <div class="fallback-logo">
                    <i class="bi bi-building"></i>
                    <span>{code_company}</span>
                </div>
            {/if}
        </div>
    </div>

    <!-- Columna derecha: Login -->
    <div class="right-panel">
        <div class="form-wrapper">
            <h1 class="form-header">Bienvenido</h1>

            {#if errorMessage}
                <div class="alert alert-danger text-center" role="alert">
                    {errorMessage}
                </div>
            {/if}

            <!-- Selección inicial -->
            {#if currentStep === "selection"}
                <div id="selectionCard" class="card fade-in">
                    <div class="text-center mb-4">
                        <p>¿Cómo deseas ingresar?</p>
                    </div>
                    <div class="d-grid gap-2">
                        <button
                            type="button"
                            class="btn btn-primary"
                            on:click={() => (currentStep = "user")}
                        >
                            Ingresar con Usuario y Clave
                        </button>
                        <button
                            type="button"
                            class="btn btn-secondary"
                            on:click={() => (currentStep = "accessCode")}
                        >
                            Ingresar con Código de Acceso
                        </button>
                    </div>
                </div>
            {/if}

            <!-- Formulario usuario + clave -->
            {#if currentStep === "user"}
                <div id="userCard" class="card fade-in">
                    <div class="mb-3 text-start">
                        <label for="username" class="form-label">Usuario</label>
                        <div class="input-group">
                            <span class="input-group-text"
                                ><i class="fa fa-user"></i></span
                            >
                            <input
                                type="text"
                                class="form-control"
                                id="username"
                                bind:value={username}
                                placeholder="Ingresa tu usuario"
                                required
                            />
                        </div>
                    </div>
                    <div class="d-grid gap-2">
                        <button
                            type="button"
                            class="btn btn-primary"
                            on:click={handleNextToPassword}>Siguiente</button
                        >
                        <button
                            type="button"
                            class="btn btn-link enlace-gris"
                            on:click={resetSteps}>Volver</button
                        >
                    </div>
                </div>
            {/if}

            {#if currentStep === "password"}
                <form on:submit|preventDefault={handleLogin}>
                    <div id="passwordCard" class="card fade-in">
                        <div class="mb-3 text-start">
                            <label for="password" class="form-label"
                                >Clave</label
                            >
                            <div class="input-group">
                                <span class="input-group-text"
                                    ><i class="fa fa-lock"></i></span
                                >
                                <input
                                    type="password"
                                    class="form-control"
                                    id="password"
                                    bind:value={password}
                                    placeholder="Ingresa tu clave"
                                    required
                                    use:focus
                                />
                            </div>
                        </div>
                        <div class="d-grid gap-2">
                            <button
                                type="submit"
                                class="btn btn-success"
                                disabled={loading}
                            >
                                {#if loading}
                                    <span
                                        class="spinner-border spinner-border-sm"
                                        role="status"
                                        aria-hidden="true"
                                    ></span>
                                    Ingresando...
                                {:else}
                                    Ingresar
                                {/if}
                            </button>
                            <button
                                type="button"
                                class="btn btn-link enlace-gris"
                                on:click={() => (currentStep = "user")}
                                >Volver</button
                            >
                        </div>
                        <div class="enlace-gris text-center mt-3">
                            <button
                                type="button"
                                class="btn btn-link enlace-gris"
                                on:click={() => (currentStep = "forgotUser")}
                                >¿Olvidaste tu clave de acceso?</button
                            >
                        </div>
                    </div>
                </form>
            {/if}

            <!-- Formulario código de acceso -->
            {#if currentStep === "accessCode"}
                <form on:submit|preventDefault={handleLogin}>
                    <div id="accessCodeCard" class="card fade-in">
                        <div class="mb-3 text-start">
                            <label for="accesscode" class="form-label"
                                >Código de acceso</label
                            >
                            <div class="input-group">
                                <span class="input-group-text"
                                    ><i class="bi bi-lock"></i></span
                                >
                                <input
                                    type="text"
                                    class="form-control"
                                    id="accesscode"
                                    bind:value={accesscode}
                                    placeholder="Código de acceso"
                                    required
                                    use:focus
                                />
                            </div>
                        </div>
                        <div class="d-grid gap-2">
                            <button
                                type="submit"
                                class="btn btn-success"
                                disabled={loading}
                            >
                                {#if loading}
                                    <span
                                        class="spinner-border spinner-border-sm"
                                        role="status"
                                        aria-hidden="true"
                                    ></span>
                                    Ingresando...
                                {:else}
                                    Ingresar
                                {/if}
                            </button>
                            <button
                                type="button"
                                class="btn btn-link enlace-gris"
                                on:click={resetSteps}>Volver</button
                            >
                        </div>
                    </div>
                </form>
            {/if}
        </div>
    </div>
</div>

{#if currentStep === "forgotUser"}
    <div class="card fade-in">
        <div class="mb-3 text-start">
            <label class="form-label" for="forgotUser">Usuario o Correo</label>
            <input
                class="form-control"
                placeholder="Ingresa tu usuario o correo"
                bind:value={forgotUsername}
                required
            />
        </div>
        <div class="d-grid gap-2">
            <button
                class="btn btn-primary"
                on:click={handleForgotUser}
                disabled={loading}
            >
                {#if loading}<span
                        class="spinner-border spinner-border-sm"
                        role="status"
                        aria-hidden="true"
                    ></span> Enviando...{:else}Enviar código{/if}
            </button>
            <button class="btn btn-link enlace-gris" on:click={resetSteps}
                >Volver</button
            >
        </div>
        {#if errorMessage}<div class="alert alert-danger text-center mt-2">
                {errorMessage}
            </div>{/if}
    </div>
{/if}

{#if currentStep === "forgotCode"}
    <div class="card fade-in">
        <div class="mb-3 text-start">
            <label class="form-label" for="forgotCode"
                >Código de verificación</label
            >
            <input
                class="form-control"
                placeholder="Ingresa el código de 6 dígitos"
                bind:value={enteredCode}
                required
            />
        </div>
        <div class="d-grid gap-2">
            <button class="btn btn-primary" on:click={handleVerifyCode}
                >Verificar</button
            >
            <button class="btn btn-link enlace-gris" on:click={resetSteps}
                >Volver</button
            >
        </div>
        {#if errorMessage}<div class="alert alert-danger text-center mt-2">
                {errorMessage}
            </div>{/if}
    </div>
{/if}

{#if currentStep === "forgotReset"}
    <div class="card fade-in">
        <div class="mb-3 text-start">
            <label class="form-label" for="newPassword">Nueva contraseña</label>
            <input
                type="password"
                class="form-control"
                bind:value={newPassword}
                placeholder="Nueva contraseña"
                required
            />
        </div>
        <div class="mb-3 text-start">
            <label class="form-label" for="confirmPassword"
                >Confirmar contraseña</label
            >
            <input
                type="password"
                class="form-control"
                bind:value={confirmPassword}
                placeholder="Confirmar contraseña"
                required
            />
        </div>
        <div class="d-grid gap-2">
            <button
                class="btn btn-success"
                on:click={handleResetPassword}
                disabled={loading}
            >
                {#if loading}<span
                        class="spinner-border spinner-border-sm"
                        role="status"
                        aria-hidden="true"
                    ></span> Actualizando...{:else}Cambiar contraseña{/if}
            </button>
            <button class="btn btn-link enlace-gris" on:click={resetSteps}
                >Volver</button
            >
        </div>
        {#if errorMessage}<div class="alert alert-danger text-center mt-2">
                {errorMessage}
            </div>{/if}
    </div>
{/if}

<style>
    /* Estilos globales para html/body */
    :global(html),
    :global(body) {
        height: 100%;
        margin: 0;
        overflow-x: hidden;
        background-color: #f0f2f5;
        font-family:
            "Inter",
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            Roboto,
            sans-serif;
    }

    .split-container {
        height: 100vh;
        display: flex;
        flex-direction: row;
        width: 100vw;
    }

    .left-panel {
        flex: 0.8; /* Hacemos este panel un poco más estrecho para mover todo a la izquierda */
        background-color: #ffffff;
        background-image: radial-gradient(
                at 0% 0%,
                hsla(210, 100%, 98%, 1) 0,
                transparent 50%
            ),
            radial-gradient(
                at 50% 0%,
                hsla(210, 100%, 96%, 1) 0,
                transparent 50%
            ),
            radial-gradient(
                at 100% 0%,
                hsla(210, 100%, 98%, 1) 0,
                transparent 50%
            );
        display: flex;
        align-items: center;
        justify-content: flex-start; /* Alineamos al inicio (izquierda) */
        padding: 60px 0 60px 10%; /* Mucho padding a la derecha para empujarlo a la izquierda */
        position: relative;
        overflow: hidden;
    }

    .left-panel::after {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: radial-gradient(
            circle at center,
            transparent 0%,
            rgba(255, 255, 255, 0.8) 100%
        );
        pointer-events: none;
    }

    .right-panel {
        flex: 1.2; /* Aumentamos el peso del lado derecho */
        display: flex;
        align-items: center;
        justify-content: flex-start;
        padding: 30px 40px 30px 5%; /* Acercamos el formulario más al centro */
        background-color: #f0f2f5;
        z-index: 1;
    }

    .image-wrapper {
        opacity: 0;
        transform: scale(0.95) translateY(10px);
        transition: all 1s cubic-bezier(0.22, 1, 0.36, 1);
        width: 100%;
        display: flex;
        justify-content: center;
    }

    .image-wrapper.loaded {
        opacity: 1;
        transform: scale(1) translateY(0);
    }

    .logo-img {
        max-width: 80%;
        max-height: 80%;
        object-fit: contain;
        filter: drop-shadow(0 20px 40px rgba(0, 0, 0, 0.06));
    }

    .fallback-logo {
        display: flex;
        flex-direction: column;
        align-items: center;
        color: #adb5bd;
    }

    .fallback-logo i {
        font-size: 5rem;
    }

    .form-wrapper {
        width: 100%;
        max-width: 420px;
        padding: 20px;
    }

    .card {
        width: 100%;
        padding: 35px;
        border-radius: 24px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04);
        background: #ffffff;
        border: 1px solid rgba(0, 0, 0, 0.03);
        transition:
            transform 0.3s ease,
            box-shadow 0.3s ease;
    }

    .fade-in {
        animation: fadeIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }

    .form-header {
        font-size: 2.2rem;
        font-weight: 800;
        margin-bottom: 2.5rem;
        color: #1a1a1a;
        text-align: center;
        letter-spacing: -0.5px;
    }

    .form-label {
        font-weight: 600;
        color: #4a5568;
        font-size: 0.9rem;
        margin-bottom: 0.6rem;
    }

    .input-group-text {
        background-color: #f8fafc;
        border-right: none;
        color: #64748b;
        padding-left: 1.2rem;
        border-radius: 12px 0 0 12px;
    }

    .form-control {
        padding: 12px 1rem;
        font-size: 1rem;
        border-radius: 0 12px 12px 0;
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-left: none;
        transition: all 0.2s ease;
    }

    .input-group-text {
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-right: none;
        color: #64748b;
        padding-left: 1.2rem;
        border-radius: 12px 0 0 12px;
    }

    .form-control:focus {
        outline: none;
        box-shadow: none;
        background-color: #f8fafc;
        border-color: #e2e8f0;
    }

    .btn {
        padding: 12px;
        font-weight: 600;
        border-radius: 12px;
        transition: all 0.2s ease;
    }

    .btn-primary {
        background-color: #0d6efd;
        border: none;
        box-shadow: 0 4px 12px rgba(13, 110, 253, 0.2);
    }

    .btn-primary:hover {
        background-color: #0b5ed7;
        transform: translateY(-1px);
        box-shadow: 0 6px 15px rgba(13, 110, 253, 0.25);
    }

    .btn-secondary {
        background-color: #f1f5f9;
        border: none;
        color: #475569;
    }

    .btn-secondary:hover {
        background-color: #e2e8f0;
        color: #1e293b;
    }

    .btn-success {
        background-color: #10b981;
        border: none;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
    }

    .btn-success:hover {
        background-color: #059669;
        transform: translateY(-1px);
        box-shadow: 0 6px 15px rgba(16, 185, 129, 0.25);
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .enlace-gris {
        text-decoration: none;
        color: #64748b;
        font-size: 0.9rem;
        font-weight: 500;
        transition: color 0.2s;
    }

    .enlace-gris:hover {
        color: #1e293b;
    }

    /* Ajuste para móviles */
    @media (max-width: 992px) {
        .split-container {
            flex-direction: column;
            height: auto;
            min-height: 100vh;
        }
        .left-panel {
            flex: 0 0 350px;
            padding: 40px;
        }
        .right-panel {
            padding: 40px 20px;
            justify-content: center; /* En móvil volvemos a centrar */
        }
        .form-header {
            font-size: 1.8rem;
        }
    }
</style>
