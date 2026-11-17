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
| Variable agregada para Tintómetro | `TINTOMETRO_DATA_DIR=/var/data/tintometro` |

Para devolverlo:
1. Settings → Build → Source → volver a `tapin-backend`, rama `main`.
2. Settings → Root Directory → dejarlo vacío.
3. Environment → borrar `TINTOMETRO_DATA_DIR`.
4. Custom Domains → quitar `tintometro.cafe` y `www.tintometro.cafe` (deja `tapin.page`).
5. Manual Deploy → Deploy latest commit. Revisar que tapin.page y `/demo` respondan.
6. (Opcional) Los datos de Tintómetro quedan en `/var/data/tintometro/`; se pueden copiar antes de borrarlos.
