<script>
    import { Router, Route, navigate } from "svelte-routing";
    import { onMount } from "svelte";
    import { authStore } from "./stores/auth";
    import { tenantStore } from "./stores/tenant";
    import Index from "./views/admin/index.svelte";

    // Vistas
    import Login from "./views/Login.svelte";
    import MainLayout from "./components/MainLayout.svelte";
    import Company from "./views/admin/company.svelte";
    import Programs from "./views/admin/programs.svelte";
    import Roles from "./views/admin/roles.svelte";
    import School from "./views/admin/school.svelte";
    import Users from "./views/admin/users.svelte";
    import Gateways from "./views/admin/gateways.svelte";
    import Quotes from "./views/admin/quotes.svelte";
    import Sales from "./views/admin/sales.svelte";
    import Course from "./views/admin/course.svelte";
    import Voucher from "./views/admin/voucher.svelte";
    import Entry from "./views/admin/entry.svelte";
    import Opening from "./views/opening/index.svelte";
    import OpeningPassengers from "./views/opening/passengers.svelte";
    import OpeningContratTravel from "./views/opening/contrattravel.svelte";
    import OpeningPaymentRsv from "./views/opening/paymentrsv.svelte";
    import PaymentIndex from "./views/payment/index.svelte";
    import PaymentPassengers from "./views/payment/passengers.svelte";
    import PaymentMedicalRecord from "./views/payment/medicalrecord.svelte";
    import PaymentContratTravel from "./views/payment/contrattravel.svelte";
    import PaymentSales from "./views/payment/paymentsales.svelte";
    // Importamos CSS global
    import "./app.css";

    // Redirección si no hay idcl? Por ahora lo dejamos así
</script>

<Router>
    <!-- Ruta con ID de compañía -->
    <Route path="/:idcl/login" let:params>
        <Login idcl={params.idcl} />
    </Route>

    <!-- Ruta raíz con ID de compañía -->
    <Route path="/:idcl" exact let:params>
        <Login idcl={params.idcl} />
    </Route>

    <!-- Fallback si entran sin ID de compañía -->
    <Route path="/" exact>
        <Login />
    </Route>

    <!-- Rutas con Layout -->
    <Route path="/:idcl/admin/index">
        <MainLayout>
            <Index />
        </MainLayout>
    </Route>

    <!-- Ejemplo para otras rutas -->
    <Route path="/:idcl/admin/company">
        <MainLayout>
            <Company />
        </MainLayout>
    </Route>

    <Route path="/:idcl/admin/programs">
        <MainLayout>
            <Programs />
        </MainLayout>
    </Route>

    <Route path="/:idcl/admin/roles">
        <MainLayout>
            <Roles />
        </MainLayout>
    </Route>

    <Route path="/:idcl/admin/school">
        <MainLayout>
            <School />
        </MainLayout>
    </Route>

    <Route path="/:idcl/admin/users">
        <MainLayout>
            <Users />
        </MainLayout>
    </Route>

    <Route path="/:idcl/admin/gateways">
        <MainLayout>
            <Gateways />
        </MainLayout>
    </Route>

    <Route path="/:idcl/admin/quotes">
        <MainLayout>
            <Quotes />
        </MainLayout>
    </Route>

    <Route path="/:idcl/admin/sales">
        <MainLayout>
            <Sales />
        </MainLayout>
    </Route>
    <Route path="/:idcl/admin/course">
        <MainLayout>
            <Course />
        </MainLayout>
    </Route>
    <Route path="/:idcl/admin/voucher">
        <MainLayout>
            <Voucher />
        </MainLayout>
    </Route>
    <Route path="/:idcl/admin/entry">
        <MainLayout>
            <Entry />
        </MainLayout>
    </Route>
    <Route path="/:idcl/opening">
        <Opening />
    </Route>
    <Route path="/:idcl/opening/passengers">
        <OpeningPassengers />
    </Route>
    <Route path="/:idcl/opening/contrattravel">
        <OpeningContratTravel />
    </Route>
    <Route path="/:idcl/opening/paymentrsv">
        <OpeningPaymentRsv />
    </Route>
    <Route path="/:idcl/payment">
        <PaymentIndex />
    </Route>
    <Route path="/:idcl/payment/passengers">
        <PaymentPassengers />
    </Route>

    <Route path="/:idcl/payment/medicalrecord">
        <PaymentMedicalRecord />
    </Route>

    <Route path="/:idcl/payment/contrattravel">
        <PaymentContratTravel />
    </Route>

    <Route path="/:idcl/payment/paymentsales">
        <PaymentSales />
    </Route>
</Router>
