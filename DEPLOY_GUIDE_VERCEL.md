# Deploy do Raio‑X Financeiro na Vercel (grupostout.com.br)

Este projeto usa **Vite + React** e **Supabase**.

## 1) Variáveis de ambiente
Crie um arquivo `.env.local` (já incluído) com:
```
VITE_SUPABASE_URL=https://dopgudlgtnzgdrlildlm.supabase.co
VITE_SUPABASE_ANON_KEY=COLE_A_SUA_ANON_KEY_AQUI
```
> Na Vercel, adicione as mesmas chaves em *Project Settings → Environment Variables*.

## 2) Scripts de build
Os scripts do `package.json` já estão prontos:
```
npm run dev     # ambiente local em http://localhost:3000
npm run build   # build de produção
```

## 3) Deploy na Vercel
1. Importe este repositório no Vercel.
2. Em **Environment Variables**, adicione:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy.

## 4) Domínio
No painel da Vercel → *Settings → Domains*, adicione:
- **grupostout.com.br** (ou um subdomínio, ex: `sistema.grupostout.com.br`)

Aponte o DNS na sua registradora para os **Nameservers** da Vercel ou crie um **CNAME** apontando para o projeto.

## 5) Teste de conexão Supabase
Abra o console do navegador e rode:
```js
import { supabase } from '/src/lib/customSupabaseClient.js';
supabase.from('recebimentos_liquido_view').select('*').limit(1).then(console.log);
```

Se aparecer `data` sem `error`, está tudo certo.

---
