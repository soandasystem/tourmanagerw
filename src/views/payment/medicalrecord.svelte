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

    let isEditing = false;

    const getInitialForm = () => ({
        id: null,
        sale_id: saleId,
        curso_id: passengersId,
        company_id: currentCompanyId,
        grupo_sanguineo: "",
        edad: "",
        peso: "",
        estatura: "",
        hipertension: false,
        diabetes: false,
        asma: false,
        epilepsia: false,
        arritmias: false,
        enfermedades_cardiacas: false,
        enfermedades_respiratorias: false,
        enfermedades_renales: false,
        otras_enfermedades: "",
        bajo_tratamiento: "",
        diagnostico: "",
        medicamentos_tratamiento: "",
        dosis_tratamiento: "",
        alergia_medicamentos: false,
        alergia_alimentos: false,
        alergia_insectos: false,
        alergia_otras: "",
        dificultad_movilidad: "",
        asistencia_movilidad: "",
        asistencia_especial: "",
        vegetariano: false,
        vegano: false,
        celiaco: false,
        intolerancia_lactosa: false,
        diabetico_alim: false,
        otra_restriccion_alim: "",
        contacto_nombre: "",
        contacto_relacion: "",
        contacto_telefono1: "",
        contacto_telefono2: "",
        observaciones: "",
        author: author,
    });

    let fichaForm = getInitialForm();
    let errors = {};

    /** @type {any[]} */
    let regions = [];
    /** @type {any[]} */
    let comunas = [];
    /** @type {any} */
    let sales = {};
    /** @type {any} */
    let passengers = {};
    /** @type {any} */
    let fm = {};
    // Lógica reactiva para filtrar comunas por región
    $: selectedRegionId = passengers.region_id;
    $: filteredComunas = (comunas || []).filter((c) => {
        const cRegId = Number(c.regions_id || c.region_id || c.id_region || 0);
        return cRegId === Number(selectedRegionId || 0);
    });

    // Calcular edad automáticamente
    $: if (passengers.fechanac) {
        fichaForm.edad = dayjs().diff(dayjs(passengers.fechanac), "year");
    }

    function handlePhoneInput(field, e) {
        fichaForm[field] = formatPhone(e.target.value);
    }

    const fetchData = async () => {
        try {
            const [regRes, comRes, salesRes, passengersRes, fmRes] =
                await Promise.all([
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
                    api.getData(
                        "ficha",
                        "",
                        "curso_id=" +
                            passengersId +
                            "&company_id=" +
                            currentCompanyId +
                            "&sale_id=" +
                            saleId,
                        "",
                        schemaName,
                    ),
                ]);
            if (regRes.status === "success")
                regions = Array.isArray(regRes.data) ? regRes.data : [];
            if (comRes.status === "success")
                comunas = Array.isArray(comRes.data) ? comRes.data : [];
            if (salesRes.status === "success")
                sales = Array.isArray(salesRes.data)
                    ? salesRes.data[0] || {}
                    : salesRes.data || {};
            if (passengersRes.status === "success")
                passengers = Array.isArray(passengersRes.data)
                    ? passengersRes.data[0] || {}
                    : passengersRes.data || {};
            if (fmRes.status === "success")
                fm = Array.isArray(fmRes.data)
                    ? fmRes.data[0] || {}
                    : fmRes.data || {};
            fichaForm = {
                ...fichaForm,
                ...fm,
            };
        } catch (error) {
            console.error("Error al cargar datos:", error);
        }
    };

    async function saveFm() {
        const payload = {
            ...fichaForm,
            peso: Number(fichaForm.peso),
            estatura: Number(fichaForm.estatura),
            sale_id: Number(saleId),
            curso_id: Number(passengersId),
            company_id: Number(currentCompanyId),
            author: author,
        };

        let res;
        if (isEditing) {
            res = await api.updateData(
                "ficha",
                payload,
                "",
                fichaForm.id,
                schemaName,
            );
        } else {
            res = await api.setData("f", payload, "", "", schemaName);
        }
        console.log("payload", payload);
        console.log("res", res);
        if (res.status === "success") {
            Swal.fire({
                title: "Guardado",
                text: `Ficha médica ${isEditing ? "actualizada" : "creada"} correctamente.`,
                icon: "success",
                allowOutsideClick: false,
                allowEscapeKey: false,
            }).then(() => {
                navigate(`/${idcl}/payment`);
            });
        } else {
            Swal.fire("Error", res.message, "error", {
                allowOutsideClick: false,
                allowEscapeKey: false,
            });
        }
    }

    onMount(() => {
        fetchData();
    });

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
                    Ficha Medica Pasajeros
                </h2>
            </div>
            <button type="button" class="btn-back" on:click={handleBack}>
                <i class="fa fa-arrow-left"></i> Volver al Menú
            </button>
        </div>
        <div class="card-body p-4">
            <form on:submit|preventDefault={saveFm}>
                <ul class="nav nav-tabs-custom mb-4">
                    <li class="nav-item">
                        <button
                            type="button"
                            class="nav-link {activeTab === 'tab1'
                                ? 'active'
                                : ''}"
                            on:click={() => (activeTab = "tab1")}
                        >
                            <i class="fa fa-info-circle me-2"></i> Antecedentes Personales
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
                            <i class="fa fa-map-marker me-2"></i> Antecedentes Medicos
                        </button>
                    </li>
                </ul>
                <div class="tab-content">
                    {#if activeTab === "tab1"}
                        <div class="tab-pane active" in:fade>
                            <div class="row">
                                <div class="col-md-4">
                                    <div class="form-group-custom">
                                        <label
                                            class="control-label"
                                            for="colegio">Colegio</label
                                        >
                                        <input
                                            type="text"
                                            class="form-control-custom form-control-sm"
                                            id="colegio"
                                            maxlength="20"
                                            readonly
                                            value={sales.establecimiento_nombre}
                                        />
                                    </div>
                                </div>
                                <div class="col-md-2">
                                    <div class="form-group-custom">
                                        <label class="control-label" for="curso"
                                            >Curso</label
                                        >
                                        <input
                                            type="text"
                                            class="form-control-custom form-control-sm"
                                            id="curso"
                                            maxlength="20"
                                            readonly
                                            value={sales.curso +
                                                " " +
                                                sales.idcurso}
                                        />
                                    </div>
                                </div>

                                <div class="col-md-2">
                                    <div class="form-group-custom">
                                        <label class="control-label" for="fecha"
                                            >Fecha Salida</label
                                        >
                                        <input
                                            type="text"
                                            class="form-control-custom form-control-sm"
                                            id="fecha"
                                            maxlength="100"
                                            readonly
                                            value={dayjs(
                                                sales.fechasalida,
                                            ).format("DD-MM-YYYY")}
                                        />
                                    </div>
                                </div>

                                <div class="col-md-4">
                                    <div class="form-group-custom">
                                        <label
                                            class="control-label"
                                            for="destino">Destino</label
                                        >
                                        <input
                                            type="text"
                                            class="form-control-custom form-control-sm"
                                            id="destino"
                                            maxlength="100"
                                            readonly
                                            value={sales.program_name}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="form-group-custom">
                                        <label
                                            class="control-label"
                                            for="alumno"
                                            >Alumno (Nombres y Apellidos)</label
                                        >
                                        <input
                                            type="text"
                                            class="form-control-custom form-control-sm"
                                            id="alumno"
                                            maxlength="100"
                                            readonly
                                            value={passengers.nombrealumno}
                                        />
                                    </div>
                                </div>

                                <div class="col-md-3">
                                    <div class="form-group-custom">
                                        <label
                                            class="control-label"
                                            for="rutpass">Rut</label
                                        >
                                        <input
                                            type="text"
                                            class="form-control-custom form-control-sm"
                                            id="rutpass"
                                            maxlength="20"
                                            readonly
                                            value={passengers.rutalumno}
                                        />
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <div class="form-group-custom">
                                        <label
                                            class="control-label"
                                            for="pasaporte">Pasaporte</label
                                        >
                                        <input
                                            type="text"
                                            class="form-control-custom form-control-sm"
                                            id="pasaporte"
                                            maxlength="20"
                                            readonly
                                            bind:value={passengers.pasaporte}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-2">
                                    <div class="form-group-custom">
                                        <label
                                            class="control-label"
                                            for="fecnac">Fecha Nacimiento</label
                                        >
                                        <div class="input-group">
                                            <input
                                                type="text"
                                                class="form-control-custom form-control-sm"
                                                id="fecnac"
                                                maxlength="100"
                                                readonly
                                                value={dayjs(
                                                    passengers.fechanac,
                                                ).format("DD-MM-YYYY")}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6 offset-md-4">
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
                                            readonly
                                            value={passengers.nacionalidad}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="form-group-custom">
                                        <label
                                            class="control-label"
                                            for="apoderado"
                                            >Nombre Completo Apoderado</label
                                        >
                                        <input
                                            type="text"
                                            class="form-control-custom form-control-sm"
                                            id="apoderado"
                                            maxlength="100"
                                            readonly
                                            value={sales.nombreapo}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="form-group-custom">
                                        <label class="control-label" for="calle"
                                            >Calle</label
                                        >
                                        <input
                                            type="text"
                                            class="form-control-custom form-control-sm"
                                            id="calle"
                                            maxlength="100"
                                            readonly
                                            value={passengers.dircalle}
                                        />
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <div class="form-group-custom">
                                        <label
                                            class="control-label"
                                            for="numero">Numero</label
                                        >
                                        <input
                                            type="text"
                                            class="form-control-custom form-control-sm"
                                            id="numdir"
                                            maxlength="100"
                                            readonly
                                            value={passengers.dirnumero}
                                        />
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <div class="form-group-custom">
                                        <label
                                            class="control-label"
                                            for="numdepto">Depto</label
                                        >
                                        <input
                                            type="text"
                                            class="form-control-custom form-control-sm"
                                            id="numdepto"
                                            maxlength="100"
                                            readonly
                                            value={passengers.nrodepto}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="form-group-custom">
                                        <label
                                            class="control-label"
                                            for="region_id">Región</label
                                        >
                                        <select
                                            id="region_id"
                                            class="form-select-custom form-select-sm"
                                            value={passengers.region_id}
                                            disabled
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
                                        <label
                                            class="control-label"
                                            for="comuna_id">Comuna</label
                                        >
                                        <select
                                            id="comuna_id"
                                            class="form-select-custom form-select-sm"
                                            value={passengers.comuna_id}
                                            disabled
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
                            <div class="row">
                                <div class="col-md-3">
                                    <div class="form-group-custom">
                                        <label class="control-label" for="fono"
                                            >Fono</label
                                        >
                                        <input
                                            type="text"
                                            class="form-control-custom form-control-sm"
                                            id="fono"
                                            maxlength="100"
                                            readonly
                                            value={passengers.fono}
                                        />
                                    </div>
                                </div>
                                <div class="col-md-3 offset-md-3">
                                    <div class="form-group-custom">
                                        <label
                                            class="control-label"
                                            for="celular">Celular</label
                                        >
                                        <input
                                            type="text"
                                            class="form-control-custom form-control-sm"
                                            id="celular"
                                            maxlength="100"
                                            readonly
                                            value={passengers.celular}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="form-group-custom">
                                        <label
                                            class="control-label"
                                            for="correo">Correo</label
                                        >
                                        <input
                                            type="text"
                                            class="form-control-custom form-control-sm"
                                            id="correo"
                                            maxlength="100"
                                            readonly
                                            value={passengers.correo}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    {/if}
                    {#if activeTab === "tab2"}
                        <div class="tab-pane active" in:fade>
                            <!-- Información General -->
                            <h5 class="mb-3 text-primary fw-bold">
                                Información General
                            </h5>
                            <div class="row">
                                <div class="col-md-3">
                                    <div class="form-group-custom">
                                        <label
                                            class="control-label"
                                            for="sangre">Grupo sanguíneo</label
                                        >
                                        <input
                                            type="text"
                                            class="form-control-custom form-control-sm"
                                            bind:value={
                                                fichaForm.grupo_sanguineo
                                            }
                                        />
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <div class="form-group-custom">
                                        <label class="control-label" for="edad"
                                            >Edad</label
                                        >
                                        <input
                                            type="number"
                                            class="form-control-custom form-control-sm"
                                            bind:value={fichaForm.edad}
                                        />
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <div class="form-group-custom">
                                        <label class="control-label" for="peso"
                                            >Peso (opcional)</label
                                        >
                                        <input
                                            type="text"
                                            class="form-control-custom form-control-sm"
                                            placeholder="Ej: 70 kg"
                                            bind:value={fichaForm.peso}
                                        />
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <div class="form-group-custom">
                                        <label
                                            class="control-label"
                                            for="estatura"
                                            >Estatura (opcional)</label
                                        >
                                        <input
                                            type="text"
                                            class="form-control-custom form-control-sm"
                                            placeholder="Ej: 175 cm"
                                            bind:value={fichaForm.estatura}
                                        />
                                    </div>
                                </div>
                            </div>

                            <!-- Enfermedades Preexistentes -->
                            <h5 class="mb-3 mt-4 text-primary fw-bold">
                                Enfermedades Preexistentes
                            </h5>
                            <div class="row">
                                <div class="col-md-12">
                                    <div class="d-flex flex-wrap gap-3 mb-3">
                                        <div class="form-check">
                                            <input
                                                class="form-check-input"
                                                type="checkbox"
                                                id="enfermedad1"
                                                bind:checked={
                                                    fichaForm.hipertension
                                                }
                                            />
                                            <label
                                                class="form-check-label"
                                                for="enfermedad1"
                                                >Hipertensión</label
                                            >
                                        </div>
                                        <div class="form-check">
                                            <input
                                                class="form-check-input"
                                                type="checkbox"
                                                id="enfermedad2"
                                                bind:checked={
                                                    fichaForm.diabetes
                                                }
                                            />
                                            <label
                                                class="form-check-label"
                                                for="enfermedad2"
                                                >Diabetes</label
                                            >
                                        </div>
                                        <div class="form-check">
                                            <input
                                                class="form-check-input"
                                                type="checkbox"
                                                id="enfermedad3"
                                                bind:checked={fichaForm.asma}
                                            />
                                            <label
                                                class="form-check-label"
                                                for="enfermedad3">Asma</label
                                            >
                                        </div>
                                        <div class="form-check">
                                            <input
                                                class="form-check-input"
                                                type="checkbox"
                                                id="enfermedad4"
                                                bind:checked={
                                                    fichaForm.epilepsia
                                                }
                                            />
                                            <label
                                                class="form-check-label"
                                                for="enfermedad4"
                                                >Epilepsia</label
                                            >
                                        </div>
                                        <div class="form-check">
                                            <input
                                                class="form-check-input"
                                                type="checkbox"
                                                id="enfermedad5"
                                                bind:checked={
                                                    fichaForm.arritmias
                                                }
                                            />
                                            <label
                                                class="form-check-label"
                                                for="enfermedad5"
                                                >Arritmias</label
                                            >
                                        </div>
                                        <div class="form-check">
                                            <input
                                                class="form-check-input"
                                                type="checkbox"
                                                id="enfermedad6"
                                                bind:checked={
                                                    fichaForm.enfermedades_cardiacas
                                                }
                                            />
                                            <label
                                                class="form-check-label"
                                                for="enfermedad6"
                                                >Enfermedades cardíacas</label
                                            >
                                        </div>
                                        <div class="form-check">
                                            <input
                                                class="form-check-input"
                                                type="checkbox"
                                                id="enfermedad7"
                                                bind:checked={
                                                    fichaForm.enfermedades_respiratorias
                                                }
                                            />
                                            <label
                                                class="form-check-label"
                                                for="enfermedad7"
                                                >Enfermedades respiratorias</label
                                            >
                                        </div>
                                        <div class="form-check">
                                            <input
                                                class="form-check-input"
                                                type="checkbox"
                                                id="enfermedad8"
                                                bind:checked={
                                                    fichaForm.enfermedades_renales
                                                }
                                            />
                                            <label
                                                class="form-check-label"
                                                for="enfermedad8"
                                                >Enfermedades renales</label
                                            >
                                        </div>
                                    </div>
                                    <div class="form-group-custom">
                                        <label
                                            class="control-label"
                                            for="enfermedades_otras"
                                            >Otras enfermedades preexistentes</label
                                        >
                                        <input
                                            type="text"
                                            class="form-control-custom form-control-sm"
                                            bind:value={
                                                fichaForm.otras_enfermedades
                                            }
                                        />
                                    </div>
                                </div>
                            </div>

                            <!-- Tratamientos y Medicamentos -->
                            <h5 class="mb-3 mt-4 text-primary fw-bold">
                                Tratamientos y Medicamentos
                            </h5>
                            <div class="row">
                                <div class="col-md-12 mb-3">
                                    <div class="form-group-custom">
                                        <label
                                            class="control-label"
                                            for="tratamiento"
                                            >¿Está bajo tratamiento médico?</label
                                        >
                                        <select
                                            class="form-select-custom form-select-sm"
                                            bind:value={
                                                fichaForm.bajo_tratamiento
                                            }
                                        >
                                            <option value=""
                                                >Seleccionar...</option
                                            >
                                            <option value="Si">Sí</option>
                                            <option value="No">No</option>
                                        </select>
                                    </div>
                                </div>
                                {#if fichaForm.bajo_tratamiento === "Si"}
                                    <div class="col-md-4">
                                        <div class="form-group-custom">
                                            <label
                                                class="control-label"
                                                for="diagnostico"
                                                >Diagnóstico</label
                                            >
                                            <input
                                                type="text"
                                                class="form-control-custom form-control-sm"
                                                bind:value={
                                                    fichaForm.diagnostico
                                                }
                                            />
                                        </div>
                                    </div>
                                    <div class="col-md-4">
                                        <div class="form-group-custom">
                                            <label
                                                class="control-label"
                                                for="medicamentos"
                                                >Medicamentos</label
                                            >
                                            <input
                                                type="text"
                                                class="form-control-custom form-control-sm"
                                                bind:value={
                                                    fichaForm.medicamentos_tratamiento
                                                }
                                            />
                                        </div>
                                    </div>
                                    <div class="col-md-4">
                                        <div class="form-group-custom">
                                            <label
                                                class="control-label"
                                                for="dosis">Dosis</label
                                            >
                                            <input
                                                type="text"
                                                class="form-control-custom form-control-sm"
                                                bind:value={
                                                    fichaForm.dosis_tratamiento
                                                }
                                            />
                                        </div>
                                    </div>
                                {/if}
                            </div>

                            <!-- Alergias -->
                            <h5 class="mb-3 mt-4 text-primary fw-bold">
                                Alergias
                            </h5>
                            <div class="row">
                                <div class="col-md-12">
                                    <div class="d-flex flex-wrap gap-3 mb-3">
                                        <div class="form-check">
                                            <input
                                                class="form-check-input"
                                                type="checkbox"
                                                id="alergia1"
                                                bind:checked={
                                                    fichaForm.alergia_medicamentos
                                                }
                                            />
                                            <label
                                                class="form-check-label"
                                                for="alergia1"
                                                >Medicamentos</label
                                            >
                                        </div>
                                        <div class="form-check">
                                            <input
                                                class="form-check-input"
                                                type="checkbox"
                                                id="alergia2"
                                                bind:checked={
                                                    fichaForm.alergia_alimentos
                                                }
                                            />
                                            <label
                                                class="form-check-label"
                                                for="alergia2">Alimentos</label
                                            >
                                        </div>
                                        <div class="form-check">
                                            <input
                                                class="form-check-input"
                                                type="checkbox"
                                                id="alergia3"
                                                bind:checked={
                                                    fichaForm.alergia_insectos
                                                }
                                            />
                                            <label
                                                class="form-check-label"
                                                for="alergia3"
                                                >Picaduras de insectos</label
                                            >
                                        </div>
                                    </div>
                                    <div class="form-group-custom">
                                        <label
                                            class="control-label"
                                            for="otras_alergias"
                                            >Otras alergias</label
                                        >
                                        <input
                                            type="text"
                                            class="form-control-custom form-control-sm"
                                            bind:value={fichaForm.alergia_otras}
                                            placeholder="Especifique otras alergias..."
                                        />
                                    </div>
                                </div>
                            </div>

                            <!-- Movilidad y Asistencia -->
                            <h5 class="mb-3 mt-4 text-primary fw-bold">
                                Movilidad y Asistencia
                            </h5>
                            <div class="row">
                                <div class="col-md-4">
                                    <div class="form-group-custom">
                                        <label
                                            class="control-label"
                                            for="dificultad_movilidad"
                                            >¿Presenta dificultades de
                                            movilidad?</label
                                        >
                                        <select
                                            class="form-select-custom form-select-sm"
                                            bind:value={
                                                fichaForm.dificultad_movilidad
                                            }
                                        >
                                            <option value=""
                                                >Seleccionar...</option
                                            >
                                            <option value="Si">Sí</option>
                                            <option value="No">No</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="form-group-custom">
                                        <label
                                            class="control-label"
                                            for="asistencia_movilidad"
                                            >¿Utiliza bastón, andador o silla de
                                            ruedas?</label
                                        >
                                        <input
                                            type="text"
                                            class="form-control-custom form-control-sm"
                                            placeholder="Indicar cuál, si aplica"
                                            bind:value={
                                                fichaForm.asistencia_movilidad
                                            }
                                        />
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="form-group-custom">
                                        <label
                                            class="control-label"
                                            for="asistencia_especial"
                                            >¿Requiere asistencia especial?</label
                                        >
                                        <input
                                            type="text"
                                            class="form-control-custom form-control-sm"
                                            bind:value={
                                                fichaForm.asistencia_especial
                                            }
                                        />
                                    </div>
                                </div>
                            </div>

                            <!-- Alimentación -->
                            <h5 class="mb-3 mt-4 text-primary fw-bold">
                                Alimentación
                            </h5>
                            <div class="row">
                                <div class="col-md-12">
                                    <div class="d-flex flex-wrap gap-3 mb-3">
                                        <div class="form-check">
                                            <input
                                                class="form-check-input"
                                                type="checkbox"
                                                id="alim1"
                                                bind:checked={
                                                    fichaForm.vegetariano
                                                }
                                            />
                                            <label
                                                class="form-check-label"
                                                for="alim1">Vegetariano</label
                                            >
                                        </div>
                                        <div class="form-check">
                                            <input
                                                class="form-check-input"
                                                type="checkbox"
                                                id="alim2"
                                                bind:checked={fichaForm.vegano}
                                            />
                                            <label
                                                class="form-check-label"
                                                for="alim2">Vegano</label
                                            >
                                        </div>
                                        <div class="form-check">
                                            <input
                                                class="form-check-input"
                                                type="checkbox"
                                                id="alim3"
                                                bind:checked={fichaForm.celiaco}
                                            />
                                            <label
                                                class="form-check-label"
                                                for="alim3">Celíaco</label
                                            >
                                        </div>
                                        <div class="form-check">
                                            <input
                                                class="form-check-input"
                                                type="checkbox"
                                                id="alim4"
                                                bind:checked={
                                                    fichaForm.intolerancia_lactosa
                                                }
                                            />
                                            <label
                                                class="form-check-label"
                                                for="alim4"
                                                >Intolerancia a la lactosa</label
                                            >
                                        </div>
                                        <div class="form-check">
                                            <input
                                                class="form-check-input"
                                                type="checkbox"
                                                id="alim5"
                                                bind:checked={
                                                    fichaForm.diabetico_alim
                                                }
                                            />
                                            <label
                                                class="form-check-label"
                                                for="alim5">Diabético</label
                                            >
                                        </div>
                                    </div>
                                    <div class="form-group-custom">
                                        <label
                                            class="control-label"
                                            for="otra_restriccion_alim"
                                            >Otra restricción alimentaria</label
                                        >
                                        <input
                                            type="text"
                                            class="form-control-custom form-control-sm"
                                            bind:value={
                                                fichaForm.otra_restriccion_alim
                                            }
                                        />
                                    </div>
                                </div>
                            </div>

                            <!-- Contacto de Emergencia -->
                            <h5 class="mb-3 mt-4 text-primary fw-bold">
                                Contacto de Emergencia
                            </h5>
                            <div class="row">
                                <div class="col-md-3">
                                    <div class="form-group-custom">
                                        <label
                                            class="control-label"
                                            for="contacto_nombre">Nombre</label
                                        >
                                        <input
                                            type="text"
                                            class="form-control-custom form-control-sm"
                                            bind:value={
                                                fichaForm.contacto_nombre
                                            }
                                        />
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <div class="form-group-custom">
                                        <label
                                            class="control-label"
                                            for="contacto_relacion"
                                            >Relación</label
                                        >
                                        <input
                                            type="text"
                                            class="form-control-custom form-control-sm"
                                            bind:value={
                                                fichaForm.contacto_relacion
                                            }
                                        />
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <div class="form-group-custom">
                                        <label
                                            class="control-label"
                                            for="contacto_telefono1"
                                            >Teléfono principal</label
                                        >
                                        <input
                                            type="text"
                                            class="form-control-custom form-control-sm {fichaForm.contacto_telefono1 &&
                                            !validatePhone(
                                                fichaForm.contacto_telefono1,
                                            )
                                                ? 'is-invalid'
                                                : ''}"
                                            id="contacto_telefono1"
                                            bind:value={
                                                fichaForm.contacto_telefono1
                                            }
                                            on:input={(e) =>
                                                handlePhoneInput(
                                                    "contacto_telefono1",
                                                    e,
                                                )}
                                            maxlength="14"
                                        />
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <div class="form-group-custom">
                                        <label
                                            class="control-label"
                                            for="contacto_telefono2"
                                            >Teléfono secundario</label
                                        >
                                        <input
                                            type="text"
                                            class="form-control-custom form-control-sm {fichaForm.contacto_telefono2 &&
                                            !validatePhone(
                                                fichaForm.contacto_telefono2,
                                            )
                                                ? 'is-invalid'
                                                : ''}"
                                            id="contacto_telefono2"
                                            bind:value={
                                                fichaForm.contacto_telefono2
                                            }
                                            on:input={(e) =>
                                                handlePhoneInput(
                                                    "contacto_telefono2",
                                                    e,
                                                )}
                                            maxlength="14"
                                        />
                                    </div>
                                </div>
                            </div>

                            <!-- Observaciones -->
                            <h5 class="mb-3 mt-4 text-primary fw-bold">
                                Observaciones
                            </h5>
                            <div class="row">
                                <div class="col-md-12">
                                    <div class="form-group-custom">
                                        <label
                                            class="control-label"
                                            for="observaciones"
                                            >Información adicional relevante</label
                                        >
                                        <textarea
                                            class="form-control-custom form-control-sm"
                                            rows="3"
                                            bind:value={fichaForm.observaciones}
                                        ></textarea>
                                    </div>
                                </div>
                            </div>
                        </div>
                    {/if}
                </div>
                <!-- Navigation Tabs -->
                <div
                    class="mt-4 d-flex justify-content-end align-items-center gap-3"
                >
                    <button type="submit" class="btn btn-primary px-4">
                        <i class="fa fa-save"></i> Guardar
                    </button>
                    <button
                        type="button"
                        class="btn btn-secondary"
                        on:click={() => navigate(`/${idcl}/payment`)}
                    >
                        <i class="fa fa-arrow-left"></i> Cancelar y volver
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

    .card-body {
        background-color: #ffffff;
        border-bottom-left-radius: 16px;
        border-bottom-right-radius: 16px;
    }
    .form-group-custom {
        margin-bottom: 0.8rem;
    }
    .form-group-custom label {
        display: block;
        font-weight: 700;
        color: #555;
        margin-bottom: 2px;
        font-size: 0.8rem;
    }
    .form-control-custom,
    .form-select-custom {
        width: 100%;
        padding: 4px 8px !important;
        border-radius: 4px !important;
        border: 1px solid #888 !important;
        font-size: 0.85rem !important;
        min-height: 32px !important;
        background-color: #ffffff;
        color: #000;
        transition: all 0.2s;
    }
    .form-control-custom[readonly] {
        background-color: #e9ecef;
        opacity: 1;
    }
    .form-control-custom:focus,
    .form-select-custom:focus {
        outline: none;
        border-color: #4e73df !important;
        box-shadow: 0 0 0 3px rgba(78, 115, 223, 0.2) !important;
    }
</style>
