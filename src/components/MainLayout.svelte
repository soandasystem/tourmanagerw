<script>
    import { useLocation } from "svelte-routing";
    import { tenantStore } from "../stores/tenant";
    import Sidebar from "./Sidebar.svelte";
    import Header from "./Header.svelte";
    import Footer from "./Footer.svelte";

    const location = useLocation();

    // Sincronizar el idcl con la URL automáticamente
    $: {
        const path = $location.pathname;
        const segments = path.split("/").filter(Boolean);
        if (segments.length > 0) {
            const potentialIdcl = segments[0];
            if (
                potentialIdcl !== "admin" &&
                potentialIdcl !== "login" &&
                potentialIdcl !== "index"
            ) {
                tenantStore.set(potentialIdcl);
            }
        }
    }
</script>

<div class="page-container">
    <Sidebar activePath={$location.pathname} />

    <div class="main-content">
        <Header />

        <main class="content-area">
            <div class="container-fluid py-4 h-100">
                <!-- CONTENEDOR CENTRAL DE FORMS -->
                <div class="content-card shadow-sm">
                    <slot />
                </div>
            </div>
        </main>

        <Footer />
    </div>
</div>

<style>
    .page-container {
        display: flex;
        min-height: 100vh;
        width: 100%;
        background-color: #f8f9fc;
    }
    
    .main-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        width: calc(100% - 260px);
        overflow-x: hidden;
    }

    .content-area {
        flex: 1;
        padding: 0 10px;
    }

    .content-card {
        background: #ffffff;
        border-radius: 12px;
        border: 1px solid #e3e6f0;
        padding: 24px;
        min-height: calc(100vh - 200px);
        box-shadow: 0 0.15rem 1.75rem 0 rgba(58, 59, 69, 0.1) !important;
    }

    /* Global Utility for forms if needed */
    :global(.form-container-card) {
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
    }
</style>
