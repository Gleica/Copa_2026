import { figurinhas } from './data/figurinhas.js';
import { supabase }    from './supabase.js';
import { PAIR_CODE }   from './config.js';

const btn    = document.getElementById('run-seed');
const output = document.getElementById('seed-output');

function log(msg) {
  if (output) output.textContent += msg + '\n';
  console.log(msg);
}

const CHUNK_SIZE = 100;

async function runSeed() {
  const rows = figurinhas.flatMap(team =>
    team.missing.map(n => ({
      team_code:  team.code,
      number:     n,
      status:     'faltante',
      pair_id:    PAIR_CODE,
      updated_by: 'seed',
    }))
  );

  log(`Preparando ${rows.length} registros…`);

  let inserted = 0;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase
      .from('stickers')
      .upsert(chunk, { onConflict: 'team_code,number', ignoreDuplicates: true });

    if (error) {
      log(`❌ Erro no lote ${i}–${i + chunk.length}: ${error.message}`);
      return;
    }
    inserted += chunk.length;
    log(`✓ ${inserted}/${rows.length} inseridos`);
  }

  log(`\n✅ Seed concluído: ${inserted} figurinhas inseridas com status "faltante".`);
  if (btn) { btn.textContent = '✅ Concluído'; btn.disabled = true; }
}

btn?.addEventListener('click', async () => {
  btn.disabled    = true;
  btn.textContent = 'Rodando…';
  if (output) output.textContent = '';
  await runSeed();
});
