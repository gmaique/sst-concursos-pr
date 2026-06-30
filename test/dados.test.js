import { readFileSync } from 'node:fs';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');

const TEMAS_VALIDOS = [
  'nrs', 'higiene', 'seguranca', 'ergonomia',
  'gestao-sst', 'legislacao', 'portugues', 'raciocinio',
];

describe('data/questoes.json — banco de questões Eng. Segurança do Trabalho (PR)', () => {
  let questoes;

  test('arquivo existe e é JSON válido', () => {
    const raw = readFileSync(join(dataDir, 'questoes.json'), 'utf8');
    questoes = JSON.parse(raw);
  });

  test('contém ao menos 150 questões (provas oficiais)', () => {
    const raw = readFileSync(join(dataDir, 'questoes.json'), 'utf8');
    questoes = JSON.parse(raw);
    assert.ok(questoes.length >= 150, `esperado >= 150 questões, encontrado `);
  });

  test('ids são únicos', () => {
    const raw = readFileSync(join(dataDir, 'questoes.json'), 'utf8');
    questoes = JSON.parse(raw);
    const ids = questoes.map(q => q.id);
    const unicos = new Set(ids);
    assert.strictEqual(unicos.size, ids.length, 'IDs duplicados encontrados');
  });

  test('cada questão tem tema válido', () => {
    const raw = readFileSync(join(dataDir, 'questoes.json'), 'utf8');
    questoes = JSON.parse(raw);
    for (const q of questoes) {
      assert.ok(
        TEMAS_VALIDOS.includes(q.tema),
        `questão ${q.id} tem tema inválido: "${q.tema}"`
      );
    }
  });

  test('cada questão tem 4 ou 5 alternativas (PND=4, Enade=5)', () => {
    const raw = readFileSync(join(dataDir, 'questoes.json'), 'utf8');
    questoes = JSON.parse(raw);
    for (const q of questoes) {
      assert.ok(
        q.alternativas.length === 4 || q.alternativas.length === 5,
        `questão ${q.id} tem ${q.alternativas.length} alternativas (esperado 4 ou 5)`
      );
    }
  });

  test('correta é índice válido dentro das alternativas', () => {
    const raw = readFileSync(join(dataDir, 'questoes.json'), 'utf8');
    questoes = JSON.parse(raw);
    for (const q of questoes) {
      assert.ok(
        Number.isInteger(q.correta) && q.correta >= 0 && q.correta < q.alternativas.length,
        `questão ${q.id} tem correta inválida: ${q.correta} (alternativas: ${q.alternativas.length})`
      );
    }
  });

  test('explicacao não está vazia', () => {
    const raw = readFileSync(join(dataDir, 'questoes.json'), 'utf8');
    questoes = JSON.parse(raw);
    for (const q of questoes) {
      assert.ok(
        typeof q.explicacao === 'string' && q.explicacao.trim().length > 0,
        `questão ${q.id} tem explicacao vazia`
      );
    }
  });

  test('dificuldade é 1, 2 ou 3', () => {
    const raw = readFileSync(join(dataDir, 'questoes.json'), 'utf8');
    questoes = JSON.parse(raw);
    for (const q of questoes) {
      assert.ok(
        [1, 2, 3].includes(q.dificuldade),
        `questão ${q.id} tem dificuldade inválida: ${q.dificuldade}`
      );
    }
  });
});
