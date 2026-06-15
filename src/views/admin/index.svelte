<script>
    import { navigate, link } from "svelte-routing";
    import { tenantStore } from "../../stores/tenant";

    $: idcl = $tenantStore;
    $: baseUrl = idcl ? `/${idcl}/admin` : "/admin";
</script>

<div class="row">
    <div class="col-md-12">
        <div class="content-header">
            <h1 class="main-title">CRM Gestión de Giras de Estudio</h1>
        </div>

        <div class="content-body">
            <p class="description-text">
                Las giras de estudio son una experiencia única que combina
                aprendizaje y recreación, pero su planificación y ejecución
                requieren una coordinación eficiente y un manejo integral de
                datos. Nuestro sistema CMR (Customer Management Relationship)
                para giras de estudio está diseñado para gestionar y centralizar
                todas las interacciones y procesos relacionados con los
                clientes: colegios, estudiantes y sus familias. Este CMR ofrece
                herramientas avanzadas para la administración de ventas,
                programas de viajes, cursos y pagos, proporcionando una solución
                integral para agencias de viajes educativas y coordinadores de
                giras. Con un enfoque centrado en la relación con el cliente, el
                sistema facilita la personalización de la experiencia y mejora
                la satisfacción de todos los involucrados.
            </p>

            <h3 class="section-subtitle">Características principales:</h3>

            <div class="feature-item">
                <strong class="item-title"
                    >1.- Gestión de relaciones con los colegios y estudiantes</strong
                >
                <ul class="feature-list">
                    <li>
                        Registro de información detallada de colegios, cursos y
                        estudiantes.
                    </li>
                    <li>
                        Seguimiento de la interacción con los clientes en todas
                        las etapas del proceso.
                    </li>
                </ul>
            </div>

            <div class="feature-item">
                <strong class="item-title"
                    >2.- Gestión de programas de viajes</strong
                >
                <ul class="feature-list">
                    <li>
                        Creación y seguimiento de itinerarios personalizados
                        para cada grupo.
                    </li>
                    <li>
                        Asignación de actividades, destinos y horarios
                        específicos por curso o cliente.
                    </li>
                </ul>
            </div>

            <div class="feature-item">
                <strong class="item-title"
                    >3.- Administración de ventas y pagos</strong
                >
                <ul class="feature-list">
                    <li>
                        Registro de reservas, ventas y pagos en tiempo real.
                    </li>
                    <li>Alertas y recordatorios para pagos pendientes.</li>
                    <li>
                        Integración con pasarelas de pago seguras y confiables.
                    </li>
                </ul>
            </div>

            <div class="feature-item">
                <strong class="item-title"
                    >4.- Gestión de cursos y grupos</strong
                >
                <ul class="feature-list">
                    <li>
                        Organización de cursos por nivel educativo o
                        preferencia.
                    </li>
                    <li>
                        Asociación de programas de viaje específicos con cada
                        curso.
                    </li>
                </ul>
            </div>

            <div class="feature-item">
                <strong class="item-title">5.- Reportes y análisis</strong>
                <ul class="feature-list">
                    <li>
                        Reportes sobre interacciones con clientes, estado de
                        ventas y pagos.
                    </li>
                    <li>
                        Estadísticas que ayudan a entender mejor las necesidades
                        de los clientes.
                    </li>
                </ul>
            </div>

            <h3 class="section-subtitle mt-4">Beneficios:</h3>

            <ul class="benefits-list">
                <li>
                    <strong class="item-title"
                        >Enfoque centrado en el cliente:</strong
                    > Mejora la comunicación y la personalización de la experiencia
                    para estudiantes, padres y colegios.
                </li>
                <li>
                    <strong class="item-title">Eficiencia operativa:</strong> Permite
                    gestionar de manera centralizada toda la información del cliente
                    y los programas de viaje.
                </li>
                <li>
                    <strong class="item-title"
                        >Toma de decisiones informada:</strong
                    > Facilita el análisis de datos para identificar tendencias y
                    optimizar procesos.
                </li>
                <li>
                    <strong class="item-title">Escalabilidad:</strong> Ideal tanto
                    para pequeñas agencias como para grandes coordinadores de giras.
                </li>
                <li>
                    <strong class="item-title">Seguridad y confianza:</strong> Asegura
                    el manejo adecuado de los datos personales y financieros de los
                    clientes.
                </li>
            </ul>

            <p class="final-text mt-5">
                Con este sistema CMR, puedes transformar la forma en que
                administras las giras de estudio, fortaleciendo las relaciones
                con tus clientes y ofreciendo una experiencia memorable y bien
                organizada. ¡Lleva la gestión de giras al siguiente nivel con
                esta innovadora herramienta!
            </p>
            <hr class="mt-5 mb-5" />
        </div>
    </div>
</div>

<style>
    .main-title {
        font-size: 34px;
        font-weight: 400;
        color: #303641;
        margin-bottom: 25px;
        letter-spacing: -0.5px;
    }

    .section-subtitle {
        font-size: 24px;
        font-weight: 400;
        color: #303641;
        margin-top: 40px;
        margin-bottom: 20px;
    }

    .description-text,
    .final-text {
        font-size: 15px;
        line-height: 1.7;
        color: #777;
        margin-bottom: 25px;
        text-align: justify;
    }

    .feature-item {
        margin-bottom: 20px;
    }

    .item-title {
        font-weight: 700;
        color: #333;
        font-size: 15px;
    }

    .feature-list {
        list-style-type: disc;
        margin-left: 25px;
        margin-top: 8px;
        font-size: 15px;
        color: #777;
    }

    .feature-list li {
        margin-bottom: 6px;
    }

    .benefits-list {
        list-style-type: none;
        padding: 0;
        margin-top: 15px;
    }

    .benefits-list li {
        font-size: 15px;
        color: #777;
        margin-bottom: 12px;
        line-height: 1.6;
    }

    /* Ajuste para que se vea como en la imagen */
    :global(body) {
        background-color: #f4f7f6;
    }
</style>
