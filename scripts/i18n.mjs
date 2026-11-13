import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import ts from 'typescript';

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const poRoot = path.join(root, 'po');
const vendor = path.join(root, 'scripts/vendor/po2lmo');
const quote = value => JSON.stringify(value);

async function writeChanged(file, value) {
  const bytes = Buffer.from(value);
  if ((await readFile(file).catch(() => Buffer.alloc(0))).equals(bytes)) return;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(`${file}.tmp`, bytes);
  await rename(`${file}.tmp`, file);
}

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory()
    ? filesIn(path.join(directory, entry.name)) : path.join(directory, entry.name)))).flat();
}

export async function translationInputs() {
  return [...await filesIn(poRoot), ...await filesIn(vendor),
    ...await filesIn(path.join(root, 'ucode/template/themes/sharp')),
    ...await filesIn(path.join(root, 'root/usr/share/luci/menu.d'))]
    .filter(file => !file.endsWith('.pot') && !file.endsWith('.tmp'));
}

async function extractMessages() {
  const messages = new Map();
  const add = (id, plural, file, line, context = 'sharp') => {
    const key = `${context ?? ''}\u0004${id}`;
    const entry = messages.get(key) ?? { id, plural, context, refs: new Set() };
    if (entry.plural !== plural) throw new Error(`Conflicting plural definitions: ${id}`);
    entry.refs.add(`${path.relative(root, file).split(path.sep).join('/')}:${line}`);
    messages.set(key, entry);
  };
  for (const file of await filesIn(path.join(root, 'frontend/ts'))) {
    if (!file.endsWith('.ts') || file.endsWith('.d.ts')) continue;
    const source = ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = node => {
      if (ts.isCallExpression(node)) {
        const name = node.expression.getText(source);
        const singular = node.arguments[name === 'tn' ? 1 : 0];
        const plural = node.arguments[2];
        if (['t', 'tn', '_'].includes(name) && singular && ts.isStringLiteral(singular)) {
          if (name === 'tn' && (!plural || !ts.isStringLiteral(plural))) throw new Error(`Plural must be a string literal: ${file}`);
          add(singular.text, name === 'tn' ? plural.text : null, file,
            source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
            name === '_' ? (ts.isStringLiteral(node.arguments[1] ?? {}) ? node.arguments[1].text : null) : 'sharp');
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  for (const file of await filesIn(path.join(root, 'ucode/template/themes/sharp'))) {
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(/_\('((?:[^'\\]|\\.)*)'(?:,\s*'([^']+)')?\)/g)) {
      add(match[1].replace(/\\'/g, "'"), null, file, source.slice(0, match.index).split('\n').length, match[2] ?? null);
    }
  }
  for (const file of await filesIn(path.join(root, 'root/usr/share/luci/menu.d'))) {
    if (!file.endsWith('.json')) continue;
    for (const node of Object.values(JSON.parse(await readFile(file, 'utf8')))) {
      if (node.title) add(node.title, null, file, 1, null);
    }
  }
  const header = 'msgid ""\nmsgstr ""\n'
    + '"Project-Id-Version: luci-theme-sharp\\n"\n'
    + '"Content-Type: text/plain; charset=UTF-8\\n"\n'
    + '"Content-Transfer-Encoding: 8bit\\n"\n';
  const entries = [...messages.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const template = entries.map(entry => [
    `#: ${[...entry.refs].sort().join(' ')}`,
    ...(entry.id.includes('%d') ? ['#, c-format'] : []),
    ...(entry.context ? [`msgctxt ${quote(entry.context)}`] : []),
    `msgid ${quote(entry.id)}`,
    ...(entry.plural ? [`msgid_plural ${quote(entry.plural)}`, 'msgstr[0] ""', 'msgstr[1] ""'] : ['msgstr ""'])
  ].join('\n')).join('\n\n');
  await writeChanged(path.join(poRoot, 'templates/sharp.pot'), `${header}\n${template}\n`);
  return entries.length;
}

async function converter() {
  const sources = ['po2lmo.c', 'lib/hash.c', 'lib/lmo.h'];
  const digest = createHash('sha256');
  for (const file of sources) digest.update(await readFile(path.join(vendor, file)));
  const fingerprint = digest.digest('hex');
  const binary = path.join(root, `.dev/tools/po2lmo-${process.platform}-${process.arch}`);
  if (await access(binary).then(() => true, () => false)
    && await readFile(`${binary}.sha256`, 'utf8').catch(() => '') === fingerprint) return binary;
  await mkdir(path.dirname(binary), { recursive: true });
  try {
    await run(process.env.CC || 'cc', ['-O2', '-std=gnu99', '-o', binary,
      path.join(vendor, 'po2lmo.c'), path.join(vendor, 'lib/hash.c')]);
  } catch (error) {
    throw new Error(`无法构建 LuCI 翻译工具。请安装 C 编译器（macOS: xcode-select --install；Linux: cc/gcc），或用 CC 指定编译器。\n${error.stderr || error.message}`);
  }
  await writeFile(`${binary}.sha256`, fingerprint);
  return binary;
}

export async function buildTranslations() {
  const languages = JSON.parse(await readFile(path.join(poRoot, 'languages.json'), 'utf8'));
  if (!languages.en?.source) throw new Error('English must remain the source/fallback language.');
  const messages = await extractMessages();
  const binary = await converter();
  const defaults = ["#!/bin/sh", '# Generated by scripts/i18n.mjs. Edit po/languages.json.', "uci -q batch <<'EOF'"];
  const locales = new Set();
  await mkdir(path.join(root, '.dev/i18n'), { recursive: true });
  for (const [directory, language] of Object.entries(languages)) {
    if (language.source) continue;
    if (!/^[A-Za-z0-9_]+$/.test(directory) || !/^[a-z]{2,3}(?:-[a-z0-9]{2,4})?$/.test(language.locale)
      || !language.name || /['\\\r\n]/.test(language.name) || locales.has(language.locale)) {
      throw new Error(`Invalid or duplicate language registration: ${directory}`);
    }
    locales.add(language.locale);
    const input = path.join(poRoot, directory, 'sharp.po');
    const output = path.join(root, '.dev/i18n', `sharp.${language.locale}.lmo`);
    await run(binary, [input, output]);
    await writeChanged(path.join(root, 'root/usr/lib/lua/luci/i18n', path.basename(output)), await readFile(output));
    defaults.push(`set luci.languages.${language.locale.replaceAll('-', '_')}='${language.name}'`);
  }
  defaults.push('commit luci', 'EOF', 'exit 0', '');
  await writeChanged(path.join(root, 'root/etc/uci-defaults/31_luci-theme-sharp-languages'), defaults.join('\n'));
  return { messages, locales: [...locales] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildTranslations();
  console.log(`Sharp i18n: ${result.messages} messages; English source + ${result.locales.join(', ')}`);
}
