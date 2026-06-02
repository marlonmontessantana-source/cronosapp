# CronosApp ⏰

Calendario web para **agendar tareas**, marcarlas como cumplidas ("chulear"), guardar un **historial** y **repetirlas** con la periodicidad que definas. Incluye:

- 🔐 **Autenticación**: el **primer** usuario registrado es **administrador** y aprueba a los demás.
- 👤 **Datos privados por usuario**: cada quien ve solo sus tareas.
- 🔁 **Recurrencia**: diaria, semanal (días concretos) o mensual, cada N períodos, con fecha de fin opcional.
- ✅ **Chuleo + historial** de lo completado.
- 🌗 **Modo día / noche**.
- 🎙️ **Programación por voz** (Web Speech API, español).
- 🔔 **Recordatorios push** del navegador (Web Push / VAPID).

## Tecnología

- **Backend**: Node.js 24 + Express, módulo nativo `node:sqlite` (sin compilación), JWT en cookie httpOnly, `web-push`, `node-cron`.
- **Frontend**: React + Vite, CSS con variables para el theming, `chrono-node` para parsear fechas habladas.
- **Empaquetado**: Dockerfile multi-stage; un solo contenedor sirve la API y el frontend compilado.

## Desarrollo local

```bash
npm run setup       # instala dependencias de server y web
npm run build       # compila el frontend a web/dist
# genera .env con claves (ver más abajo) y luego:
npm start           # http://localhost:3000
```

Para desarrollo con recarga del frontend: `npm run dev:server` y `npm run dev:web` (Vite en :5173 con proxy a :3000).

### Variables de entorno (`.env`)

Copia `.env.example` a `.env`. Genera las claves:

```bash
# JWT secret
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# Claves VAPID para push
npx web-push generate-vapid-keys
```

| Variable | Descripción |
|---|---|
| `JWT_SECRET` | Cadena aleatoria larga para firmar sesiones. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Claves para notificaciones push. |
| `VAPID_SUBJECT` | `mailto:` de contacto. |
| `DATA_DIR` | Carpeta de la BD SQLite (en producción: volumen persistente). |

> La voz y las notificaciones push **requieren HTTPS** (o `localhost`).

## Despliegue en VPS Hostinger con Easypanel

El VPS (Ubuntu 24.04) ya trae **Easypanel**. Pasos (todo desde el navegador):

1. **DNS** — en hPanel → Dominios → `vetacreativa.co` → Zona DNS: registro **A** `cronosapp` → IP del VPS (`72.60.166.170`).
2. **App en Easypanel** — crear servicio *App* en un proyecto:
   - **Source**: este repositorio (GitHub) **o** subir el código; **Build**: *Dockerfile*.
   - **Environment**: definir `JWT_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NODE_ENV=production`, `DATA_DIR=/data`.
   - **Volumes**: montar un volumen persistente en `/data` (BD SQLite).
   - **Domains**: añadir `cronosapp.vetacreativa.co`, puerto interno `3000`, activar **HTTPS** (Let's Encrypt).
3. **Deploy** y abrir `https://cronosapp.vetacreativa.co`. El primer registro será el administrador.

## Uso

1. Regístrate (el primero queda como admin y aprueba a los demás desde **👥 Usuarios**).
2. **+ Nueva tarea**: título, fecha, hora, repetición y recordatorio. El botón 🎙️ permite dictarla.
3. Haz clic en un día para ver sus tareas y **chulearlas**. Lo completado va al **📜 Historial**.
4. Activa el 🔔 para recibir recordatorios y usa ☀️/🌙 para cambiar de tema.
