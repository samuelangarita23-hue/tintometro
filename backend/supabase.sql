-- Tabla donde Tintómetro guarda su estado (cuentas, ventas anotadas, eventos, sesiones).
create table if not exists public.tintometro_estado (
  id text primary key,
  datos jsonb not null,
  actualizado timestamptz not null default now()
);
-- Solo el servidor (con la clave secreta) puede leerla o escribirla.
alter table public.tintometro_estado enable row level security;
