// Función de Vercel que atiende toda la API (/api/** se reescribe aquí en vercel.json).
// Reutiliza la app Express compilada por `npm --prefix functions run build` (parte del
// buildCommand), es decir, el mismo código que se despliega como Firebase Function `xrlabApi`.
import { app } from '../functions/lib/app.js';

export default app;
