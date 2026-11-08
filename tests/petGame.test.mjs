import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { PET_SPECIES, SKIN_THRESHOLDS, normalizePet, effectivePet, petProgress } from '../src/petGame.ts';

const date = (y,m,d) => new Date(y,m-1,d,12).getTime();
const book = (...journal) => ({ journal });
const entry = (day,pages,other = {}) => ({ date: day, pages, ...other });

test('mascotas y aspectos: cinco especies, seis diseños y desbloqueos seguros', () => {
  assert.equal(PET_SPECIES.length, 5); assert.ok(PET_SPECIES.every(s => s.skins.length === 6));
  assert.deepEqual(SKIN_THRESHOLDS, [0,100,300,600,1000,1600]);
  assert.deepEqual(normalizePet({ species:'fake', skin:9, name:' x ' }), { species:'cat', skin:0, name:'x' });
  assert.equal(normalizePet({ name:'x'.repeat(100) }).name.length, 24);
  assert.equal(effectivePet({ species:'dragon', skin:2, name:'D' }, 299).skin, 0);
  assert.equal(effectivePet({ species:'dragon', skin:2, name:'D' }, 300).skin, 2);
});

test('páginas del diario cuentan por fecha exacta, suman sesiones y se recalculan sin inventar datos', () => {
  const now = new Date(2026, 0, 7, 12);
  const books = [book(entry(date(2026,1,7),12),entry(date(2026,1,7),13),entry(date(2026,1,6),20),entry(date(2026,1,5),30),entry(date(2026,1,1),100),entry(date(2026,1,7),500,{datePrecision:'year'}),entry(date(2026,1,8),999),entry(date(2026,1,7),-12)), book(entry(date(2026,1,7),25))];
  const p = petProgress(books, now);
  assert.deepEqual([p.total,p.dayPages,p.weekPages,p.streak,p.level,p.levelPages,p.activeDays], [200,50,100,3,3,0,4]);
  assert.equal(petProgress([book(entry(date(2026,1,6),1))],now).streak, 1);
  assert.equal(petProgress([book(entry(date(2026,1,5),1))],now).streak, 0);
  assert.equal(petProgress([],now).total,0);
});

test('interfaz permite elegir mascota, desbloquea aspectos, nombra y muestra resumen en inicio', async (t) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url:'http://bilibook.test/' });
  globalThis.window = dom.window; globalThis.document = dom.window.document; Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator, configurable:true}); globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const React = await import('react'); const {createRoot} = await import('react-dom/client'); const {createServer} = await import('vite');
  const vite = await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'}); const {PetGame, PetHomeCard} = await vite.ssrLoadModule('/src/components/PetGame.tsx');
  const root = createRoot(document.getElementById('root'));
  t.after(async () => { await React.act(async () => root.unmount()); await vite.close(); dom.window.close(); delete globalThis.window; delete globalThis.document; delete globalThis.navigator; delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
  const today = new Date(); const books = [book(entry(today.getTime(), 350))]; let pet = {species:'cat',skin:0,name:''}; let opened = false;
  const render = () => root.render(React.createElement(React.Fragment,null,React.createElement(PetHomeCard,{books,pet,onOpen:()=>{opened=true;}}),React.createElement(PetGame,{books,pet,onSetPet:p => {pet=p;render();}})));
  await React.act(async () => render());
  assert.equal(document.querySelectorAll('[aria-label="Elegir mascota"] button').length,5);
  assert.equal(document.querySelectorAll('button[disabled]').length,3);
  await React.act(async () => document.querySelector('[aria-label="Abrir Mi mascota"]').click()); assert.equal(opened,true);
  await React.act(async () => [...document.querySelectorAll('[aria-label="Elegir mascota"] button')].find(x => x.textContent.includes('Dragón')).click());
  assert.equal(pet.species,'dragon');
  await React.act(async () => [...document.querySelectorAll('button')].find(x => x.textContent.includes('Océano')).click()); assert.equal(pet.skin,2);
  assert.match(document.body.textContent,/Nivel 4/); assert.match(document.body.textContent,/3\/3 completadas/);
  await React.act(async () => document.querySelector('[aria-label="Saludar a Dragón"]').click());
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
  async function req(account, patch) { const res=await fetch(`${base}/api/settings`,{method:patch?'PUT':'GET',headers:{'Content-Type':'application/json',cookie:`bilibook-account=${account}`},...(patch?{body:JSON.stringify({pet:patch})}:{})}); assert.equal(res.status,200);return res.json(); }
  assert.deepEqual((await req('raul')).pet,{species:'cat',skin:0,name:''});
  assert.deepEqual((await req('raul',{species:'trex',skin:5,name:' Dino '})).pet,{species:'trex',skin:5,name:'Dino'});
  assert.deepEqual((await req('pequenaja')).pet,{species:'cat',skin:0,name:''});
  assert.deepEqual((await req('pequenaja',{species:'invalida',skin:-1,name:5})).pet,{species:'cat',skin:0,name:''});
  await stop(); await start(); assert.deepEqual((await req('raul')).pet,{species:'trex',skin:5,name:'Dino'}); assert.equal((await req('pequenaja')).pet.species,'cat');
});
