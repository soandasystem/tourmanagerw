import { writable } from 'svelte/store';
import { secureStorage } from '../lib/secureStore';
import api from "../lib/apis";

// Recuperamos valores iniciales (equivalente a session en PHP)
const initialUserCursoId = secureStorage.getItem('user_curso_id') || '';
const initialUserContrato = secureStorage.getItem('user_contrato') || '';
const initialUserRuta = secureStorage.getItem('user_ruta') || '';
const initialUserRut = secureStorage.getItem('user_rut') || '';
const initialPaso = secureStorage.getItem('paso') ? parseInt(secureStorage.getItem('paso')) : 1;

// Recuperamos la info de la venta desde secureStorage si ya existe de una sesión previa
const initialPrograma = secureStorage.getItem('programa') || '';
const initialCurso = secureStorage.getItem('curso') || '';
const initialColegio = secureStorage.getItem('colegio') || '';
const initialFechaUltimo = secureStorage.getItem('fechaultimo') || '';
const initialFechaSalida = secureStorage.getItem('fechasalida') || '';

export const openingStore = writable({
    user_curso_id: initialUserCursoId,
    user_contrato: initialUserContrato,
    user_ruta: initialUserRuta,
    user_rut: initialUserRut,
    programa: initialPrograma,
    curso: initialCurso,
    colegio: initialColegio,
    fechaultimo: initialFechaUltimo,
    fechasalida: initialFechaSalida,
    pasoActual: initialPaso
});

// Función asíncrona para obtener y guardar la información de la venta (ej. al hacer login con código de acceso)
export const fetchSaleInfo = async (accessCode, schema) => {
    if (!accessCode) return;
    try {
        const queryParams = 'accesscode=' + accessCode;
        const saleRes = await api.getData("sale/informe", "", queryParams, "", schema);
        if (saleRes.status === "success" && Array.isArray(saleRes.data) && saleRes.data.length > 0) {
            const sale = saleRes.data[0];

            const programa = sale.program_name || '';
            const curso = (sale.establecimiento_nombre || '') + " - " + (sale.curso || '') + " / " + (sale.idcurso || '');
            const colegio = sale.colegio || '';
            const fechaultimo = sale.fecha_ultpag || '';
            const fechasalida = sale.fechasalida || '';

            // Guardar en secureStorage para persistencia al recargar
            secureStorage.setItem('programa', programa);
            secureStorage.setItem('curso', curso);
            secureStorage.setItem('colegio', colegio);
            secureStorage.setItem('fechaultimo', fechaultimo);
            secureStorage.setItem('fechasalida', fechasalida);

            // Actualizar el store reactivo
            openingStore.update(s => ({
                ...s,
                programa,
                curso,
                colegio,
                fechaultimo,
                fechasalida
            }));
        }
    } catch (error) {
        console.error("Error al obtener la información de la venta:", error);
    }
};

// Función para limpiar completamente el store y su almacenamiento persistente (ej. al hacer login)
export const clearOpeningStore = () => {
    secureStorage.removeItem('user_curso_id');
    secureStorage.removeItem('user_contrato');
    secureStorage.removeItem('user_ruta');
    secureStorage.removeItem('user_rut');
    secureStorage.removeItem('paso');
    secureStorage.removeItem('programa');
    secureStorage.removeItem('curso');
    secureStorage.removeItem('colegio');
    secureStorage.removeItem('fechaultimo');
    secureStorage.removeItem('fechasalida');

    openingStore.set({
        user_curso_id: '',
        user_contrato: '',
        user_ruta: '',
        user_rut: '',
        programa: '',
        curso: '',
        colegio: '',
        fechaultimo: '',
        fechasalida: '',
        pasoActual: 1
    });
};
