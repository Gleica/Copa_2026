// Copie este arquivo para config.js e preencha com seus valores reais.
// config.js está no .gitignore — nunca commite credenciais.

export const SUPABASE_URL      = 'https://SEU_PROJETO.supabase.co';
export const SUPABASE_ANON_KEY = 'SUA_ANON_KEY_AQUI';

// Deve bater EXATAMENTE com o valor hardcoded nas políticas RLS do Supabase.
// Escolha algo difícil de adivinhar (ex: "copa2026gleicabrunoXYZ").
export const PAIR_CODE = 'SEU_PAIR_CODE_AQUI';

// Hash SHA-256 (hex) do PIN que desbloqueia o modo editor.
// Gere com: node -e "const c=require('crypto');console.log(c.createHash('sha256').update('SEU_PIN').digest('hex'))"
export const ACCESS_PIN_HASH = 'SHA256_HEX_DO_SEU_PIN';
