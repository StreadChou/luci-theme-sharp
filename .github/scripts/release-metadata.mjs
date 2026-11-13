import { readFile } from 'node:fs/promises';

const read = file => readFile(new URL(`../../${file}`, import.meta.url), 'utf8');
const pkg = JSON.parse(await read('package.json'));
const lock = JSON.parse(await read('package-lock.json'));
const makefile = await read('Makefile');
const version = pkg.version;
const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(alpha|beta|rc)\.([1-9]\d*))?$/.exec(version);
if (!match) throw new Error('Use a version such as 0.1.0 or 0.2.0-beta.1.');
if (makefile.match(/^PKG_VERSION:=(\S+)$/m)?.[1] !== version
  || lock.version !== version || lock.packages[''].version !== version) {
  throw new Error('Makefile, package.json and package-lock.json must have matching versions.');
}
const revision = makefile.match(/^PKG_RELEASE:=([1-9]\d*)$/m)?.[1];
if (!revision) throw new Error('PKG_RELEASE must be a positive integer.');
if (process.env.GITHUB_REF_TYPE === 'tag') {
  const tag = process.env.GITHUB_REF_NAME;
  if (tag !== `v${version}`) throw new Error(`Expected tag v${version}, got ${tag}.`);
  if (!(await read(`docs/releases/${tag}.md`)).trim()) throw new Error('Release notes cannot be empty.');
}
const [, major, minor, patch, stage, number] = match;
console.log(`apk_version=${major}.${minor}.${patch}${stage ? `_${stage}${number}` : ''}`);
console.log(`package_release=${revision}`);
console.log(`prerelease=${Boolean(stage)}`);
