import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const out = join(root, 'dist');
const data = JSON.parse(readFileSync(join(root, 'content/portfolio.json'), 'utf8'));
const expected = new Set(['index.html', '.nojekyll', 'assets/style.css', 'assets/site.js', 'assets/favicon.svg', 'assets/gsap-3.15.0.min.js', 'assets/gsap-NOTICE.txt']);
for (const p of data.projects) {
  expected.add(`projects/${p.slug}/index.html`);
  if (p.image) expected.add(p.image);
  for (const image of p.coverImages ?? []) expected.add(image.src);
  for (const image of p.heroImages ?? []) expected.add(image.src);
}
function walk(dir) {
  if (!existsSync(dir)) throw new Error(`Missing output: ${dir}`);
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [relative(out, path).split(sep).join('/')];
  });
}
const actual = new Set(walk(out));
for (const file of expected) if (!actual.has(file)) throw new Error(`Missing generated file: ${file}`);
for (const file of actual) if (!expected.has(file)) throw new Error(`Unexpected file in publication bundle: ${file}`);

const forbidden = [/D:\\Codex/i, /D:\\Personal/i, /password/i, /API[_ -]?key/i, /23\s*份.{0,8}真实/i, /已上线.{0,20}FUFUBOT/i];
const pages = [...expected].filter((file) => file.endsWith('.html'));
for (const file of pages) {
  const page = join(out, file);
  const html = readFileSync(page, 'utf8');
  if (!html.includes('<main id="main">') || !html.includes('<title>')) throw new Error(`Incomplete page: ${file}`);
  for (const pattern of forbidden) if (pattern.test(html)) throw new Error(`Unsafe text ${pattern} in ${file}`);
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
  for (const match of html.matchAll(/aria-labelledby="([^"]+)"/g)) {
    for (const id of match[1].split(/\s+/)) if (!ids.has(id)) throw new Error(`Broken accessible label: ${id} in ${file}`);
  }
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const value = match[1];
    if (/^mailto:[^@\s]+@[^@\s]+/.test(value)) continue;
    if (/^https:\/\//.test(value)) throw new Error(`External link requires separate live review: ${value}`);
    if (/^[a-z]+:/i.test(value)) throw new Error(`Unsupported URL scheme: ${value}`);
    const [pathPart, anchor] = value.split('#');
    const target = pathPart ? resolve(page, '..', pathPart) : page;
    if (target !== out && !target.startsWith(out + sep)) throw new Error(`Link escapes output: ${value}`);
    if (!existsSync(target)) throw new Error(`Broken local link: ${value} in ${file}`);
    const targetPage = statSync(target).isDirectory() ? join(target, 'index.html') : target;
    if (!existsSync(targetPage)) throw new Error(`Missing target page: ${value} in ${file}`);
    if (anchor) {
      if (!targetPage.endsWith('.html')) throw new Error(`Anchor on non-page: ${value}`);
      const targetHtml = targetPage === page ? html : readFileSync(targetPage, 'utf8');
      const targetIds = targetPage === page ? ids : new Set([...targetHtml.matchAll(/\sid="([^"]+)"/g)].map((item) => item[1]));
      if (!targetIds.has(anchor)) throw new Error(`Broken anchor: ${value} in ${file}`);
    }
  }
}
const home = readFileSync(join(out, 'index.html'), 'utf8');
if ((home.match(/data-stage-panel/g) ?? []).length !== 4) throw new Error('Homepage must have four complete stage scenes');
for (const target of ['top', 'projects', 'workbench', 'about']) {
  if (!home.includes(`href="#${target}" data-stage-link`)) throw new Error(`Missing direct stage choice: ${target}`);
}
if (!home.includes('data-stage-prev') || !home.includes('data-stage-next')) throw new Error('Stage navigation controls are missing');
if (!home.includes('assets/gsap-3.15.0.min.js') || home.indexOf('assets/gsap-3.15.0.min.js') > home.indexOf('assets/site.js')) throw new Error('Homepage must load pinned GSAP before its controller');
for (const file of pages.filter((page) => page !== 'index.html')) {
  if (readFileSync(join(out, file), 'utf8').includes('assets/gsap-3.15.0.min.js')) throw new Error(`GSAP must not load on case pages: ${file}`);
}
console.log(`PASS: ${pages.length} pages; exact publication bundle, local links, anchors and basic copy rules`);
