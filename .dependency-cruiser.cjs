module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'las-features-no-se-cruzan',
      severity: 'error',
      comment:
        'Una feature no importa de otra. Lo que dos necesitan compartir sube a shared/, y si guarda estado de aplicacion, a core/.',
      from: { path: '^src/app/features/([^/]+)/' },
      to: { path: '^src/app/features/(?!$1)[^/]+/' },
    },
    {
      name: 'core-no-conoce-features',
      severity: 'error',
      comment: 'core/ es el armazon: sesion, http, idioma, layout. No puede depender de ninguna pantalla.',
      from: { path: '^src/app/core' },
      to: { path: '^src/app/features' },
    },
    {
      name: 'shared-no-conoce-features',
      severity: 'error',
      comment: 'shared/ es reutilizable por definicion: si necesita una feature, no es shared.',
      from: { path: '^src/app/shared' },
      to: { path: '^src/app/features' },
    },
    {
      name: 'shared-no-conoce-core',
      severity: 'error',
      comment:
        'shared/ son piezas sin estado de aplicacion. Si necesita la sesion o el enrutador de la app, pertenece a core/.',
      from: { path: '^src/app/shared' },
      to: { path: '^src/app/core' },
    },
    {
      name: 'los-entornos-solo-se-leen-desde-core',
      severity: 'error',
      comment:
        'environment.ts se lee una sola vez, en core/config. Las pantallas piden API_BASE_URL o APP_ENV por inyeccion.',
      from: { path: '^src/app/(features|shared)' },
      to: { path: '^src/environments' },
    },
    {
      name: 'sin-huerfanos',
      severity: 'warn',
      comment: 'Fichero que nadie importa: o se usa o se borra.',
      from: { orphan: true, pathNot: ['^src/(main|styles|test-setup)', '\\.spec\\.ts$', '\\.d\\.ts$'] },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.app.json' },
    tsPreCompilationDeps: true,
    exclude: { path: '\\.spec\\.ts$' },
  },
};
