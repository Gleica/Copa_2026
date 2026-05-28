# Conferidor de Figurinhas — Copa 2026

Web app mobile-first para conferir, durante trocas, quais figurinhas do álbum Panini Copa 2026 (capa dura, 979 figurinhas) ainda faltam. Sincroniza em tempo real via Supabase.

## Funcionalidades

- **Busca rápida** — digita só o código (ex: `BRA`) e vê todas as faltantes; digita código + número (ex: `BRA 8`) e vê se precisa ou já tem
- **Busca por seleção** — busca por nome ou código com dropdown, depois confere qualquer número
- **Progresso** — visão geral do álbum com barra de progresso e lista completa de seleções
- **Sync em tempo real** — dois dispositivos veem as mesmas atualizações instantaneamente
- **Modo visualizador** — padrão; qualquer pessoa pode ver os dados sem editar
- **Modo editor** — protegido por PIN; permite marcar figurinhas como coladas e desfazer
- **Perfis** — ao entrar no modo editor, escolhe entre Gleica e Patty para identificar quem colou
- **Histórico recente** — lista as últimas figurinhas coladas com opção de desfazer
- **PWA** — instalável no celular (iOS e Android), funciona offline em modo somente leitura
- **48 seleções / 979 figurinhas** no álbum Panini Copa do Mundo 2026

## Como usar a busca rápida

| Você digita | Resultado |
|---|---|
| `BRA` | Mostra todas as figurinhas faltantes do Brasil |
| `BRA 8` | Mostra se a figurinha 8 do Brasil precisa ou já tem |
| `GER` | Mostra todas as faltantes da Alemanha |
| `GER 3` | Verifica a figurinha 3 da Alemanha |

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

### Modo editor

O cadeado no canto superior direito abre o prompt de PIN. Após autenticar:
- Escolha o perfil (Gleica ou Patty)
- Toque em qualquer número nos chips para marcar como colada
- O histórico recente aparece na parte inferior com opção de desfazer

## Deploy (GitHub Pages)

Qualquer push para `main` aciona o workflow e publica automaticamente.

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
├── app.js                  # lógica, estado e templates
├── db.js                   # camada Supabase (fetch, mark, undo, recents, realtime)
├── supabase.js             # cliente Supabase
├── config.js               # credenciais (gitignored)
├── config.example.js       # template de configuração
├── style.css               # estilos (dark mode, tokens CSS)
├── sw.js                   # service worker cache-first (copa2026-v3)
├── manifest.webmanifest    # manifest PWA
├── icon.svg                # ícone do app
└── data/
    └── figurinhas.js       # lista de 48 seleções com figurinhas faltantes
```
