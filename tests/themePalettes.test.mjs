import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  CUSTOM_PALETTE_CSS_VAR_KEYS,
  CUSTOM_PALETTE_CSS_VARS_KEY,
  applyCustomPaletteToRoot,
  buildPaletteCssVars,
  generateDarkPaletteColors,
  mixHexColors,
  paletteColorsFromTheme,
  readableTextColor,
  sanitizeCustomPalettes,
} from '../src/themePalettes.ts';

const validPalette = {
  id: 'custom-azul',
  name: 'Azul Bilibook',
  baseTheme: 'oceano',
  light: {
    bg: '#EEF8FF',
    surface: '#FFFFFF',
    ink: '#12324A',
    primary: '#0284C7',
    accent: '#0F766E',
    accent2: '#F59E0B',
  },
  dark: {
    bg: '#061928',
    surface: '#0B2A42',
    ink: '#E8F6FF',
    primary: '#38BDF8',
    accent: '#2DD4BF',
    accent2: '#FBBF24',
  },
  createdAt: 123,
};

describe('paletas personalizadas', () => {
  test('normaliza colores, deduplica IDs y descarta entradas inválidas', () => {
    const palettes = sanitizeCustomPalettes([
      validPalette,
      { ...validPalette, name: 'Duplicada' },
      { id: 'no válida', name: 'Descartada' },
      {
        ...validPalette,
        id: 'custom-incompleta',
        baseTheme: 'tema-que-no-existe',
        light: { bg: 'azul', primary: '#123456' },
        dark: null,
        createdAt: 'ayer',
      },
    ]);

    assert.equal(palettes.length, 2);
    assert.equal(palettes[0].light.bg, '#eef8ff');
    assert.equal(palettes[0].createdAt, 123);
    assert.equal(palettes[1].baseTheme, 'calido');
    assert.equal(palettes[1].light.primary, '#123456');
    assert.match(palettes[1].light.bg, /^#[0-9a-f]{6}$/);
    assert.match(palettes[1].dark.surface, /^#[0-9a-f]{6}$/);
    assert.equal(palettes[1].createdAt, 0);
  });

  test('deriva tokens RGB completos y texto legible sobre el color principal', () => {
    const vars = buildPaletteCssVars(validPalette.light, false);

    assert.equal(vars['--primary'], '2 132 199');
    assert.equal(vars['--accent'], '15 118 110');
    assert.match(vars['--line'], /^\d+ \d+ \d+$/);
    assert.match(vars['--chart-5'], /^\d+ \d+ \d+$/);
    assert.match(vars['--shelf-1'], /^#[0-9a-f]{6}$/);
    assert.equal(readableTextColor('#0284c7'), '#ffffff');
    assert.equal(readableTextColor('#fde68a'), '#101828');
  });

  test('genera una variante oscura real y parte de las paletas integradas', () => {
    const dark = generateDarkPaletteColors(validPalette.light);
    const [red, green, blue] = [1, 3, 5].map((index) => Number.parseInt(dark.bg.slice(index, index + 2), 16));
    assert.ok((red + green + blue) / 3 < 45, 'el fondo generado debe ser oscuro');

    const ocean = paletteColorsFromTheme('oceano');
    assert.equal(ocean.light.bg, '#eef8ff');
    assert.equal(ocean.light.primary, '#0284c7');
    assert.match(ocean.dark.bg, /^#[0-9a-f]{6}$/);
    assert.equal(mixHexColors('#000000', '#ffffff', 0.5), '#808080');
  });

  test('limpia variables antiguas inyectadas antes de React y respeta claro/oscuro', () => {
    const properties = new Map(
      CUSTOM_PALETTE_CSS_VAR_KEYS.map((key) => [key, '1 2 3']),
    );
    const removedStorageKeys = [];
    const root = {
      dataset: { customPalette: 'paleta-antigua' },
      style: {
        colorScheme: 'dark',
        setProperty(key, value) { properties.set(key, value); },
        removeProperty(key) { properties.delete(key); },
      },
    };

    globalThis.document = { documentElement: root };
    globalThis.localStorage = {
      removeItem(key) { removedStorageKeys.push(key); },
    };

    try {
      applyCustomPaletteToRoot(null, false);
      assert.equal(properties.size, 0, 'ninguna variable antigua debe sobrevivir');
      assert.equal(root.style.colorScheme, 'only light');
      assert.equal(root.dataset.customPalette, undefined);
      assert.ok(removedStorageKeys.includes(CUSTOM_PALETTE_CSS_VARS_KEY));

      applyCustomPaletteToRoot(validPalette, false);
      assert.equal(properties.get('--bg'), buildPaletteCssVars(validPalette.light, false)['--bg']);
      assert.equal(root.style.colorScheme, 'only light');
      assert.equal(root.dataset.customPalette, validPalette.id);

      applyCustomPaletteToRoot(validPalette, true);
      assert.equal(properties.get('--bg'), buildPaletteCssVars(validPalette.dark, true)['--bg']);
      assert.notEqual(
        buildPaletteCssVars(validPalette.light, false)['--bg'],
        buildPaletteCssVars(validPalette.dark, true)['--bg'],
      );
      assert.equal(root.style.colorScheme, 'only dark');
    } finally {
      delete globalThis.document;
      delete globalThis.localStorage;
    }
  });
});
