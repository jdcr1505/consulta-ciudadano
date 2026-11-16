import Constants from 'expo-constants';

// URL base de la API. Prioridad: variable EXPO_PUBLIC_API_URL > app.json (extra.apiUrl).
// 10.0.2.2 es la dirección del computador anfitrión vista desde el emulador Android.
// En un teléfono físico use la IP de su computador en la red local, p. ej. http://192.168.1.20:4000
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? Constants.expoConfig?.extra?.apiUrl ?? 'http://10.0.2.2:4000').replace(/\/$/, '');
