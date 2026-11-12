import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { buildWrapUp, wrapUpYears } from '../src/wrapUp.ts';

const date = (y,m,d = 1) => new Date(y,m-1,d,12).getTime();
const book = (id, overrides = {}) => ({ id, title: id, author: 'Autora', status: 'read', finishedAt: date(2024,2), pages: 300, rating: 4, journal: [], coverUrl: '', ...overrides });

test('el resumen respeta fechas parciales y cuenta relecturas sin inventar páginas de diario', () => {
  const books = [
    book('A', {finishedAt: date(2024,2,10), previousReadings: [{finishedAt: date(2024,2,2), pages: 200}], journal: [{date:date(2024,2,9),pages:20},{date:date(2024,3),pages:30}]}),
    book('B', {finishedAt:date(2024,1),finishedAtPrecision:'year',author:'Otra',rating:0,journal:[{date:date(2024,1),datePrecision:'year',pages:8}]}),
    book('C', {finishedAt:date(2024,2),finishedAtPrecision:'month',author:'Otra',rating:3,journal:[{date:date(2024,2),datePrecision:'month',pages:4},{date:date(2024,2),datePrecision:'unknown',pages:999}]}),
    book('D', {status:'reading',finishedAt:null,journal:[{date:date(2024,2,15),pages:6}]}),
  ];
  const monthly = buildWrapUp(books,{year:2024,month:1});
  assert.equal(monthly.readings.length,3); assert.equal(monthly.covers.length,2);
  assert.equal(monthly.journalPages,30); assert.equal(monthly.authors,2); assert.equal(monthly.averageRating,11/3);
  const annual = buildWrapUp(books,{year:2024,month:null});
  assert.equal(annual.readings.length,4); assert.equal(annual.journalPages,68);
  assert.deepEqual(wrapUpYears(books,2026),[2026,2024]);
  assert.deepEqual(buildWrapUp([], {year:2024,month:null}).averageRating,null);
});

test('la pestaña permite elegir periodo y descargar la imagen preparada', async t => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {url:'http://bilibook.test/'});
  globalThis.window=dom.window; globalThis.document=dom.window.document; globalThis.Image=dom.window.Image; globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
  const context = { fillRect(){}, beginPath(){}, arc(){}, fill(){}, fillText(){}, measureText(s){return {width:s.length*10};}, drawImage(){}, save(){}, rect(){}, clip(){}, restore(){} };
  dom.window.HTMLCanvasElement.prototype.getContext = () => context;
  dom.window.HTMLCanvasElement.prototype.toBlob = function(cb){cb(new Blob(['png'],{type:'image/png'}));};
  let downloaded = ''; const create = URL.createObjectURL, revoke = URL.revokeObjectURL;
  URL.createObjectURL = () => 'blob:wrapup'; URL.revokeObjectURL = () => {};
  dom.window.HTMLAnchorElement.prototype.click = function(){ downloaded=this.download; };
  const React=await import('react'); const {createRoot}=await import('react-dom/client'); const {createServer}=await import('vite');
  const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'}); const {WrapUp}=await vite.ssrLoadModule('/src/components/WrapUp.tsx'); const root=createRoot(document.getElementById('root'));
  t.after(async()=>{await React.act(async()=>root.unmount()); await vite.close();dom.window.close();URL.createObjectURL=create;URL.revokeObjectURL=revoke;delete globalThis.window;delete globalThis.document;delete globalThis.navigator;delete globalThis.Image;delete globalThis.IS_REACT_ACT_ENVIRONMENT;});
  await React.act(async()=>root.render(React.createElement(WrapUp,{books:[book('A')]})));
  const selects=document.querySelectorAll('select');
  await React.act(async()=>{selects[0].value='year';selects[0].dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
  const yearSelect=[...document.querySelectorAll('select')].find(s=>s.parentElement.textContent.startsWith('Año'));
  await React.act(async()=>{yearSelect.value='2024';yearSelect.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
  assert.match(document.querySelector('canvas').getAttribute('aria-label'), /2024: 1 lecturas terminadas/);
  const button=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Descargar imagen'));
  assert.equal(button.disabled,false); await React.act(async()=>button.click()); assert.equal(downloaded,'bilibook-wrap-up-2024.png');
});

test('el wrap-up aparece en la navegación de escritorio y móvil', async t => {
  const React=await import('react'); const {renderToStaticMarkup}=await import('react-dom/server'); const {createServer}=await import('vite');
  const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'});t.after(()=>vite.close());
  const {Sidebar,MobileNav}=await vite.ssrLoadModule('/src/components/Navigation.tsx');
  const sidebar=renderToStaticMarkup(React.createElement(Sidebar,{active:'wrapup',onChange(){},counts:{},onAdd(){},onImport(){},onTags(){},onAppearance(){},theme:'clasico',onSetTheme(){},dark:false,onToggleDark(){}}));
  assert.match(sidebar,/Wrap-up/); assert.match(sidebar,/aria-current="page"/);
  const mobile=renderToStaticMarkup(React.createElement(MobileNav,{active:'wrapup',onChange(){}}));
  assert.match(mobile,/aria-label="Otros"/);
});
