import { writable } from 'svelte/store';

// Intentamos recuperar el idcl guardado en localStorage
const savedIdcl = localStorage.getItem('idcl') || '';

export const tenantStore = writable(savedIdcl);

// Cada vez que cambie, lo guardamos en localStorage
tenantStore.subscribe(value => {
    if (value) {
        localStorage.setItem('idcl', value);
    }
});
