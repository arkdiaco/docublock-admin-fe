import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const EXT = ['.ts', '.html', '.scss'];
const TOKEN_FILES = ['src/styles/_tokens.scss', 'src/styles/_admin-tokens.scss', 'src/app/core/theme/docublock-preset.ts'];
const HOUSE_LOADER = ['src/app/shared/ui/loader.component.ts', 'src/app/shared/ui/busy-icon.component.ts'];

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return EXT.some((ext) => path.endsWith(ext)) && !path.endsWith('.spec.ts') ? [path] : [];
  });

const ALL = [...walk('src/app'), ...walk('src/styles')].sort();
const SCOPES = {
  all: ALL.filter((file) => !TOKEN_FILES.includes(file)),
  screens: ALL.filter((file) => /^src\/app\/(features|core)\//.test(file)),
};

const STATE_COLORS = String.raw`var\(--(dba-(violet|state|role|success|warning|danger)|db-(primary|success|danger|warn|amber|pipeline))[a-z0-9-]*\)`;

const RULES = [
  {
    id: 'barra-de-acento',
    scope: 'all',
    why: 'Las tarjetas con una barra de color al borde están prohibidas. Las filas se separan con border-top de --dba-border-row y el estado va en dba-org-state, dba-role-tag o dba-env-pill.',
    test: new RegExp(String.raw`border-(left|right|top|bottom):\s*[0-9.]+px\s+solid\s+${STATE_COLORS}`, 'g'),
  },
  {
    id: 'pildora-propia',
    scope: 'screens',
    why: 'Los estados y etiquetas usan las piezas de src/app/shared/ui (org-state, role-tag, env-pill, filter-pills); una pantalla no redefine píldoras.',
    test: /\.[a-z0-9-]*(pill|chip|badge|tag)[a-z0-9-]*\s*\{[^}]*background[^}]*border-radius|\.[a-z0-9-]*(pill|chip|badge|tag)[a-z0-9-]*\s*\{[^}]*border-radius[^}]*background/g,
  },
  {
    id: 'color-crudo',
    scope: 'all',
    why: 'Los colores salen de los tokens de src/styles/_admin-tokens.scss, nunca de un hex o rgba suelto.',
    test: /:\s*['"]?(#[0-9a-fA-F]{3,8}\b|rgba?\()/g,
  },
  {
    id: 'token-heredado-en-pantalla',
    scope: 'screens',
    why: 'Las pantallas del admin usan los tokens --dba-*. Los --db-* solo viven dentro de las piezas heredadas de docublock-fe en shared/ui.',
    test: /var\(--db-/g,
  },
  {
    id: 'ancho-centrado',
    scope: 'all',
    why: 'El layout es de ancho completo con el padding de la consola; nada de max-width centrado con margin auto.',
    test: /\{[^}]*max-width:[^}]*margin(-inline)?:\s*(0\s+)?auto|\{[^}]*margin(-inline)?:\s*(0\s+)?auto[^}]*max-width:/g,
  },
  {
    id: 'control-fuera-de-primeng',
    scope: 'all',
    why: 'La librería de UI es PrimeNG a través de las piezas de src/app/shared/ui; Material y el CDK no se usan en el admin.',
    test: /@angular\/(material|cdk)|<mat-[a-z]|\bmat[A-Z][A-Za-z]*\b|\bMat[A-Z][A-Za-z]*(Module|Ref|Dialog)\b|MAT_[A-Z_]+|\bcdk[A-Z][A-Za-z]*\b|mat-mdc-/g,
  },
  {
    id: 'spinner-ajeno',
    scope: 'all',
    exclude: HOUSE_LOADER,
    why: 'Toda espera usa dba-loader, dba-section-loader o dba-busy-icon; ni p-progress-spinner ni pi-spin sueltos.',
    test: /ProgressSpinner|p-progress-?spinner|\bpi-spin\b/g,
  },
];

const found = {};
const detail = {};
for (const rule of RULES) {
  for (const file of SCOPES[rule.scope].filter((file) => !(rule.exclude ?? []).includes(file))) {
    const hits = readFileSync(file, 'utf8').match(rule.test);
    if (!hits) continue;
    found[rule.id] = (found[rule.id] ?? 0) + hits.length;
    (detail[rule.id] ??= []).push(`${file} (${hits.length})`);
  }
}

const BASELINE = JSON.parse(readFileSync(new URL('./ui-guard.baseline.json', import.meta.url), 'utf8'));
let failed = false;
for (const rule of RULES) {
  const now = found[rule.id] ?? 0;
  const base = BASELINE[rule.id] ?? 0;
  const mark = now > base ? 'SUBIÓ' : now < base ? 'bajó' : 'igual';
  console.log(`${rule.id}: ${now} (línea base ${base}) ${mark}`);
  if (now > base) {
    failed = true;
    console.log(`  ${rule.why}`);
    for (const line of detail[rule.id] ?? []) console.log(`  · ${line}`);
  }
}

if (failed) {
  console.log('\nHay más incumplimientos del sistema de diseño que en la línea base.');
  console.log('Usa las piezas de src/app/shared/ui y los tokens --dba-* (mira /sistema/diseno)');
  console.log('antes de escribir estilos nuevos. La línea base solo baja.');
  process.exit(1);
}
console.log('\nSistema de diseño: sin incumplimientos nuevos.');
