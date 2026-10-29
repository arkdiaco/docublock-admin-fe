# docublock-admin-fe

La consola del personal de plataforma. Habla solo con `docublock-core-be`
(`/api/core/platform/*`). El plan de trabajo está en
`Proyecto/PLAN_FASES_ADMINISTRADOR_PLATAFORMA_2026-10-28.md`. Se avanza fase por fase
y cada fase la arranca Roger.

## Antes de escribir una sola línea de estilos

El diseño ya existe y no se inventa. Es el sistema de diseño entregado: F0 más las
pantallas A01–A05. Nunca se usa el estilo por defecto de Claude. Antes de maquetar,
abre `/sistema/diseno` en el navegador y las piezas de `src/app/shared/ui`:

| Qué vas a hacer | Pieza obligatoria | Pantalla de referencia |
|---|---|---|
| Una lista | `dba-data-table` + `db-pager` + `db-filter-pills`, filas `dba-tr`/`dba-td` de `src/styles/_admin-table.scss` | Organizaciones (A03) |
| La cabecera de una ficha | `dba-record-header` + `db-underline-tabs` | Ficha de organización (A04) |
| Un estado | `dba-org-state`, `dba-role-tag`, `dba-env-pill` | cualquiera |
| Una métrica | `dba-kpi-card`, `db-stat-band`, `dba-quota-bar` | Visión general, ficha |
| Un campo de formulario | `dba-field` sobre PrimeNG | Acceso (A01) |
| Un botón | `button[dba-button]`; lo accionable va en morado primario, nunca en negro | cualquiera |
| Un diálogo | `db-dialog` / `db-modal-shell` vía `DialogService`; lo destructivo pide motivo y, si es grave, `challenge` | `/sistema/diseno` |
| Un evento de bitácora | `dba-audit-event` | Auditoría (A05) |
| Vacío / cargando | `dba-empty-state` / `db-loader`, `db-section-loader`, `db-busy-icon` | cualquiera |
| Un menú de acciones (fila, cuenta) | `dba-action-menu` sobre el popover; nunca `p-menu` | Personal |
| Una sección nueva del menú | una entrada en `CONSOLE_GROUPS` de `core/layout/console-nav.ts`; el menú (`dba-nav-group`) y la ruta salen de ahí | cualquier grupo |
| Textos | clases de `src/styles/_admin-typography.scss` (`dba-page`, `dba-section`, `dba-eyebrow`, `dba-meta`, `dba-mono`…) | cualquiera |

Si falta una pieza, se crea en `shared/ui` con los tokens del sistema y se muestra en
`/sistema/diseno` antes de usarla en una pantalla.

Los colores, radios y tamaños salen de `src/styles/_admin-tokens.scss` (`--dba-*`).
Los `--db-*` de `_tokens.scss` solo viven dentro de las piezas heredadas de docublock-fe.

## Prohibido

- **Tarjetas con una barra de color en el borde** (`border-left: 3px solid ...`).
  Las filas se separan con `border-top: 1px solid var(--dba-border-row)`.
- Redefinir píldoras, chips o insignias en una pantalla: eso es `dba-org-state`,
  `dba-role-tag` o `dba-env-pill`.
- Cajas con borde y radio propias donde ya hay una pieza.
- Un hex o un `rgba()` suelto, o un token `--db-*` en una pantalla.
- `max-width` centrado con `margin: auto`: el layout es de ancho completo.
- Material, el CDK o cualquier spinner que no sea el loader de la casa.
- Medidas en `rem`: todo en px, porque PrimeNG asume una raíz de 16px.
- `alert`, `confirm` y `prompt` nativos: se usan `DialogService` y `NotificationService`.
- Llaves de traducción crudas en pantalla. `es.json` y `en.json` van con paridad.
- Pintar algo que el backend no tiene.
- Comentarios en el código: el porqué va en el mensaje del commit.

## Antes de dar una pantalla por terminada

```bash
npm run verify
```

`verify` encadena lint, `check:units`, `ui:check`, arquitectura (dependency-cruiser),
tests y el build de producción. Es lo mismo que corre Cloud Build.

`npm run ui:check` compara los incumplimientos del sistema de diseño contra
`scripts/ui-guard.baseline.json` y falla si suben. La línea base **solo baja**: cuando
corriges un incumplimiento, bájala a mano en el mismo commit. Si tu cambio la sube, el
que está mal es el estilo, no la guardia.

Además: mira la pantalla en el navegador a 1440 y a 375 px, y barre el DOM en busca de
llaves de traducción crudas.
