# Cómo devolver el servicio de Render a Tapin

Tintómetro corre temporalmente en el servicio **Tapin** de Render (plan Starter, disco de 1 GB en `/var/data`).
Tintómetro guarda sus datos en `/var/data/tintometro/` y no toca los archivos de Tapin.

Configuración original de Tapin (16 nov 2026):

| Ajuste | Valor de Tapin |
|---|---|
| Source | `samuelangarita23-hue/tapin-backend` |
| Branch | `main` (último deploy: commit `fc97c86`) |
| Root Directory | *(vacío)* |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Disco | `/var/data`, 1 GB |
| Dominios de Tapin | `tapincol.com`, `www.tapincol.com` (Render: `tapin-backend-zz1o.onrender.com`) |
| Variables de entorno | No se tocaron. Tintómetro usa `DATA_DIR` de Tapin + `/tintometro` |

Para devolverlo:
1. Settings → Build → Source → **Edit** → `tapin-backend`, rama `main`.
2. En esa misma ventana: Build Command `npm install` y Start Command `npm start` (para Tintómetro se pusieron `cd backend && npm install` y `cd backend && npm start`).
3. Custom Domains → quitar `tintometro.cafe` y `www.tintometro.cafe` (dejar `tapincol.com` y `www.tapincol.com`).
4. Manual Deploy → Deploy latest commit. Revisar que tapincol.com y `/demo` respondan.
5. (Opcional) Los datos de Tintómetro quedan en `/var/data/tintometro/`; se pueden copiar antes de borrarlos.

6. Si Tintómetro se vuelve a pasar a otro servicio, en Spaceship cambiar el CNAME `www` de `tintometro.cafe` (hoy apunta a `tapin-backend-zz1o.onrender.com`).
