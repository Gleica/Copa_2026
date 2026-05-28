# Conferidor de Figurinhas — Copa 2026

Web app estático para conferir, durante trocas, quais figurinhas do álbum Panini Copa 2026 ainda faltam.

## Como rodar localmente

```bash
cd "FIFA 2026"
python3 -m http.server 8080
```

Acesse `http://localhost:8080` no browser.

> É necessário servir via HTTP (não abrir o `index.html` diretamente como `file://`) porque o app usa ES modules.

## Deploy

Hospedado no GitHub Pages. Qualquer push para a branch `main` atualiza o site.

## Estrutura

```
├── index.html          # ponto de entrada
├── app.js              # lógica principal
├── style.css           # estilos
└── data/
    └── figurinhas.js   # dados das figurinhas faltantes
```
