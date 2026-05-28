# Conferidor de Figurinhas — Copa 2026

Web app mobile-first para conferir, durante trocas, quais figurinhas do álbum Panini Copa 2026 ainda faltam. Sincroniza em tempo real via Supabase.

## Funcionalidades

- **Conferir** — busca rápida por código ou nome da seleção
- **Progresso** — visão geral do álbum com barra de progresso
- **Sync em tempo real** — dois dispositivos veem as mesmas atualizações
- **Modo visualizador** — qualquer pessoa pode ver os dados, sem editar
- **Modo editor** — protegido por PIN; permite marcar/desmarcar figurinhas
- **PWA** — instalável no celular, funciona offline (somente leitura)
- **Exportar** — compartilha a lista de faltantes via share sheet ou clipboard

## Como rodar localmente

```bash
cp config.example.js config.js
# edite config.js com suas credenciais
python3 -m http.server 8080
```

Acesse `http://localhost:8080` no browser.

> Necessário servir via HTTP (não `file://`) por causa dos ES Modules.

## Configuração

### Variáveis em `config.js`

| Variável | Descrição |
|---|---|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | Chave anon pública |
| `PAIR_CODE` | Código único do par de álbuns (deve bater com a política RLS) |
| `ACCESS_PIN_HASH` | Hash SHA-256 (hex) do PIN de edição |

### Gerar o hash do PIN

```bash
node -e "const c=require('crypto'); console.log(c.createHash('sha256').update('SEU_PIN').digest('hex'))"
```

Cole o resultado no campo `ACCESS_PIN_HASH` do `config.js` e no GitHub Secret de mesmo nome.

## Deploy (GitHub Pages)

Qualquer push para `main` aciona o workflow e publica o site.

### Secrets necessários no repositório

Vá em **Settings → Secrets and variables → Actions** e crie:

| Secret | Valor |
|---|---|
| `SUPABASE_URL` | URL do Supabase |
| `SUPABASE_ANON_KEY` | Chave anon |
| `PAIR_CODE` | Código do par |
| `ACCESS_PIN_HASH` | Hash SHA-256 do PIN |

## Estrutura

```
├── index.html              # ponto de entrada + PWA meta tags
├── app.js                  # lógica e templates
├── db.js                   # camada Supabase
├── supabase.js             # cliente Supabase
├── config.js               # credenciais (gitignored)
├── config.example.js       # template de configuração
├── style.css               # estilos
├── sw.js                   # service worker (cache-first)
├── manifest.webmanifest    # manifest PWA
├── icon.svg                # ícone do app
└── data/
    └── figurinhas.js       # dados das figurinhas faltantes
```
