// Values from the .env file. Vite only exposes variables that start with "VITE_".
// Note: .env values are always strings, so we compare with 'true'.
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true'
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
