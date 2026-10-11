import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, rmSync, lstatSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const out = join(root, 'dist');
const site = JSON.parse(readFileSync(join(root, 'content/portfolio.json'), 'utf8'));
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const list = (items) => items.map((item) => `<li>${esc(item)}</li>`).join('');
const required = (object, keys, context) => {
  for (const key of keys) if (typeof object?.[key] !== 'string' || !object[key].trim()) throw new Error(`${context}: missing ${key}`);
};
const textArray = (value, context) => {
  if (!Array.isArray(value) || !value.length || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(`${context}: expected a non-empty text array`);
  }
};
const assets = new Set(['style.css', 'site.js', 'favicon.svg', 'gsap-3.15.0.min.js', 'gsap-NOTICE.txt']);
function registerImage(path, context) {
  if (typeof path !== 'string' || !/^assets\/[a-z0-9-]+\.(png|webp|svg)$/.test(path)) throw new Error(`${context}: invalid image path`);
  assets.add(path.slice('assets/'.length));
}

required(site.person, ['name', 'initials', 'role', 'intro', 'education', 'availability', 'exploring', 'email'], 'person');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(site.person.email)) throw new Error('Invalid contact email');
if (!/^\d{4}-\d{2}-\d{2}$/.test(site.updated)) throw new Error('Invalid updated date');
required(site, ['latestUpdate'], 'site');
if (!Array.isArray(site.projects) || site.projects.length !== 2) throw new Error('This exhibition currently needs exactly two verified projects');
if (new Set(site.projects.map((project) => project.slug)).size !== site.projects.length) throw new Error('Duplicate project slug');
if (site.projects[0].coverType !== 'screens' || site.projects[1].coverType !== 'flow') {
  throw new Error('Current exhibition expects a screen project first and a flow project second');
}
for (const project of site.projects) {
  required(project, ['slug', 'name', 'displayTitle', 'exhibitLine', 'coverType', 'category', 'lead', 'cardContribution', 'status', 'role', 'question', 'decision', 'why', 'limits'], 'project');
  if (!/^[a-z0-9-]+$/.test(project.slug)) throw new Error(`Invalid slug: ${project.slug}`);
  textArray(project.evidence, `${project.slug}.evidence`);
  textArray(project.buildLoop, `${project.slug}.buildLoop`);
  textArray(project.tags, `${project.slug}.tags`);
  required(project.artifact, ['type', 'label', 'title', 'source'], `${project.slug}.artifact`);
  if (project.artifact.type === 'prd') {
    if (!Array.isArray(project.artifact.rows) || project.artifact.rows.length < 2) throw new Error(`${project.slug}: missing PRD rows`);
    for (const row of project.artifact.rows) required(row, ['label', 'value'], `${project.slug}.artifact.row`);
  } else if (project.artifact.type === 'flow') {
    textArray(project.artifact.steps, `${project.slug}.artifact.steps`);
    required(project.artifact, ['note'], `${project.slug}.artifact`);
    if (!Array.isArray(project.artifact.quotes) || !project.artifact.quotes.length) throw new Error(`${project.slug}: missing source quotes`);
    for (const quote of project.artifact.quotes) required(quote, ['label', 'location', 'code'], `${project.slug}.artifact.quote`);
  } else throw new Error(`${project.slug}: invalid artifact type`);
  if (!Array.isArray(project.coverImages)) throw new Error(`${project.slug}: coverImages must be an array`);
  if (project.slug === 'workbench') {
    if (!Array.isArray(project.heroImages) || project.heroImages.length !== 2) throw new Error('workbench: heroImages needs two test-preview screenshots');
    for (const image of project.heroImages) {
      required(image, ['src', 'alt', 'label'], 'workbench.heroImages');
      registerImage(image.src, 'workbench.heroImages');
    }
  }
  if (project.coverType === 'screens') {
    if (project.coverImages.length !== 2) throw new Error(`${project.slug}: a screen scene needs two images`);
    for (const image of project.coverImages) {
      required(image, ['src', 'alt', 'label'], `${project.slug}.coverImages`);
      registerImage(image.src, `${project.slug}.coverImages`);
    }
  } else if (project.coverType === 'flow') {
    if (project.coverImages.length) throw new Error(`${project.slug}: a flow scene must not claim screenshots`);
  } else throw new Error(`${project.slug}: unknown cover type`);
  if (project.image !== null) {
    required(project, ['image', 'imageAlt', 'imageCaption'], `${project.slug}.image`);
    registerImage(project.image, `${project.slug}.image`);
  }
}
required(site.experience, ['title', 'period', 'description'], 'experience');
for (const file of assets) if (!existsSync(join(root, 'assets', file))) throw new Error(`Missing asset: ${file}`);

const emailLink = `mailto:${site.person.email}?subject=${encodeURIComponent('作品集交流｜AI 产品与应用实习')}`;
function shell({ title, description, prefix = './', body, pageClass = '' }) {
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#101411"><meta name="description" content="${esc(description)}"><title>${esc(title)}</title>
<link rel="icon" type="image/svg+xml" href="${prefix}assets/favicon.svg"><link rel="stylesheet" href="${prefix}assets/style.css">
${pageClass === 'home-page' ? `<script src="${prefix}assets/gsap-3.15.0.min.js" defer></script>` : ''}<script src="${prefix}assets/site.js" defer></script></head>
<body class="${pageClass}"><a class="skip-link" href="#main">跳到正文</a>
<header class="site-header"><div class="wrap nav-bar"><a class="brand" href="${prefix}" aria-label="${esc(site.person.name)}作品集首页"><span class="brand-mark">${esc(site.person.initials)}.</span><span class="brand-name">${esc(site.person.name)}</span></a>${pageClass === 'home-page' ? '<span class="nav-role">AI 产品 · AI 应用</span>' : ''}<nav aria-label="主导航"><a href="${prefix === './' ? '' : prefix}#projects">作品</a><a href="${prefix === './' ? '' : prefix}#about">关于</a><a class="nav-contact" href="${prefix === './' ? '' : prefix}#contact">联系我 ↗</a></nav></div></header>
<main id="main">${body}</main><footer class="site-footer"><div class="wrap footer-inner"><span>© ${new Date().getFullYear()} ${esc(site.person.name)} · 更新于 ${esc(site.updated)}</span><a href="${prefix}">回到首页 ↑</a></div></footer></body></html>`;
}

function screenScene(project, prefix, context) {
  const [home, group] = project.coverImages;
  const originalLinks = context === 'case'
    ? `<div class="scene-originals"><a href="${prefix}${esc(home.src)}" target="_blank" rel="noopener noreferrer">首页原图 ↗</a><a href="${prefix}${esc(group.src)}" target="_blank" rel="noopener noreferrer">小组训练原图 ↗</a></div>`
    : '';
  return `<figure class="screen-scene ${context === 'case' ? 'screen-scene-case' : ''}" aria-label="零橄真实小程序界面双图展示">
    <span class="field-line field-line-one" aria-hidden="true"></span><span class="field-line field-line-two" aria-hidden="true"></span>
    <div class="screen-panel screen-panel-home motion-layer" data-depth="0.25"><img src="${prefix}${esc(home.src)}" alt="${esc(home.alt)}" ${context === 'hero' ? 'fetchpriority="high"' : 'loading="lazy"'}><span>${esc(home.label)}</span></div>
    <div class="screen-panel screen-panel-group motion-layer" data-depth="0.48"><img src="${prefix}${esc(group.src)}" alt="${esc(group.alt)}" ${context === 'hero' ? 'fetchpriority="high"' : 'loading="lazy"'}><span>${esc(group.label)}</span></div>
    <div class="scene-sticker"><small>BR-012 / AC-008</small><strong>共同目标<br>个人标准</strong></div>
    <figcaption>真实项目界面截图。画面显示产品状态，不代表真实训练效果。${originalLinks}</figcaption>
  </figure>`;
}

function flowScene(context) {
  return `<figure class="flow-scene ${context === 'case' ? 'flow-scene-case' : ''}" aria-label="AI Workbench 本地知识发送路径示意">
    <div class="flow-head"><span>KNOWLEDGE WORKSPACE</span><span>01 — 04</span></div>
    <div class="flow-track" aria-hidden="true"></div>
    <div class="flow-node flow-node-note"><small>01 / 本地笔记</small><strong>Markdown<br>知识片段</strong><span>在本机检索</span></div>
    <div class="flow-node flow-node-preview"><small>02 / 发送范围预览</small><strong>最多 5 篇</strong><span>文档 · 模型 · 字符数</span></div>
    <div class="flow-node flow-node-confirm"><small>03 / 人来决定</small><strong>确认发送</strong><span>确认后才调用模型</span></div>
    <div class="flow-node flow-node-answer"><small>04 / 返回结果</small><strong>模型回答</strong><span>保留来源入口</span></div>
    <figcaption>依据本地组件源码整理的实现流程示意，非产品截图；当前 API 连通性未实测。</figcaption>
  </figure>`;
}
function visual(project, prefix, context) {
  return project.coverType === 'screens' ? screenScene(project, prefix, context) : flowScene(context);
}

function exhibit(project, index) {
  const number = String(index + 1).padStart(2, '0');
  return `<section class="exhibit exhibit-${esc(project.slug)} stage-panel" id="${index === 0 ? 'projects' : esc(project.slug)}" data-stage-panel aria-labelledby="stage-title-${esc(project.slug)}">
  <div class="wrap exhibit-inner"><div class="exhibit-visual" data-reveal>${visual(project, './', 'exhibit')}</div>
  <div class="exhibit-copy" data-reveal><p class="scene-label">${number} / ${esc(project.category)}</p><h2 id="stage-title-${esc(project.slug)}">${esc(project.name)}</h2>
  <p class="exhibit-display">${esc(project.displayTitle)}</p><p class="exhibit-question">${esc(project.exhibitLine)}</p>
  <p class="exhibit-role"><span>我的参与</span>${esc(project.cardContribution)}</p>
  <a class="scene-link" href="projects/${esc(project.slug)}/">进入案例与证据 <span aria-hidden="true">↗</span></a></div></div></section>`;
}

const featured = site.projects[0];
const workbench = site.projects[1];
function heroShowcase() {
  const [home, group] = featured.coverImages;
  const [today, learning] = workbench.heroImages;
  const item = (image, name, className, eager = false) => `<div class="showcase-item ${className}"><img src="./${esc(image.src)}" alt="${esc(image.alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'}><span>${esc(name)} · ${esc(image.label)}</span></div>`;
  return `<figure class="hero-showcase" aria-label="零橄两张真实界面与 AI Workbench 两张测试预览界面">
    <span class="showcase-label showcase-label-lingan">零橄</span><span class="showcase-label showcase-label-workbench">AI Workbench</span>
    ${item(home, '零橄', 'showcase-lingan-home', true)}
    ${item(group, '零橄', 'showcase-lingan-group', true)}
    ${item(today, 'AI Workbench', 'showcase-workbench-today')}
    ${item(learning, 'AI Workbench', 'showcase-workbench-learning')}
    <figcaption>零橄：本地原型 · Workbench：界面测试预览</figcaption>
  </figure>`;
}
const home = `<div class="stage" data-stage><section class="hero stage-panel" id="top" data-stage-panel aria-labelledby="stage-title-top"><div class="wrap hero-grid"><div class="hero-copy" data-reveal>
  <h1 id="stage-title-top"><span class="hero-name">从需求定义，</span><span class="hero-role">到产品验证</span></h1>
  <p class="hero-description">${esc(site.person.intro)}</p><div class="hero-actions"><a class="button button-bright" href="#projects">查看项目 <span aria-hidden="true">→</span></a><a class="text-link" href="projects/lingan/">阅读案例</a></div>
  <div class="hero-projects" aria-label="精选项目"><div class="hero-project-row"><span class="hero-project-number">PROJECT 01</span><h2>零橄</h2><div><p>混合水平训练的角色与标准设计。</p><a href="projects/lingan/">查看项目 →</a></div></div>
  <div class="hero-project-row"><span class="hero-project-number">PROJECT 02</span><h2>AI Workbench</h2><div><p>本地笔记问答与发送前确认。</p><a href="projects/workbench/">了解更多 →</a></div></div></div></div>
  <div class="hero-art" data-reveal>${heroShowcase()}</div></div></section>
${site.projects.map(exhibit).join('')}
<section class="about-contact stage-panel" id="about" data-stage-panel aria-labelledby="stage-title-about"><div class="wrap about-contact-grid"><div><p class="scene-label">ABOUT / ${esc(site.person.name)}</p><h2 id="stage-title-about">把需求写清楚，<br>把实现做出来。</h2><p>${esc(site.person.exploring)}</p><div class="about-experience"><span>近期经历</span><h3>${esc(site.experience.title)}</h3><time>${esc(site.experience.period)}</time><p>${esc(site.experience.description)}</p></div></div><div class="contact-section" id="contact"><p class="scene-label">CONTACT</p><h2>聊聊实习与项目机会。</h2><p>可邮件联系获取完整简历和更多材料。</p><a class="button button-bright" href="${esc(emailLink)}">发邮件 ↗</a><p class="contact-email">${esc(site.person.email)}</p><small>更新于 ${esc(site.updated)} · ${esc(site.latestUpdate)}</small></div></div></section>
<nav class="stage-controls" aria-label="作品画面切换" data-stage-controls><button type="button" class="stage-arrow" data-stage-prev aria-label="上一画面">← 前一幕</button><div class="stage-choices"><a href="#top" data-stage-link>开场</a><a href="#projects" data-stage-link>零橄</a><a href="#workbench" data-stage-link>Workbench</a><a href="#about" data-stage-link>关于</a></div><button type="button" class="stage-arrow" data-stage-next aria-label="下一画面">下一幕 →</button></nav></div>`;

function artifact(project) {
  const item = project.artifact;
  const details = item.type === 'prd'
    ? `<dl class="artifact-rows">${item.rows.map((row) => `<div><dt>${esc(row.label)}</dt><dd>${esc(row.value)}</dd></div>`).join('')}</dl>`
    : `<div class="source-quotes"><h3>本地源码原文节选</h3>${item.quotes.map((quote) => `<div class="source-quote"><div><strong>${esc(quote.label)}</strong><span>KnowledgeWorkspace.tsx:${esc(quote.location)}</span></div><pre><code>${esc(quote.code)}</code></pre></div>`).join('')}</div><p class="artifact-note">${esc(item.note)}</p>`;
  return `<section class="article-section" id="artifact"><p class="section-kicker">02 / WORK SAMPLE</p><h2>${esc(item.label)}</h2>
  <div class="artifact-card"><div class="artifact-head"><span>可核对产物</span><h3>${esc(item.title)}</h3><p>${esc(item.source)}</p></div>${details}</div></section>`;
}
function projectPage(project) {
  const other = site.projects[(site.projects.indexOf(project) + 1) % site.projects.length];
  const body = `<section class="case-opening case-opening-${esc(project.slug)}"><div class="wrap"><a class="back-link" href="../../#projects">← 所有作品</a>
  <div class="case-opening-grid"><div class="case-opening-copy"><p class="scene-label">${esc(project.category)}</p><h1>${esc(project.name)}</h1>
  <p class="case-display">${esc(project.displayTitle)}</p><p class="case-lead">${esc(project.lead)}</p><a class="case-jump" href="#role">看我的职责 ↓</a></div>
  <div class="case-opening-art">${visual(project, '../../', 'case')}</div></div></div></section>
  <section class="case-role" id="role"><div class="wrap"><dl><div><dt>我的职责</dt><dd>${esc(project.role)}</dd></div><div><dt>当前状态</dt><dd>${esc(project.status)}</dd></div><div><dt>可查看产物</dt><dd>${esc(project.artifact.title)}</dd></div></dl></div></section>
  <nav class="mobile-case-nav" aria-label="本篇目录"><a href="#role">职责</a><a href="#problem">决策</a><a href="#artifact">产物</a><a href="#verification">验证</a><a href="#process">过程</a></nav>
  <div class="case-content"><div class="wrap case-layout"><nav class="case-nav" aria-label="案例目录"><strong>本篇目录</strong><a href="#role">职责与状态</a><a href="#problem">核心决策</a><a href="#artifact">可核对产物</a><a href="#verification">验证与限制</a><a href="#process">实现过程</a></nav><div class="case-article">
  <section class="article-section" id="problem"><p class="section-kicker">01 / DECISION</p><h2>为什么做这个决定</h2><div class="decision-grid"><div><small>面对的问题</small><p>${esc(project.question)}</p></div><div><small>我的决定</small><p>${esc(project.decision)}</p></div><div><small>取舍依据</small><p>${esc(project.why)}</p></div></div></section>
  ${artifact(project)}
  <section class="article-section" id="verification"><p class="section-kicker">03 / VERIFICATION</p><h2>已经核对，也说清边界</h2><ul class="evidence-list">${list(project.evidence)}</ul><div class="limits-box"><strong>目前不能证明</strong><p>${esc(project.limits)}</p></div></section>
  <section class="article-section" id="process"><p class="section-kicker">04 / PROCESS</p><h2>从需求到实现</h2><ol class="process-list">${list(project.buildLoop)}</ol></section>
  <div class="case-end"><a href="../${esc(other.slug)}/">继续看 ${esc(other.name)} ↗</a><a href="../../#contact">联系我 ↗</a></div></div></div></div>`;
  return shell({ title: `${project.name}案例｜${site.person.name}`, description: project.lead, prefix: '../../', body, pageClass: 'case-page' });
}

if (resolve(out) !== resolve(root, 'dist') || !out.startsWith(root + sep)) throw new Error('Unsafe output directory');
if (existsSync(out) && lstatSync(out).isSymbolicLink()) throw new Error('Refusing to replace a symlinked dist directory');
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'assets'), { recursive: true });
writeFileSync(join(out, 'index.html'), shell({ title: `${site.person.name}｜AI 产品与应用作品集`, description: site.person.intro, body: home, pageClass: 'home-page' }), 'utf8');
for (const project of site.projects) {
  const directory = join(out, 'projects', project.slug);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'index.html'), projectPage(project), 'utf8');
}
for (const file of assets) copyFileSync(join(root, 'assets', file), join(out, 'assets', file));
writeFileSync(join(out, '.nojekyll'), '', 'utf8');
console.log(`Built ${site.projects.length + 1} pages in dist/`);
