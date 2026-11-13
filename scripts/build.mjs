import { build, context } from 'esbuild';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTranslations, translationInputs } from './i18n.mjs';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'htdocs/luci-static/sharp');
const shared = { absWorkingDir: root, bundle: true, target: ['chrome120', 'firefox120', 'safari17'], logLevel: 'info', legalComments: 'none' };
const configs = [
  { ...shared, entryPoints: ['frontend/ts/main.ts'], outfile: path.join(output, 'sharp.js'), format: 'iife' },
  { ...shared, entryPoints: ['frontend/styles/main.css'], outfile: path.join(output, 'sharp.css') }
];

export async function buildAssets(watch = false, onRebuild) {
  await mkdir(output, { recursive: true });
  const localized = configs.map(config => config.outfile.endsWith('.js') ? {
    ...config,
    plugins: [{ name: 'sharp-translations', setup(builder) {
      builder.onStart(async () => { await buildTranslations(); });
      builder.onLoad({ filter: /frontend[\\/]ts[\\/]i18n\.ts$/ }, async args => ({
        contents: await readFile(args.path, 'utf8'), loader: 'ts', watchFiles: await translationInputs()
      }));
      if (onRebuild) builder.onEnd(async result => { if (!result.errors.length) await onRebuild(); });
    } }]
  } : config);
  if (!watch) { await Promise.all(localized.map(config => build(config))); return []; }
  const contexts = await Promise.all(localized.map(config => context(config)));
  await Promise.all(contexts.map(ctx => ctx.watch()));
  return contexts;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildAssets();
