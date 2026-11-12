import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { PET_SPECIES, PET_ACCESSORIES, PET_BACKGROUNDS, SKIN_THRESHOLDS, normalizePet, effectivePet, petProgress } from '../src/petGame.ts';

const date = (y,m,d) => new Date(y,m-1,d,12).getTime();
const book = (...journal) => ({ journal });
const entry = (day,pages,other = {}) => ({ date: day, pages, ...other });
const started = { startDate: '2000-01-01', excluded: [] };

test('mascotas y aspectos: seis especies, seis diseños y desbloqueos seguros', () => {
  assert.equal(PET_BACKGROUNDS.length, 20);
  assert.equal(new Set(PET_BACKGROUNDS.map(b => b.id)).size, 20);
  assert.equal(normalizePet({ background: 'wrong' }).background, 'garden');
  assert.equal(PET_SPECIES.length, 6); assert.ok(PET_SPECIES.every(s => s.skins.length === 6));
  assert.deepEqual(SKIN_THRESHOLDS, [0,100,300,600,1000,1600]);
  assert.deepEqual(normalizePet({ species:'fake', skin:9, name:' x ' }), { species:'cat', skin:0, name:'x', background:'garden', accessory:null });
  assert.equal(normalizePet({ name:'x'.repeat(100) }).name.length, 24);
  assert.equal(effectivePet({ species:'dragon', skin:2, name:'D' }, 299).skin, 0);
  assert.equal(effectivePet({ species:'dragon', skin:2, name:'D' }, 300).skin, 2);
});

test('páginas del diario cuentan por fecha exacta, suman sesiones y se recalculan sin inventar datos', () => {
  const now = new Date(2026, 0, 7, 12);
  const books = [book(entry(date(2026,1,7),12),entry(date(2026,1,7),13),entry(date(2026,1,6),20),entry(date(2026,1,5),30),entry(date(2026,1,1),100),entry(date(2026,1,7),500,{datePrecision:'year'}),entry(date(2026,1,8),999),entry(date(2026,1,7),-12)), book(entry(date(2026,1,7),25))];
  const p = petProgress(books, now, started);
  assert.deepEqual([p.total,p.dayPages,p.weekPages,p.streak,p.level,p.levelPages,p.activeDays], [200,50,100,3,3,0,4]);
  assert.equal(petProgress([book(entry(date(2026,1,6),1))],now,started).streak, 1);
  assert.equal(petProgress([book(entry(date(2026,1,5),1))],now,started).streak, 0);
  assert.equal(petProgress([],now,started).total,0);
});

test('interfaz permite elegir mascota, desbloquea aspectos, nombra y muestra resumen en inicio', async (t) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url:'http://bilibook.test/' });
  globalThis.window = dom.window; globalThis.document = dom.window.document; Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator, configurable:true}); globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const React = await import('react'); const {createRoot} = await import('react-dom/client'); const {createServer} = await import('vite');
  const vite = await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'}); const {PetGame, PetHomeCard} = await vite.ssrLoadModule('/src/components/PetGame.tsx');
  const root = createRoot(document.getElementById('root'));
  t.after(async () => { await React.act(async () => root.unmount()); await vite.close(); dom.window.close(); delete globalThis.window; delete globalThis.document; delete globalThis.navigator; delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
  const today = new Date(); const books = [book(entry(today.getTime(), 350))]; let pet = {species:'cat',skin:0,name:'',background:'garden',accessory:null}; let opened = false;
  const render = () => root.render(React.createElement(React.Fragment,null,React.createElement(PetHomeCard,{books,pet,challenge:started,onOpen:()=>{opened=true;}}),React.createElement(PetGame,{books,pet,challenge:started,onActivate:async()=>{},onSetPet:p => {pet=p;render();}})));
  await React.act(async () => render());
  assert.equal(document.querySelectorAll('[aria-label="Elegir mascota"] button').length,6);
  assert.equal(document.querySelectorAll('[aria-label="Elegir fondo"] button').length,20);
  await React.act(async () => document.querySelector('[aria-label="Fondo Costa tranquila"]').click());
  assert.equal(pet.background, 'ocean');
  assert.equal(document.querySelector('[aria-label="Fondo Costa tranquila"]').getAttribute('aria-pressed'), 'true');
  assert.ok([...document.querySelectorAll('.pet-scene-sky')].every(el => el.style.backgroundImage.includes('/ocean.webp')));
  assert.equal(document.querySelectorAll('button[disabled]').length,51);
  assert.equal(document.querySelectorAll('[aria-label="Elegir añadido visual"] button').length, 50);
  const original = {...pet};
  const togglePreview = [...document.querySelectorAll('button')].find(b => b.textContent === 'Probar todo temporalmente');
  await React.act(async () => togglePreview.click());
  const lastAccessory = document.querySelectorAll('[aria-label="Elegir añadido visual"] button')[49];
  assert.equal(lastAccessory.disabled, false);
  await React.act(async () => lastAccessory.click());
  assert.deepEqual(pet, original, 'modo de prueba nunca guarda la selección');
  assert.equal(lastAccessory.getAttribute('aria-pressed'), 'true');
  await React.act(async () => togglePreview.click());
  assert.deepEqual(pet, original);
  assert.equal(lastAccessory.disabled, true);

  await React.act(async () => document.querySelector('[aria-label="Elegir añadido visual"] button').click());
  assert.equal(pet.accessory, 0);
  assert.equal(document.querySelectorAll('.pet-scene .pet-sprite svg').length, 2);
  const santa = document.querySelector('.pet-scene .pet-sprite svg');
  assert.equal(santa.getAttribute('viewBox'), '12 5 76 64');
  assert.match(santa.parentElement.style.transform, /-96%/);
  for (const icon of document.querySelectorAll('[aria-label="Elegir añadido visual"] svg')) {
    assert.notEqual(icon.getAttribute('viewBox'), '0 0 100 80');
  }
  const accessories = document.querySelectorAll('[aria-label="Elegir añadido visual"] button');
  assert.equal(accessories[1].disabled, false);
  assert.equal(accessories[2].disabled, true);
  await React.act(async () => accessories[1].click());
  assert.equal(pet.accessory, 1);
  assert.equal(accessories[1].getAttribute('aria-pressed'), 'true');
  await React.act(async () => [...document.querySelectorAll('button')].find(button => button.textContent === 'Sin añadido').click());
  assert.equal(pet.accessory, null);
  await React.act(async () => document.querySelector('[aria-label="Elegir añadido visual"] button').click());
  assert.equal(pet.accessory, 0);
  await React.act(async () => document.querySelector('[aria-label="Abrir Mi mascota"]').click()); assert.equal(opened,true);
  await React.act(async () => [...document.querySelectorAll('[aria-label="Elegir mascota"] button')].find(x => x.textContent.includes('Dragón')).click());
  assert.equal(pet.species,'dragon'); assert.equal(pet.accessory,0); assert.match(document.body.textContent,/Nivel 4/);
  await React.act(async () => [...document.querySelectorAll('button')].find(x => x.textContent.includes('Acuático') && !x.getAttribute('aria-label')?.startsWith('Fondo ')).click()); assert.equal(pet.skin,2);
  assert.match(document.body.textContent,/Nivel 4/); assert.match(document.body.textContent,/3\/3 completadas/);
  const mainScene = [...document.querySelectorAll('[aria-label="Saludar a Dragón y cambiar postura"]')].at(-1);
  const sceneImage = mainScene.parentElement.querySelector('.pet-sprite img');
  const beforePose = sceneImage.getAttribute('src');
  await React.act(async () => mainScene.click());
  assert.notEqual(sceneImage.getAttribute('src'), beforePose);

  assert.match(document.body.textContent,/Me encanta leer contigo/);
  assert.match(document.body.textContent,/Reto semanal completado/);
});

test('servidor conserva mascota por cuenta y al reiniciar, con validación', async (t) => {
  const { spawn } = await import('node:child_process'); const { mkdtemp, rm } = await import('node:fs/promises'); const { tmpdir } = await import('node:os'); const { join } = await import('node:path'); const net = await import('node:net');
  const tmp = await mkdtemp(join(tmpdir(), 'bilibook-pet-'));
  const probe = net.createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve)); const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const base = `http://127.0.0.1:${port}`; let child;
  async function stop() { if (child && child.exitCode === null) { child.kill(); await new Promise(resolve => child.once('exit',resolve)); } }
  async function start() { child=spawn(process.execPath,['server/index.js'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:String(port),DATA_DIR:tmp},stdio:'ignore'}); for (let i=0;i<100;i++) { try { if ((await fetch(`${base}/api/health`)).ok) return; } catch {} await new Promise(resolve=>setTimeout(resolve,100)); } throw new Error('Servidor no arrancó'); }
  t.after(async()=>{await stop();await rm(tmp,{recursive:true,force:true});}); await start();
  const phaseResponse = await fetch(`${base}/api/pet/day-night`);
  assert.equal(phaseResponse.status, 200);
  assert.match(phaseResponse.headers.get('cache-control'), /no-store/);
  const clock = await phaseResponse.json();
  assert.ok(['day', 'night'].includes(clock.phase));
  assert.ok(clock.nextTransition > clock.serverTime);
  async function req(account, patch) { const res=await fetch(`${base}/api/settings`,{method:patch?'PUT':'GET',headers:{'Content-Type':'application/json',cookie:`bilibook-account=${account}`},...(patch?{body:JSON.stringify({pet:patch})}:{})}); assert.equal(res.status,200);return res.json(); }
  assert.deepEqual((await req('raul')).pet,{species:'cat',skin:0,name:'',background:'garden',accessory:null});
  assert.deepEqual((await req('raul',{species:'munchkin',skin:0,name:'Mini',pose:'durmiendo'})).pet,{species:'munchkin',skin:0,name:'Mini',background:'garden',accessory:null,pose:'durmiendo'});
  assert.equal((await req('raul')).pet.pose, 'durmiendo');
  await stop(); await start();
  assert.equal((await req('raul')).pet.pose, 'durmiendo');
  assert.equal((await req('raul',{species:'dragon',background:'interior-attic'})).pet.background,'interior-attic');
  await stop(); await start();
  assert.equal((await req('raul')).pet.background,'interior-attic');
  assert.deepEqual((await req('raul',{species:'trex',skin:5,name:' Dino ',background:'space'})).pet,{species:'trex',skin:5,name:'Dino',background:'space',accessory:null});
  assert.deepEqual((await req('pequenaja')).pet,{species:'cat',skin:0,name:'',background:'garden',accessory:null});
  assert.deepEqual((await req('pequenaja',{species:'invalida',skin:-1,name:5,background:'../../secret'})).pet,{species:'cat',skin:0,name:'',background:'garden',accessory:null});
  const created = await (await fetch(`${base}/api/books`, {method:'POST', headers:{'Content-Type':'application/json', cookie:'bilibook-account=raul'}, body:JSON.stringify({ title:'Antes', journal:[{id:'old',date:Date.now(),pages:500}] })})).json();
  const date = new Date(); const today = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const bad = await fetch(`${base}/api/pet/activate`, {method:'POST',headers:{'Content-Type':'application/json',cookie:'bilibook-account=raul'},body:JSON.stringify({startDate:today,pet:{species:'cat',name:'   '}})}); assert.equal(bad.status,400); assert.equal((await req('raul')).petChallenge,null);
  const activate = async () => (await fetch(`${base}/api/pet/activate`, {method:'POST',headers:{'Content-Type':'application/json',cookie:'bilibook-account=raul'},body:JSON.stringify({startDate:today,pet:{species:'dragon',name:'Nube',skin:0,background:'space'}})})).json();
  const first = await activate(); assert.deepEqual(first.pet, {species:'dragon',skin:0,name:'Nube',background:'space',accessory:null}); assert.equal(first.petChallenge.startDate,today); assert.deepEqual(first.petChallenge.excluded,[JSON.stringify([created.id,'old'])]);
  const second = await activate(); assert.deepEqual(second.petChallenge, first.petChallenge); assert.equal(second.settingsVersion,first.settingsVersion);
  assert.equal((await req('pequenaja')).petChallenge,null);
  const switched = await req('raul', { species:'monkey', skin:0, name:'Nube', background:'space', accessory:0 });
  assert.deepEqual(switched.petChallenge, first.petChallenge); assert.equal(switched.pet.accessory,0);
  await stop(); await start(); assert.deepEqual((await req('raul')).petChallenge,first.petChallenge); assert.deepEqual((await req('raul')).pet,{species:'monkey',skin:0,name:'Nube',background:'space',accessory:0}); assert.equal((await req('pequenaja')).pet.species,'cat');
});

test('las 36 mascotas cuentan con ilustraciones locales distintas', async (t) => {
  const { createServer } = await import('vite'); const React = await import('react'); const { renderToStaticMarkup } = await import('react-dom/server');
  const { stat, readFile } = await import('node:fs/promises');
  const { createHash } = await import('node:crypto');
  const vite = await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'});
  t.after(async () => vite.close());
  const { PixelPet } = await vite.ssrLoadModule('/src/components/PixelPet.tsx');
  const hashes = new Set();
  for (const species of PET_SPECIES) for (let skin = 0; skin < 6; skin++) {
    const path = new URL(`../public/pets/${species.id}-${skin}.webp`, import.meta.url);
    assert.ok((await stat(path)).size > 1000);
    hashes.add(createHash('sha256').update(await readFile(path)).digest('hex'));
    const html = renderToStaticMarkup(React.createElement(PixelPet,{species:species.id,skin}));
    assert.ok(html.includes(`/pets/${species.id}-${skin}.webp`));
    assert.ok(html.includes(species.skins[skin]));
  }
  assert.equal(hashes.size, 36);
});

test('los veinte fondos están disponibles como archivos locales', async () => {
  const {stat} = await import('node:fs/promises');
  for (const background of PET_BACKGROUNDS) assert.ok((await stat(new URL(`../public${background.image}`, import.meta.url))).size > 1000);
});


test('inicio en nivel 1 excluye registros anteriores, incluso del mismo día, y lecturas importadas antiguas', () => {
  const now = new Date(2026, 4, 5, 15); const challenge = { startDate: '2026-05-05', excluded: [JSON.stringify(['b', 'old'])] };
  const entries = [{id:'old', date:date(2026,5,5), pages:700}, {id:'new',date:date(2026,5,5),pages:25}, {id:'imported',date:date(2026,5,4),pages:500}];
  const books = [{id:'b',journal:entries}];
  assert.equal(petProgress(books, now).total, 0);
  assert.equal(petProgress(books, now, challenge).total, 25);
  assert.equal(petProgress(books, now, challenge).level, 1);
  entries[0].pages = 999; entries[0].date = date(2026,5,5);
  assert.equal(petProgress(books, now, challenge).total, 25);
  entries[1].pages = 101;
  assert.equal(petProgress(books, now, challenge).level, 2);
});


test('50 añadidos se desbloquean cada dos niveles y se mantienen al cambiar mascota', () => {
  assert.equal(PET_ACCESSORIES.length, 50);
  assert.equal(new Set(PET_ACCESSORIES.map(a => a.name)).size, 50);
  for (const item of PET_ACCESSORIES) {
    assert.equal(item.level, (item.id + 1) * 2);
    for (const species of PET_SPECIES) {
      const pet = normalizePet({ species: species.id, skin: 0, accessory: item.id });
      assert.equal(effectivePet(pet, (item.level - 1) * 100 - 1).accessory, null);
      assert.equal(effectivePet(pet, (item.level - 1) * 100).accessory, item.id);
    }
  }
  assert.equal(normalizePet({ accessory: 50 }).accessory, null);
});

test('se elige mascota y nombre antes de empezar en nivel uno', async (t) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {url:'http://bilibook.test/'});
  globalThis.window=dom.window; globalThis.document=dom.window.document; Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true}); globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  const React=await import('react'); const {createRoot}=await import('react-dom/client'); const {createServer}=await import('vite');
  const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'}); const {PetGame}=await vite.ssrLoadModule('/src/components/PetGame.tsx'); const root=createRoot(document.getElementById('root')); let activated;
  t.after(async()=>{await React.act(async()=>root.unmount());await vite.close();dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.navigator;delete globalThis.IS_REACT_ACT_ENVIRONMENT;});
  await React.act(async()=>root.render(React.createElement(PetGame,{books:[],pet:normalizePet({}),challenge:null,onActivate:async p=>{activated=p;},onSetPet(){}})));
  const initial=document.querySelector('[aria-label="Elegir primera mascota"]'); assert.equal(initial.querySelectorAll('button').length,6);
  await React.act(async()=>[...initial.querySelectorAll('button')].find(x=>x.textContent.includes('Pollo')).click());
  const input=document.querySelector('#first-pet-name');
  await React.act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,'Pío');input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
  await React.act(async()=>input.closest('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(activated.species,'chicken'); assert.equal(activated.name,'Pío'); assert.equal(activated.accessory,null);
});


test('hay cuatro posturas y un anclaje calibrado por cada variante', async () => {
  const { PET_POSES, PET_HEAD_ANCHORS, headAnchor } = await import('../src/petArt.ts');
  const { stat } = await import('node:fs/promises');
  assert.deepEqual(PET_POSES, ['sentado', 'durmiendo', 'andando', 'jugando']);
  for (const species of PET_SPECIES) {
    assert.equal(PET_HEAD_ANCHORS[species.id].length, 6);
    for (let skin = 0; skin < 6; skin++) for (const pose of PET_POSES) {
      const anchor = headAnchor(species.id, skin, pose);
      assert.ok(anchor.x >= 0 && anchor.x <= 100 && anchor.y >= 0 && anchor.y <= 100 && anchor.width > 0);
      assert.ok((await stat(new URL(`../public/pets/poses/${species.id}/${skin}/${pose}.webp`, import.meta.url))).size > 1000);
    }
  }
  assert.equal(normalizePet({species:'munchkin',pose:'durmiendo'}).pose, 'durmiendo');
  assert.equal(normalizePet({pose:'invalid'}).pose, undefined);
  assert.equal(PET_ACCESSORIES[6].placement, 'side');
});


test('los huecos corregidos son transparentes y el cascarón azul se conserva', async (t) => {
  const { execFileSync, spawnSync } = await import('node:child_process');
  if (spawnSync('convert', ['-version']).error) return t.skip('ImageMagick no está instalado');
  const pixel = (path, x, y) => execFileSync('convert', [new URL(`../public/pets/poses/${path}.webp`, import.meta.url).pathname, '-format', `%[fx:p{${x},${y}}.a]`, 'info:'], {encoding:'utf8'}).trim();
  assert.equal(pixel('dragon/2/sentado', 61, 183), '0');
  assert.equal(pixel('monkey/4/sentado', 188, 166), '0');
  assert.equal(pixel('trex/1/sentado', 173, 222), '0');
  assert.equal(pixel('chicken/5/sentado', 120, 60), '1');
  assert.equal(pixel('cat/2/sentado', 175, 231), '0');
  assert.equal(pixel('cat/5/durmiendo', 209, 237), '0');
  assert.equal(pixel('dragon/1/sentado', 161, 71), '0');
  assert.equal(pixel('munchkin/1/jugando', 163, 217), '0');
  assert.equal(pixel('munchkin/1/jugando', 168, 215), '0');
  assert.equal(pixel('munchkin/4/sentado', 70, 140), '1');
  assert.equal(pixel('munchkin/2/sentado', 80, 217), '0');
  assert.equal(pixel('munchkin/2/sentado', 193, 224), '0');
  assert.equal(pixel('trex/2/jugando', 121, 132), '0');
  assert.equal(pixel('trex/5/sentado', 124, 215), '0');
});


test('la postura avanza cada diez segundos sin guardar cambios', async (t) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {url:'http://bilibook.test/'});
  globalThis.window=dom.window; globalThis.document=dom.window.document; Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator, configurable:true}); globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  const callbacks=[]; dom.window.setInterval=(callback, ms)=>{assert.equal(ms,10000);callbacks.push(callback);return callbacks.length;}; dom.window.clearInterval=()=>{};
  const React=await import('react'); const {createRoot}=await import('react-dom/client'); const {createServer}=await import('vite');
  const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'}); const {PetHomeCard}=await vite.ssrLoadModule('/src/components/PetGame.tsx'); const root=createRoot(document.getElementById('root'));
  t.after(async()=>{await React.act(async()=>root.unmount());await vite.close();dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.navigator;delete globalThis.IS_REACT_ACT_ENVIRONMENT;});
  await React.act(async()=>root.render(React.createElement(PetHomeCard,{books:[],pet:normalizePet({}),challenge:started,onOpen(){}})));
  const img=document.querySelector('.pet-sprite img'); assert.match(img.src,/sentado.webp$/);
  assert.ok(document.querySelector('.pet-sprite-compact'));
  assert.equal(img.parentElement.style.transform, '');
  await React.act(async()=>callbacks[0]()); assert.match(img.src,/durmiendo.webp$/);
  await React.act(async()=>document.querySelector('[aria-label*="cambiar postura"]').click()); assert.match(img.src,/andando.webp$/);
});

test('las posturas T. rex documentadas coinciden con los recursos de la aplicación', async () => {
  const { readFile } = await import('node:fs/promises');
  const names = ['verde', 'rojo', 'laguna', 'ciruela', 'desierto', 'fosil'];
  for (const [i, name] of names.entries()) for (const pose of ['sentado', 'durmiendo', 'andando', 'jugando']) {
    const published = await readFile(new URL(`../public/pets/poses/trex/${i}/${pose}.webp`, import.meta.url));
    const documented = await readFile(new URL(`../pet-designs/mascotas/trex/${name}/posturas-app/${pose}.webp`, import.meta.url));
    assert.deepEqual(documented, published, `${name}/${pose}`);
  }
  const { headAnchor } = await import('../src/petArt.ts');
  assert.notEqual(headAnchor('cat', 0, 'sentado').width, headAnchor('cat', 0, 'andando').width);
  assert.ok(headAnchor('dragon', 5, 'sentado').y > 80);
  assert.ok(headAnchor('dragon', 5, 'andando').x < 20);
  assert.equal(headAnchor('munchkin', 0, 'jugando').x, 34);
  assert.ok(headAnchor('munchkin', 3, 'andando').x < 23);
});

test('el reloj del servidor cambia de fase a las 08:00 y a las 20:00', async () => {
  const { petDayNight } = await import('../server/petDayNight.js');
  const local = (hour, minute = 0, second = 0) => new Date(2026, 5, 15, hour, minute, second);
  assert.equal(petDayNight(local(7,59,59)).phase, 'night');
  assert.equal(petDayNight(local(8)).phase, 'day');
  assert.equal(petDayNight(local(19,59,59)).phase, 'day');
  assert.equal(petDayNight(local(20)).phase, 'night');
  assert.equal(petDayNight(local(20)).nextTransition, new Date(2026, 5, 16, 8).getTime());
  assert.equal(petDayNight(local(7)).nextTransition, local(8).getTime());
  assert.equal(petDayNight(local(12)).nextTransition, local(20).getTime());
});

test('cada escenario tiene una imagen de día y otra de noche', async () => {
  const { stat, readFile } = await import('node:fs/promises');
  const { petBackgroundImage } = await import('../src/petGame.ts');
  for (const scene of PET_BACKGROUNDS) {
    const day = petBackgroundImage(scene.id, 'day');
    const night = petBackgroundImage(scene.id, 'night');
    const dayPath = new URL(`../public${day}`, import.meta.url);
    const nightPath = new URL(`../public${night}`, import.meta.url);
    assert.ok((await stat(dayPath)).size > 1000);
    assert.ok((await stat(nightPath)).size > 1000);
    assert.notDeepEqual(await readFile(dayPath), await readFile(nightPath));
  }
});

test('Inicio y selector muestran la fase recibida del servidor', async (t) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {url:'http://bilibook.test/'});
  globalThis.window=dom.window; globalThis.document=dom.window.document; Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true}); globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => { assert.equal(url, '/api/pet/day-night'); return {ok:true, json:async()=>({phase:'night',serverTime:1000,nextTransition:60000})}; };
  const React=await import('react'); const {createRoot}=await import('react-dom/client'); const {createServer}=await import('vite');
  const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'}); const {PetHomeCard,PetGame}=await vite.ssrLoadModule('/src/components/PetGame.tsx'); const root=createRoot(document.getElementById('root'));
  t.after(async()=>{await React.act(async()=>root.unmount());await vite.close();dom.window.close();globalThis.fetch=originalFetch;delete globalThis.window;delete globalThis.document;delete globalThis.navigator;delete globalThis.IS_REACT_ACT_ENVIRONMENT;});
  const pet=normalizePet({background:'ocean'});
  await React.act(async()=>root.render(React.createElement(React.Fragment,null,React.createElement(PetHomeCard,{books:[],pet,challenge:started,onOpen(){}}),React.createElement(PetGame,{books:[],pet,challenge:started,onActivate:async()=>{},onSetPet(){}}))));
  assert.ok([...document.querySelectorAll('.pet-scene-sky')].every(el=>el.style.backgroundImage.includes('/night/ocean.webp')));
  assert.match(document.querySelector('[aria-label="Fondo Costa tranquila"] img').src, /\/night\/ocean.webp$/);
});

test('las posturas de munchkin y Nube se escalan por el tamaño visual de la cabeza', async () => {
  const { petPoseScale, PET_POSES } = await import('../src/petArt.ts');
  const measured = [
    [90,85,64,74], [86,92,58,83], [82,95,60,78],
    [78,75,70,76], [98,93,69,68], [78,80,58,80],
  ];
  for (let skin = 0; skin < 6; skin++) {
    for (const [i, pose] of PET_POSES.entries()) {
      assert.ok(Math.abs(petPoseScale('munchkin', skin, pose) * measured[skin][i] - 78) < 1e-8);
    }
    assert.ok(petPoseScale('munchkin', skin, 'andando') > petPoseScale('munchkin', skin, 'sentado'));
  }
  for (const [i, pose] of PET_POSES.entries()) {
    assert.ok(Math.abs(petPoseScale('dragon', 5, pose) * [32,65,32,61][i] - 50) < 1e-8);
    assert.equal(petPoseScale('dragon', 0, pose), 1);
    assert.equal(petPoseScale('cat', 0, pose), 1);
  }
  assert.equal(petPoseScale('munchkin', 99, 'andando'), petPoseScale('munchkin', 0, 'andando'));
});

test('la escala de la pose se aplica al contenedor de mascota y accesorio en Inicio', async (t) => {
  const React = await import('react'); const {renderToStaticMarkup} = await import('react-dom/server'); const {createServer} = await import('vite');
  const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'});
  t.after(async()=>vite.close());
  const {PetHomeCard}=await vite.ssrLoadModule('/src/components/PetGame.tsx');
  const draw = (species, skin, pose) => renderToStaticMarkup(React.createElement(PetHomeCard, {books:[],pet:{species,skin,pose,name:'',background:'garden',accessory:null},challenge:started,onOpen(){}}));
  const walking=draw('munchkin',0,'andando'); const sitting=draw('munchkin',0,'sentado');
  assert.match(walking, /pet-sprite-compact[^>]*style="width:[\d.]+%;max-width:[\d.]+px/);
  assert.notEqual(walking.match(/style="width:[^\"]+/)?.[0], sitting.match(/style="width:[^\"]+/)?.[0]);
  assert.doesNotMatch(walking, /(?:cqw|cqh)/);
});

test('la tarjeta compacta tiene anchura explícita compatible sin unidades de contenedor', async (t) => {
  const { readFile } = await import('node:fs/promises');
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
  const rule = css.match(/\.pet-sprite-compact\s*\{[^}]+\}/)?.[0];
  assert.ok(rule);
  assert.doesNotMatch(rule, /cq[wh]|\bmin\(/);
  const dom = new JSDOM(`<!doctype html><style>${rule}</style><div class="pet-sprite-compact"></div>`);
  t.after(()=>dom.window.close());
  const style=dom.window.getComputedStyle(dom.window.document.querySelector('.pet-sprite-compact'));
  assert.equal(style.width, '78%');
  assert.equal(style.maxWidth, '100px');
});

test('los munchkin tienen un tamaño base mayor sin perder la escala por postura', async (t) => {
  const React = await import('react'); const {renderToStaticMarkup} = await import('react-dom/server'); const {createServer} = await import('vite');
  const vite = await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'});
  t.after(async()=>vite.close());
  const {PetHomeCard} = await vite.ssrLoadModule('/src/components/PetGame.tsx');
  const {petPoseScale, PET_POSES} = await import('../src/petArt.ts');
  for (let skin = 0; skin < 6; skin++) for (const pose of PET_POSES) {
    const pet = normalizePet({species:'munchkin',skin,pose,accessory:0});
    const html = renderToStaticMarkup(React.createElement(PetHomeCard,{books:[book(entry(Date.now(), 1600))],pet,challenge:started,onOpen(){}}));
    const match = html.match(/pet-sprite-compact[^>]*style="width:([\d.]+)%;max-width:([\d.]+)px/);
    assert.ok(match);
    const scale = petPoseScale('munchkin',skin,pose);
    assert.ok(Math.abs(Number(match[1]) - 80*scale) < 1e-8);
    assert.ok(Math.abs(Number(match[2]) - 96*scale) < 1e-8);
    assert.ok(Number(match[2]) <= 136, 'la postura debe caber en la tarjeta móvil');
    assert.match(html, /<svg/); // El accesorio sigue dentro del mismo contenedor escalado.
  }
});

test('se conservan los 16 accesorios elegidos y los otros 34 son compañeros laterales', async () => {
  const { stat } = await import('node:fs/promises');
  const kept = [0,1,2,3,4,5,8,9,10,11,14,15,22,23,28,29];
  assert.deepEqual(PET_ACCESSORIES.filter(x=>!x.companion).map(x=>x.id), kept);
  assert.equal(PET_ACCESSORIES.filter(x=>x.companion).length, 34);
  for (const item of PET_ACCESSORIES) {
    assert.equal(item.level, (item.id+1)*2);
    assert.equal(item.placement, item.companion ? 'side' : 'head');
    if (item.companion) {
      assert.ok((await stat(new URL(`../public${item.companion.image}`,import.meta.url))).size > 1000);
    }
  }
  assert.equal(new Set(PET_ACCESSORIES.map(x=>x.name)).size,50);
  const companions = PET_ACCESSORIES.filter(x=>x.companion);
  assert.equal(new Set(companions.map(x=>x.companion.image)).size, 34);
  assert.ok(companions.every(x=>!('filter' in x.companion)));
  assert.equal(new Set(companions.map(x=>x.companion.image.split('/').at(-1).split('-')[0])).size,17);
  assert.deepEqual(companions.filter(x=>x.companion.image.includes('/butterfly-')).map(x=>x.name), ['Mariposa monarca', 'Mariposa azul']);
  assert.ok(companions.every(x=>!x.companion.image.includes('/puppy-')));
  assert.deepEqual(companions.filter(x=>x.companion.image.includes('/puffer-')).map(x=>x.name), ['Pez globo naranja', 'Pez globo azul']);
  assert.ok(companions.every(x=>!x.companion.image.includes('/hedgehog-')));
  const whiteSquirrel = companions.find(x=>x.companion.image.endsWith('/squirrel-blanca.webp'));
  assert.equal(whiteSquirrel?.name, 'Ardilla blanca');
  assert.ok(companions.every(x=>!x.companion.image.includes('/squirrel-dorada')));
});

test('una mascota pequeña aparece al lado y el brote se ancla sobre la cabeza', async (t) => {
  const React = await import('react'); const {renderToStaticMarkup} = await import('react-dom/server'); const {createServer} = await import('vite');
  const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'}); t.after(()=>vite.close());
  const {PetHomeCard,PetGame}=await vite.ssrLoadModule('/src/components/PetGame.tsx');
  const gameHtml=renderToStaticMarkup(React.createElement(PetGame,{books:[],pet:normalizePet({}),challenge:started,onActivate:async()=>{},onSetPet(){}}));
  assert.doesNotMatch(gameHtml,/TU RINCÓN DE LECTURA/);
  const draw=(accessory)=>renderToStaticMarkup(React.createElement(PetHomeCard,{books:[book(entry(Date.now(),10000))],pet:normalizePet({species:'cat',accessory}),challenge:started,onOpen(){}}));
  const companion=draw(6);
  assert.match(companion,/left:\s*46%/);
  assert.match(companion,/left-\[68%\] w-\[55%\]/);
  // La mini mascota comparte el contenedor (y sus límites de tamaño) con el sprite.
  assert.ok(companion.indexOf('data-pet-companion') > companion.indexOf('relative z-10 w-full'));
  assert.match(companion, /data-pet-companion[^>]*bottom-0/);
  assert.match(companion,/\/pets\/companions\/rabbit-clasico\.webp/);
  for (const id of [8,9]) {
    const html=draw(id);
    assert.match(html, /translate\(-50%, -110%\)/);
    assert.ok(html.indexOf('data-pet-head-accessory="behind"') < html.indexOf('relative z-10 w-full'));
  }
  const hat=draw(0); assert.ok(hat.indexOf('data-pet-head-accessory="front"') > hat.indexOf('relative z-10 w-full'));
  assert.doesNotMatch(companion, /filter:/);
  const blueHeart=draw(11); assert.match(blueHeart, /#55b9e8/);
  const lunarHalo=draw(29); assert.match(lunarHalo, /#657487/);
});

test('los 34 compañeros tienen fondo transparente', async (t) => {
  const {execFileSync, spawnSync} = await import('node:child_process');
  if (spawnSync('convert', ['-version']).error) return t.skip('ImageMagick no está instalado');
  for (const item of PET_ACCESSORIES.filter(x=>x.companion)) {
    const name = item.companion.image;
    const path = new URL(`../public${name}`, import.meta.url).pathname;
    const alpha = execFileSync('convert',[path,'-format','%[fx:p{0,0}.a]','info:'],{encoding:'utf8'}).trim();
    assert.equal(alpha,'0',name);
  }
});
