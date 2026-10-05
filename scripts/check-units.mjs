import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = 'src';
const EXT = ['.ts', '.scss'];
const REM = /(?<![\w-])-?\d*\.?\d+rem\b/;
const RAIZ_ENCOGIDA = /html[^{]*\{[^}]*font-size:\s*(?!16px)\d/;

const ficheros = [];
const recorrer = (dir) => {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) recorrer(ruta);
    else if (EXT.some((e) => ruta.endsWith(e)) && !ruta.endsWith('.spec.ts')) ficheros.push(ruta);
  }
};
recorrer(RAIZ);

const fallos = [];
for (const f of ficheros) {
  const contenido = readFileSync(f, 'utf8');
  contenido.split('\n').forEach((linea, i) => {
    if (REM.test(linea)) fallos.push(`${f}:${i + 1}  usa rem: ${linea.trim().slice(0, 80)}`);
    if (RAIZ_ENCOGIDA.test(linea)) fallos.push(`${f}:${i + 1}  cambia el tamaño de la raíz: ${linea.trim()}`);
  });
}

if (fallos.length) {
  console.error('\nLas medidas se escriben en px, no en rem.\n');
  console.error(
    'PrimeNG usa rem por dentro asumiendo una raíz de 16px. Si se toca la raíz o se mezclan\n' +
      'unidades, cada componente que no hayamos sobrescrito se descuadra en silencio: el build\n' +
      'pasa y la pantalla queda mal. La maqueta está en px; los tokens también.\n',
  );
  for (const fallo of fallos) console.error('  ' + fallo);
  console.error('');
  process.exit(1);
}

console.log(`Unidades correctas en ${ficheros.length} ficheros.`);
