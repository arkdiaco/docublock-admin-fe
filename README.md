# Docublock Admin

El administrador de la plataforma Docublock: la consola del personal interno para operar
organizaciones, planes y suscripciones, catálogos, facturación, documentos, integraciones y
tareas de mantenimiento **sin tocar la base de datos**. Sustituye a `docublock-admin`
(legacy, Angular + Material contra cinco backends que ya no existen).

Habla con `docublock-core-be` y solo con él, a través de las rutas `/api/core/platform/*`.
El análisis que lo define está en `Proyecto/ANALISIS_ADMINISTRADOR_PLATAFORMA_2026-10-04.md`.

## Reglas de la casa

Las mismas de `docublock-fe`, sin excepciones:

- **Angular 21 zoneless**, standalone puro (cero `NgModule`), Signals para el estado,
  **PrimeNG** para formularios y diálogos, i18n español/inglés con paridad obligatoria.
- **Feature-first**: `core/` lo transversal, `shared/` lo reutilizable, `features/<área>/`
  cada módulo con sus páginas, componentes, stores y `domain/` puro.
- **Carga perezosa en todas las rutas.**
- **Sin comentarios en el código**: el porqué va en el mensaje del commit.
- **Nunca diálogos del navegador**: `alert`, `confirm` y `prompt` están prohibidos por ESLint;
  se usa `DialogService` / `NotificationService`.
- **Nunca llaves i18n crudas en pantalla**: el test de catálogos compara `es.json` y `en.json`,
  y cada spec de página comprueba que no quede ninguna llave sin traducir.
- **Medidas en px, nunca rem** (`npm run check:units`): PrimeNG asume una raíz de 16px.
- **Prefijo de selector `dba`** (los componentes heredados de `docublock-fe` conservan `db`).
- **Frontera de capas vigilada** por dependency-cruiser (`npm run arch`): sin ciclos, las
  features no se cruzan, `core` y `shared` no conocen features, `shared` no conoce `core`,
  `environment.ts` solo se lee desde `core/config`, y un fichero huérfano se borra.
- **Loader de la casa** para toda espera, **métricas con el patrón de la casa**, **botones
  accionables en morado primario**, todo dentro del shell.
- **Nunca un secreto ni un OTP en pantalla.** Las acciones destructivas o sensibles piden
  motivo y van con confirmación; todo lo que escribe el admin queda en la bitácora de plataforma.

`npm run verify` encadena lint, unidades, arquitectura, tests y build. Es lo que corre Cloud Build.

## Acceso

Entra el **personal de plataforma** (`platformStaff` en `/auth/me`) con el mismo OTP del core
(`POST /auth/request-otp` → `POST /auth/login`). Un usuario del core que no sea de plataforma
entra al core pero aquí se le cierra la sesión (`NotPlatformStaffError`). Los permisos finos
`platform:*` llegan en `platformPermissions` y los exigen `platformPermissionGuard` /
`platformMatchGuard` vía `route.data.platform`.

| Medida | Dónde |
|---|---|
| Token en `localStorage['dba.session']`, perfil en memoria, limpieza al salir | `core/auth/` |
| 401 → refresco silencioso y un solo reintento; si falla, al acceso | `core/http/http.interceptors.ts` |
| CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` | `docker/nginx.conf` |
| Solo lo que lleva huella es inmutable; `index.html` y `env.js` nunca se cachean; barra «versión nueva» | `docker/nginx.conf`, `core/app-update/` |
| Presupuesto de tamaño: el build falla pasados 1,5 MB | `angular.json` |

## Arquitectura

```
src/app/
├── core/        armazón — existe una sola vez
│   ├── app-update/  detección de versión nueva tras desplegar
│   ├── auth/        AuthStore, SessionService, AuthApi, guards, almacenamiento
│   ├── browser/     navegación dura
│   ├── config/      API_BASE_URL y APP_ENV (único sitio que lee environment.ts)
│   ├── http/        baseUrl → auth → error
│   ├── i18n/        catálogos, idioma, calendario de PrimeNG
│   ├── theme/       preset de marca sobre Aura
│   └── ui/          NotificationService, DialogService, DialogHost
├── shared/      piezas reutilizables SIN estado de aplicación
│   ├── ui/          dialog, modal-shell, loader, icon, pager, filter-pills, underline-tabs, stat-band, nav-menu…
│   ├── http/        export-state, exported-file, query-params, save-blob, error-code
│   ├── i18n/        money y plural-key pipes
│   └── domain/      helpers puros
└── features/    una carpeta por módulo del administrador
    └── <módulo>/
        ├── <módulo>.api.ts        todos los endpoints del módulo
        ├── <módulo>.models.ts
        ├── *.store.ts             stores por página (@Injectable() sin root)
        ├── domain/                funciones puras + specs
        ├── pages/                 una por ruta
        └── ui/                    diálogos y piezas del módulo
```

Hoy solo existe `features/status` (`/estado`): comprueba en vivo que el admin alcanza su
backend. Cada módulo entra con su bloque, tras el inventario de su backend.

## Desarrollo

```bash
npm install
npm start          # http://localhost:4208 contra http://localhost:3810/api/core
npm run verify     # lint + unidades + arquitectura + tests + build
```

La URL del core en desarrollo está en `src/environments/environment.ts`; en Cloud Run la
inyecta el contenedor al arrancar (`env.js` vía `CORE_API_URL`), por eso la misma imagen sirve
para canary y producción. Pipeline en `cloudbuild.yaml` (`docublock-admin-fe-canary` /
`docublock-admin-fe`).

### Trampa conocida del lock

Instalar un paquete desde macOS quita del `package-lock.json` los tres paquetes opcionales
`@emnapi/core`, `@emnapi/runtime` y `@emnapi/wasi-threads`, y `npm ci` en la imagen Alpine de
Cloud Build falla. Después de cualquier `npm install`, comprobar:

```bash
grep -c '"node_modules/@emnapi' package-lock.json   # debe dar 3
```
