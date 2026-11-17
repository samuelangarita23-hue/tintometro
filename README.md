# Tintómetro

Predice cuántos cafés vende una cafetería y le dice qué mueve sus ventas, con regresión multilineal cuadrática por mínimos cuadrados.
Proyecto de Álgebra Lineal I · Universidad de La Sabana · Samuel Angarita García y Alejandro Serna.

En línea: **https://tintometro.cafe**. Todo lo sirve el servidor de Render: la página (`backend/public/index.html`) y la API (`/api/...`).
Respaldo: https://tintometro-api.onrender.com. La copia en GitHub Pages (`index.html` en la raíz) usa esa misma API.

```
index.html        Copia de la página para GitHub Pages
backend/public/   La página que sirve Render en tintometro.cafe
backend/          API en Node/Express con base de datos JSON
  server.js       Rutas: cuentas, ventas, rachas, calendario, historial de cargas
  demo.js         Las dos cafeterías de ejemplo (datos simulados)
  rachas.js       Cálculo de las rachas
render.yaml       Configuración para desplegar el backend en Render
```

## 1. Publicar la página en GitHub Pages

1. Crea un repositorio en GitHub y sube todo el contenido de esta carpeta.
2. En el repositorio: **Settings → Pages → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**.
3. En uno o dos minutos queda en `https://USUARIO.github.io/REPOSITORIO/`.
   Con `#herramienta` al final abre directo la parte para cafeterías.

## 2. Desplegar el backend en Render

1. En [render.com](https://render.com): **New → Blueprint** y escoge este repositorio. Render lee `render.yaml`
   y crea el servicio `tintometro-api` dentro de la carpeta `backend`.
2. Cuando termine, la API queda en `https://tintometro-api.onrender.com` (si Render te da otro nombre, ver el paso 3).
3. Si la dirección es distinta, cámbiala en `index.html` (busca `CU_API_DEF`) o, sin tocar código,
   abre la página con `?api=https://tu-servicio.onrender.com` una vez: la dirección queda guardada en ese navegador.

**Datos guardados (Supabase).** En el plan gratis de Render el disco se borra en cada reinicio, así que el servidor guarda
su estado en una tabla de Supabase (gratis). Pasos: crear un proyecto en supabase.com, correr `backend/supabase.sql` en el
SQL Editor y poner en Render (Environment) `SUPABASE_URL` y `SUPABASE_KEY` (la clave *service_role*). Sin esas variables
guarda en un archivo JSON local, que se pierde al reiniciar.

**Servidor dormido.** En el plan gratis el servicio se duerme tras 15 minutos sin uso y la primera petición tarda
hasta un minuto. La página muestra "Despertando el servidor…". Antes de una presentación, ábrela unos minutos antes.

## 3. Probar en tu computador

```bash
cd backend
npm install
npm start            # API en http://localhost:3000
```

En otra terminal, desde la carpeta raíz: `python -m http.server 8080` y abre `http://localhost:8080`.
Servida desde `localhost`, la página usa automáticamente la API local.

## Cafeterías de ejemplo

| Cafetería | Ciudad | Producto | Meta diaria | Abre | Datos desde |
|---|---|---|---|---|---|
| Café La Esquina | Chía | tinto | 100 | lunes a sábado | 17 nov 2025 |
| Tinto & Pan | Zipaquirá | café con leche | 85 | todos los días | 2 mar 2026 |
| Granos del Parque | Bogotá | capuchino | 120 | lunes a viernes (cierra festivos) | 13 ene 2026 |
| La Tostadora | Chía | café de origen | 70 | miércoles a domingo | 3 jun 2026 |
| Montaña Fría | Tunja | tinto | 110 | lunes a sábado | 1 dic 2025 |
| Café Laureles | Medellín | café helado | 95 | todos los días | 6 abr 2026 |

Se entra con un clic en la página (sin contraseña), o con su correo `demo@…` y la contraseña `cafe2026`.
Sus ventas son simuladas con una fórmula conocida (precio, precio², temperatura, lluvia, promoción, día de la semana,
festivos y vacaciones). Cada día el servidor agrega solo las ventas de ayer, así sus rachas siguen vivas.
También traen los festivos de Colombia, eventos propios en el calendario y un historial de archivos subidos.

## Rachas

- **Días seguidos anotando ventas.** Cuenta solo los días que la cafetería abre. Si hoy todavía no anotó, la racha sigue viva desde ayer.
- **Días seguidos cumpliendo la meta.** Días abiertos seguidos con ventas mayores o iguales a la meta diaria.
- **Semanas seguidas vendiendo más.** Semanas completas (lunes a domingo) seguidas en las que vendió más que la semana anterior.

Cada una muestra también su récord.

## API

Todas las rutas con 🔒 piden el encabezado `Authorization: Bearer <token>`.

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/salud` | Estado del servicio |
| GET | `/api/demo` | Lista de cafeterías de ejemplo |
| POST | `/api/demo/:slug/entrar` | Entra a una cafetería de ejemplo |
| POST | `/api/registro` | Crea una cuenta (`nombre, ciudad, producto, meta, correo, clave`) |
| POST | `/api/entrar` | Entra con `correo` y `clave` (máximo 10 intentos cada 15 min) |
| POST | `/api/salir` 🔒 | Cierra la sesión |
| GET / PUT | `/api/yo` 🔒 | Perfil, rachas y resumen / editar perfil, meta y días que abre |
| GET | `/api/ventas` 🔒 | Ventas (`?desde=&hasta=`) |
| POST | `/api/ventas` 🔒 | Anota o corrige un día (`fecha, precio, ventas, promo, tipo`) |
| DELETE | `/api/ventas/:fecha` 🔒 | Borra un día |
| POST | `/api/ventas/importar` 🔒 | Guarda varias filas de un Excel y lo registra en el historial |
| GET | `/api/ventas.csv` 🔒 | Ventas en CSV, listas para el análisis |
| GET / POST | `/api/eventos` 🔒 | Calendario (`?mes=AAAA-MM`) / agregar evento (`fecha, tipo, titulo`) |
| DELETE | `/api/eventos/:id` 🔒 | Borra un evento |
| GET | `/api/cargas` 🔒 | Historial de archivos subidos |
| POST | `/api/admin/reiniciar-demo` | Recrea las cafeterías de ejemplo (encabezado `x-admin-key` = `ADMIN_KEY`) |

Las contraseñas se guardan con `scrypt` y sal. Las sesiones duran 30 días.
