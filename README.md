# SST Concursos PR — Engenharia de Segurança do Trabalho 🦺

App de estudo para concursos públicos do **Paraná** com vaga de **Engenheiro(a) de Segurança do Trabalho**. Mesmo motor dos apps de estudo (banco de questões, repetição espaçada/SRS, simulado no formato de prova, plano de estudos), com foco em **acessibilidade**.

## Acessibilidade (ligada por padrão)
- **Modo Calmo**: fundo plano e suave, sem brilhos nem animações, menos saturação — reduz sobrecarga sensorial e ajuda o foco.
- **Texto maior**: aumenta a leitura.
- **Sem pressão de tempo** por padrão, tom acolhedor, zero punição por erro ou dia perdido.
- **Uma coisa por vez**, layout previsível e instruções objetivas; o **Plano de Estudos** organiza o que fazer a cada dia (andaime para funções executivas).
- Respeita `prefers-reduced-motion`.

## Conteúdo
- 8 áreas: Normas Regulamentadoras, Higiene Ocupacional, Segurança do Trabalho, Ergonomia, Gestão de SST, Legislação, Português e Raciocínio Lógico.
- Começa com um **banco-semente** de questões (estilo concurso) e cresce com a transcrição de **provas oficiais anteriores** de concursos do PR (COPEL, SANEPAR, UFPR/UTFPR/IFPR, prefeituras, etc.).
- `data/questoes.json` — campos: `tema`, `enunciado`, `alternativas`, `correta` (índice), `explicacao`, `dificuldade`.

## Rodar local
`python3 -m http.server 8000` e abrir http://localhost:8000

## Testes
`node --test`

> App estático, instalável como PWA, funciona offline. Sem dados pessoais — o progresso fica só no aparelho (localStorage).
