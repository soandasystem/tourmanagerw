<script>
    import { authStore, logout } from "../stores/auth";
    import { tenantStore } from "../stores/tenant";
    import { navigate } from "svelte-routing";

    // Configuración base
    const API_BASE =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api/v3.5";
    const ROOT_URL = import.meta.env.DEV
        ? ""
        : API_BASE.split("/api/")[0] + "/";

    $: idcl = $tenantStore;
    $: user = $authStore.user;
    
    // URL dinámica para el logo
    $: logoUrl = idcl
        ? `${ROOT_URL}/upload/company/image_company/login_logo_${idcl}.png`
        : "";

    function handleLogout() {
        logout();
        navigate(`/${idcl}/login`);
    }
</script>

<header class="app-header">
    <div class="header-left">
        {#if logoUrl}
            <div class="logo-wrapper">
                <img src={logoUrl} alt="Company Logo" class="company-logo" />
            </div>
        {:else}
             <div class="logo-placeholder">
                <i class="fa fa-ravelry"></i>
                <span>TourManager</span>
             </div>
        {/if}
    </div>

    <div class="header-right">
        {#if user}
            <div class="user-info">
                <div class="user-details">
                    <span class="user-name">{user.username || 'Usuario'}</span>
                    <span class="user-role">{user.profile_name || 'Staff'}</span>
                </div>
                <div class="user-avatar">
                   {user.username ? user.username[0].toUpperCase() : 'U'}
                </div>
            </div>
        {/if}
        
        <div class="divider"></div>

        <button class="logout-btn" on:click={handleLogout} title="Cerrar Sesión">
            <span>Salir</span>
            <i class="fa fa-sign-out"></i>
        </button>
    </div>
</header>

<style>
    .app-header {
        height: 70px;
        background-color: #ffffff;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0 24px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
        position: sticky;
        top: 0;
        z-index: 100;
    }

    .header-left {
        display: flex;
        align-items: center;
    }

    .logo-wrapper {
        display: flex;
        align-items: center;
    }

    .company-logo {
        max-height: 45px;
        object-fit: contain;
    }

    .logo-placeholder {
        display: flex;
        align-items: center;
        gap: 10px;
        color: #2c2e2f;
        font-weight: 700;
        font-size: 1.2rem;
    }

    .logo-placeholder i {
        font-size: 1.5rem;
        color: #4e73df;
    }

    .header-right {
        display: flex;
        align-items: center;
        gap: 20px;
    }

    .user-info {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .user-details {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
    }

    .user-name {
        font-size: 0.9rem;
        font-weight: 600;
        color: #333;
    }

    .user-role {
        font-size: 0.75rem;
        color: #777;
    }

    .user-avatar {
        width: 38px;
        height: 38px;
        background: linear-gradient(135deg, #4e73df 0%, #224abe 100%);
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: 0.9rem;
        box-shadow: 0 2px 5px rgba(54, 185, 204, 0.2);
    }

    .divider {
        height: 30px;
        width: 1px;
        background-color: #e3e6f0;
    }

    .logout-btn {
        background-color: #f8f9fc;
        color: #4e73df;
        border: 1px solid #e3e6f0;
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .logout-btn:hover {
        background-color: #4e73df;
        color: white;
        border-color: #4e73df;
        transform: translateY(-1px);
        box-shadow: 0 4px 6px rgba(78, 115, 223, 0.15);
    }

    .logout-btn i {
        font-size: 1rem;
    }

    @media (max-width: 600px) {
        .user-details {
            display: none;
        }
    }
</style>
