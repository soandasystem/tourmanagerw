import { writable } from 'svelte/store';
import { secureStorage } from '../lib/secureStore'

// Ahora cargamos los datos de forma desencriptada
const initialToken = secureStorage.getItem('_tk_') || null;
const initialUser = secureStorage.getItem('_us_') || null;

export const authStore = writable({
    isAuthenticated: !!initialToken || !!initialUser,
    token: initialToken,
    user: initialUser
});

export const login = (token, user) => {
    // Guardamos con nombres de clave poco obvios
    secureStorage.setItem('_tk_', token);
    secureStorage.setItem('_us_', user);

    authStore.set({
        isAuthenticated: true,
        token,
        user
    });
};

export const logout = () => {
    secureStorage.removeItem('_tk_');
    secureStorage.removeItem('_us_');
    authStore.set({
        isAuthenticated: false,
        token: null,
        user: null
    });
};
