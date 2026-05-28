import { supabase }  from './supabase.js';
import { PAIR_CODE } from './config.js';

export async function fetchFaltantes() {
  const { data, error } = await supabase
    .from('stickers')
    .select('team_code, number')
    .eq('status', 'faltante')
    .eq('pair_id', PAIR_CODE);
  if (error) throw error;
  if (data.length === 0)
    throw new Error('Nenhuma figurinha encontrada — confirme o PAIR_CODE e rode o seed.');
  return data;
}

export async function markCollected(teamCode, number, userName) {
  const { error } = await supabase
    .from('stickers')
    .update({ status: 'colada', updated_by: userName })
    .eq('team_code', teamCode)
    .eq('number', number)
    .eq('pair_id', PAIR_CODE);
  if (error) throw error;
}

export async function undoCollected(teamCode, number, userName) {
  const { error } = await supabase
    .from('stickers')
    .update({ status: 'faltante', updated_by: userName })
    .eq('team_code', teamCode)
    .eq('number', number)
    .eq('pair_id', PAIR_CODE);
  if (error) throw error;
}

export async function fetchRecents(limit = 20) {
  const { data, error } = await supabase
    .from('stickers')
    .select('team_code, number, updated_by, updated_at')
    .eq('status', 'colada')
    .eq('pair_id', PAIR_CODE)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export function subscribeToChanges(onUpdate) {
  supabase
    .channel('stickers-sync')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'stickers', filter: `pair_id=eq.${PAIR_CODE}` },
      onUpdate,
    )
    .subscribe();
}
