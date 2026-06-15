<script>
    import { onMount } from "svelte";
    import { fade } from "svelte/transition";
    import CryptoJS from "crypto-js";
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

    let activeTab = "tab1";

    $: idcl = $tenantStore;
    const userData = secureStorage.getItem("_us_") || {};
    const schemaName = userData.schema || "";
    const author = userData.username || "";
    const currentCompanyId = userData.company || 0;
    const saleId = userData.sale || 0;
    const passengersId = userData.id || 0;

    const getInitialForm = () => ({
        id: null,
        sale_id: saleId,
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
    /** @type {any[]} */
    let sales = [];
    /** @type {any[]} */
    let passengers = [];
    // Lógica reactiva para filtrar comunas por región
    $: selectedRegionId = courseForm.region_id;
    $: filteredComunas = (comunas || []).filter((c) => {
        const cRegId = Number(c.regions_id || c.region_id || c.id_region || 0);
        return cRegId === Number(selectedRegionId || 0);
    });

    const fetchData = async () => {
        try {
            const [regRes, comRes, salesRes, passengersRes] = await Promise.all(
                [
                    api.getData("region", "", "", "", "global"),
                    api.getData("comunas", "", "", "", "global"),
                    api.getData(
                        "sale/informe",
                        "",
                        "id=" + saleId,
                        "",
                        schemaName,
                    ),
                    api.getData(
                        "curso",
                        "",
                        "id=" + passengersId,
                        "",
                        schemaName,
                    ),
                ],
            );
            if (regRes.status === "success")
                regions = Array.isArray(regRes.data) ? regRes.data : [];
            if (comRes.status === "success")
                comunas = Array.isArray(comRes.data) ? comRes.data : [];
            if (salesRes.status === "success")
                sales = Array.isArray(salesRes.data) ? salesRes.data : [];
            if (passengersRes.status === "success")
                passengers = Array.isArray(passengersRes.data)
                    ? passengersRes.data[0]
                    : passengersRes.data;
            courseForm = {
                ...courseForm,
                id: passengers.id,
                sale_id: String(saleId),
                rutalumno: passengers.rutalumno,
                nombrealumno: passengers.nombrealumno,
                fechanac: passengers.fechanac,
                rutapod: passengers.rutapod,
                nombreapod: passengers.nombreapod,
                dircalle: passengers.dircalle,
                dirnumero: passengers.dirnumero,
                nrodepto: passengers.nrodepto,
                region_id: passengers.region_id,
                comuna_id: passengers.comuna_id,
                fono: passengers.fono,
                celular: passengers.celular,
                correo: passengers.correo,
                vpagar: passengers.vpagar,
                descto: passengers.descto,
                apagar: passengers.apagar,
                estador: passengers.estado,
                acepta_contrato: passengers.acepta_contrato,
                signature: passengers.signature,
                author: author,
                company_id: currentCompanyId,
                liberado: passengers.liberado,
                enviado: passengers.enviado,
                pasaporte: passengers.pasaporte,
            };
            console.log("courseForm", courseForm);
        } catch (error) {
            console.error("Error al cargar datos:", error);
        }
    };

    onMount(() => {
        fetchData();
    });

    async function saveForm() {
        try {
            courseForm.company_id = currentCompanyId;
            // Formatear fecha para el backend
            const originalDate = courseForm.fechanac;
            courseForm.fechanac = courseForm.fechanac + "T00:00:00Z";

            // Asegurar tipos
            courseForm.sale_id = Number(courseForm.sale_id);
            courseForm.region_id = Number(courseForm.region_id);
            courseForm.comuna_id = Number(courseForm.comuna_id);

            // Generar password a partir del RUT del apoderado (primeros 4 dígitos sin puntos)
            const RutAp = courseForm.rutapod || "";
            const cleanRut = RutAp.replace(/\./g, "");
            const apoderadoPass = cleanRut.substring(0, 4);
            const hashedApoPass = CryptoJS.MD5(apoderadoPass).toString();
            courseForm.password = hashedApoPass;

            const jsonData = JSON.stringify(courseForm);
            const data = await api.setData(
                "curso",
                jsonData,
                "",
                "",
                schemaName,
            );
            if (data.status === "success") {
                // Actualizar Store y Sesión
                const newId =
                    data.data?.data?.return_id || data.data?.id || data.data;
                openingStore.update((s) => ({
                    ...s,
                    user_curso_id: newId,
                    user_ruta: courseForm.rutalumno,
                    user_rut: courseForm.rutapod,
                    pasoActual: 1,
                }));
                secureStorage.setItem("user_curso_id", newId);
                secureStorage.setItem("user_ruta", courseForm.rutalumno);
                secureStorage.setItem("user_rut", courseForm.rutapod);
                secureStorage.setItem("paso", "1");

                Swal.fire(
                    "¡Éxito!",
                    "Pasajero registrado correctamente.",
                    "success",
                ).then(() => {
                    navigate(`/${idcl}/opening`);
                });
            } else {
                // Intentamos buscar el alumno existente con los mismos sale_id, rutalumno y company_id
                const consulta = `sale_id=${saleId}&rutalumno=${encodeURIComponent(courseForm.rutalumno)}&company_id=${currentCompanyId}`;
                try {
                    const searchRes = await api.getData(
                        "curso",
                        "",
                        consulta,
                        "",
                        schemaName,
                    );
                    if (
                        searchRes.status === "success" &&
                        Array.isArray(searchRes.data) &&
                        searchRes.data.length > 0
                    ) {
                        // Existe registro, hacemos update usando su id
                        const existingRecord = searchRes.data[0];
                        courseForm.id = existingRecord.id; // asumir campo id
                        const updateJson = JSON.stringify(courseForm);
                        const updateRes = await api.updateData(
                            "curso",
                            updateJson,
                            "",
                            existingRecord.id,
                            schemaName,
                        );
                        if (updateRes.status === "success") {
                            const newId = updateRes.data?.data?.return_id;
                            console.log("newId ", newId);
                            openingStore.update((s) => ({
                                ...s,
                                user_curso_id: newId,
                                user_ruta: courseForm.rutalumno,
                                user_rut: courseForm.rutapod,
                                pasoActual: 1,
                            }));
                            secureStorage.setItem("user_curso_id", newId);
                            secureStorage.setItem(
                                "user_ruta",
                                courseForm.rutalumno,
                            );
                            secureStorage.setItem(
                                "user_rut",
                                courseForm.rutapod,
                            );
                            secureStorage.setItem("paso", "1");
                            Swal.fire(
                                "¡Éxito!",
                                "Pasajero actualizado correctamente.",
                                "success",
                            ).then(() => {
                                navigate(`/${idcl}/opening`);
                            });
                        } else {
                            Swal.fire(
                                "Error",
                                "No se pudo actualizar el registro.",
                                "error",
                            );
                        }
                    } else {
                        // No se encontró registro, restaurar fecha y mostrar error original
                        courseForm.fechanac = originalDate;
                        Swal.fire(
                            "Error",
                            data.message ||
                                "No se encontró alumno para actualizar.",
                            "error",
                        );
                    }
                } catch (e) {
                    console.error(e);
                    courseForm.fechanac = originalDate;
                    Swal.fire(
                        "Error",
                        "Ocurrió un error al buscar/actualizar el alumno.",
                        "error",
                    );
                }
            }
            // Fin del manejo de respuesta no success
        } catch (err) {
            Swal.fire("Error", "Ocurrió un error inesperado", "error");
        }
    }

    function handleRutInput(field, e) {
        const val = e.target.value;
        const formatted = formatRut(val);
        courseForm[field] = formatted;
        errors[field] = val.length > 5 ? !validateRut(formatted) : false;
    }

    function handlePhoneInput(field, e) {
        const val = e.target.value;
        const formatted = formatPhone(val);
        courseForm[field] = formatted;
        errors[field] = val.length > 4 ? !validatePhone(formatted) : false;
    }

    function handleBack() {
        navigate(`/${idcl}/payment`);
    }
</script>

<div class="page-wrapper">
    <div class="card main-card shadow-sm border-0">
        <div
            class="card-header-flex p-4 border-bottom d-flex justify-content-between align-items-center"
        >
            <div class="title-with-icon d-flex align-items-center gap-3">
                <i class="fa fa-user-plus text-primary fs-3"></i>
                <h2 class="m-0 fs-4 fw-bold text-dark">
                    Registro de Pasajeros
                </h2>
            </div>
            <button type="button" class="btn-back" on:click={handleBack}>
                <i class="fa fa-arrow-left"></i> Volver al Menú
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
                            <i class="fa fa-info-circle me-2"></i> Datos Personales
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
                            <i class="fa fa-map-marker me-2"></i> Dirección y Contacto
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

                <div class="tab-content">
                    {#if activeTab === "tab1"}
                        <div class="tab-pane active" in:fade>
                            <div class="row g-3 mb-4">
                                <div class="col-md-6">
                                    <div class="form-group-custom">
                                        <label for="sale_id"
                                            >Selecciona tu Grupo / Venta</label
                                        >
                                        <select
                                            id="sale_id"
                                            class="form-select-custom"
                                            bind:value={courseForm.sale_id}
                                            required
                                        >
                                            {#each sales as sale}
                                                <option value={sale.id}>
                                                    {sale.establecimiento_nombre}
                                                    - {sale.curso}
                                                </option>
                                            {/each}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div class="row g-3 mb-3">
                                <div class="col-md-4">
                                    <div class="form-group-custom">
                                        <label for="rutalumno">Rut Alumno</label
                                        >
                                        <input
                                            type="text"
                                            id="rutalumno"
                                            class="form-control-custom {errors.rutalumno
                                                ? 'is-invalid'
                                                : ''}"
                                            value={courseForm.rutalumno}
                                            on:input={(e) =>
                                                handleRutInput("rutalumno", e)}
                                            placeholder="12.345.678-9"
                                            required
                                        />
                                        {#if errors.rutalumno}<span
                                                class="error-text"
                                                >RUT inválido</span
                                            >{/if}
                                    </div>
                                </div>
                                <div class="col-md-8">
                                    <div class="form-group-custom">
                                        <label for="nombrealumno"
                                            >Nombre Completo Alumno</label
                                        >
                                        <input
                                            type="text"
                                            id="nombrealumno"
                                            class="form-control-custom"
                                            bind:value={courseForm.nombrealumno}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <div class="row g-3 mb-3">
                                <div class="col-md-4">
                                    <div class="form-group-custom">
                                        <label for="pasaporte"
                                            >N° Pasaporte (Opcional)</label
                                        >
                                        <input
                                            type="text"
                                            id="pasaporte"
                                            class="form-control-custom"
                                            bind:value={courseForm.pasaporte}
                                        />
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="form-group-custom">
                                        <label
                                            class="control-label"
                                            for="nacionalidad"
                                            >Nacionalidad</label
                                        >
                                        <input
                                            type="text"
                                            class="form-control-custom form-control-sm"
                                            id="nacionalidad"
                                            maxlength="100"
                                            bind:value={courseForm.nacionalidad}
                                        />
                                    </div>
                                </div>
                                <div class="col-md-2">
                                    <div class="form-group-custom">
                                        <label for="fechanac"
                                            >F. Nacimiento</label
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

                            <div class="row g-3 mt-3">
                                <div class="col-md-4">
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
                                                handleRutInput("rutapod", e)}
                                            placeholder="12.345.678-9"
                                            required
                                        />
                                        {#if errors.rutapod}<span
                                                class="error-text"
                                                >RUT inválido</span
                                            >{/if}
                                    </div>
                                </div>
                                <div class="col-md-8">
                                    <div class="form-group-custom">
                                        <label for="nombreapod"
                                            >Nombre Completo Apoderado</label
                                        >
                                        <input
                                            type="text"
                                            id="nombreapod"
                                            class="form-control-custom"
                                            bind:value={courseForm.nombreapod}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    {:else if activeTab === "tab2"}
                        <div class="tab-pane active" in:fade>
                            <div class="row g-3 mb-3">
                                <div class="col-md-8">
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
                                <div class="col-md-2">
                                    <div class="form-group-custom">
                                        <label for="dirnumero">N°</label>
                                        <input
                                            type="text"
                                            id="dirnumero"
                                            class="form-control-custom"
                                            bind:value={courseForm.dirnumero}
                                            required
                                        />
                                    </div>
                                </div>
                                <div class="col-md-2">
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
                                        <label for="region_id">Región</label>
                                        <select
                                            id="region_id"
                                            class="form-select-custom"
                                            bind:value={courseForm.region_id}
                                            on:change={() => {
                                                courseForm.comuna_id = "";
                                                courseForm = courseForm;
                                            }}
                                        >
                                            <option value=""
                                                >Seleccionar...</option
                                            >
                                            {#each regions as region}
                                                <option
                                                    value={Number(region.id)}
                                                    >{region.description}</option
                                                >
                                            {/each}
                                        </select>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="form-group-custom">
                                        <label for="comuna_id">Comuna</label>
                                        <select
                                            id="comuna_id"
                                            class="form-select-custom"
                                            bind:value={courseForm.comuna_id}
                                        >
                                            <option value=""
                                                >Seleccionar...</option
                                            >
                                            {#each filteredComunas as comuna}
                                                <option
                                                    value={Number(comuna.id)}
                                                    >{comuna.description}</option
                                                >
                                            {/each}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div class="row g-3">
                                <div class="col-md-4">
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
                                                handlePhoneInput("celular", e)}
                                            placeholder="+56 9 1234 5678"
                                            required
                                        />
                                        {#if errors.celular}<span
                                                class="error-text"
                                                >Celular inválido</span
                                            >{/if}
                                    </div>
                                </div>
                                <div class="col-md-8">
                                    <div class="form-group-custom">
                                        <label for="correo"
                                            >Correo Electrónico</label
                                        >
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
                        <div class="tab-pane active" in:fade>
                            <div class="row g-3 mb-4">
                                <div class="col-md-4">
                                    <div
                                        class="form-group-custom text-center p-4 bg-light rounded"
                                    >
                                        <span
                                            class="d-block text-muted small mb-1"
                                            >VALOR PROGRAMA</span
                                        >
                                        <span class="h4 m-0 fw-bold"
                                            >{formatCurrency(
                                                courseForm.vpagar,
                                            )}</span
                                        >
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div
                                        class="form-group-custom text-center p-4 bg-light rounded"
                                    >
                                        <span
                                            class="d-block text-muted small mb-1"
                                            >DESCUENTO</span
                                        >
                                        <span class="h4 m-0 text-danger"
                                            >-{formatCurrency(
                                                courseForm.descto,
                                            )}</span
                                        >
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div
                                        class="form-group-custom text-center p-4 bg-primary-soft rounded"
                                    >
                                        <span
                                            class="d-block text-primary small mb-1 fw-bold"
                                            >TOTAL A PAGAR</span
                                        >
                                        <span
                                            class="h4 m-0 text-primary fw-bold"
                                            >{formatCurrency(
                                                courseForm.apagar,
                                            )}</span
                                        >
                                    </div>
                                </div>
                            </div>
                        </div>
                    {/if}
                </div>

                <div class="form-actions border-top pt-4 mt-4">
                    <button
                        type="submit"
                        class="btn btn-save py-3 px-5 shadow-sm"
                    >
                        <i class="fa fa-save me-2"></i> Completar Registro y Continuar
                    </button>
                </div>
            </form>
        </div>
    </div>
</div>

<style>
    .page-wrapper {
        padding: 40px 20px;
        background-color: #f8f9fc;
        min-height: 100vh;
    }
    .main-card {
        max-width: 900px;
        margin: 0 auto;
        background: white;
        border-radius: 16px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05) !important;
        overflow: hidden;
    }
    .card-header-flex {
        background-color: white;
        border-top-left-radius: 16px;
        border-top-right-radius: 16px;
    }
    .btn-back {
        background: #f8f9fc;
        color: #4e73df;
        border: 1px solid #e3e6f0;
        padding: 8px 16px;
        border-radius: 8px;
        font-weight: 600;
        transition: all 0.2s;
        cursor: pointer;
    }
    .btn-back:hover {
        background: #eaecf4;
    }

    .nav-tabs-custom {
        display: flex;
        list-style: none;
        padding: 0;
        border-bottom: 2px solid #f1f5f9;
    }
    .nav-tabs-custom .nav-link {
        border: none;
        background: none;
        padding: 12px 20px;
        font-weight: 600;
        color: #94a3b8;
        cursor: pointer;
        position: relative;
        transition: all 0.3s;
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
        background: #4e73df;
    }

    .form-group-custom {
        margin-bottom: 1rem;
    }
    .form-group-custom label {
        display: block;
        font-weight: 600;
        color: #475569;
        margin-bottom: 8px;
        font-size: 0.9rem;
    }
    .form-control-custom,
    .form-select-custom {
        width: 100%;
        padding: 12px 15px;
        border-radius: 10px;
        border: 1px solid #e2e8f0;
        font-size: 1rem;
        transition: all 0.2s;
    }
    .form-control-custom:focus,
    .form-select-custom:focus {
        outline: none;
        border-color: #4e73df;
        box-shadow: 0 0 0 3px rgba(78, 115, 223, 0.1);
    }
    .is-invalid {
        border-color: #e74a3b;
    }
    .error-text {
        color: #e74a3b;
        font-size: 0.75rem;
        margin-top: 5px;
        display: block;
    }

    .btn-save {
        background: #4e73df;
        color: white;
        border: none;
        border-radius: 12px;
        font-weight: 700;
        width: 100%;
        transition: all 0.2s;
    }
    .btn-save:hover {
        background: #2e59d9;
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(78, 115, 223, 0.3);
    }

    .bg-primary-soft {
        background-color: rgba(78, 115, 223, 0.1);
    }
</style>
