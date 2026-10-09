// Local verification only. Never connects to Supabase or reads environment secrets.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { testSchema } from '../tests/helpers/schema';

const filename = process.argv[2];
if (!filename) throw new Error('Informe o caminho privado do snapshot JSON.');
const snapshot = JSON.parse(await readFile(filename, 'utf8')) as {
  functions: { name: string; definition: string }[];
  policies: Record<string, unknown>[];
  tables: { name: string; rls: boolean }[];
  constraints: { table: string; name: string; definition: string }[];
  subscriptions: unknown[];
  counts: Record<string, number>;
};
const db = new PGlite({ extensions: { btree_gist, pgcrypto } });
const body = (definition: string) => {
  const match = definition.match(/AS\s+(\$\w*\$)([\s\S]*?)\1/i);
  assert.ok(match, 'Definição de função sem corpo SQL reconhecido.');
  return match[2].replace(/\r/g, '').trim();
};
try {
  await db.exec(testSchema);
  for (const file of ['202609170001_platform.sql', '202609170002_management.sql']) {
    await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));
  }
  for (const fn of snapshot.functions) {
    const result = await db.query<{ definition: string }>(
      "select pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=$1",
      [fn.name],
    );
    assert.equal(result.rows.length, 1, `Função inesperada: ${fn.name}`);
    assert.equal(body(fn.definition), body(result.rows[0].definition), `Divergência: ${fn.name}`);
    // Exercise recovery of the archived production definition in an isolated database.
    await db.exec(fn.definition);
  }
  const policies = await db.query<Record<string, unknown>>(
    "select * from pg_policies where schemaname='public' or (schemaname='storage' and policyname like 'shop_media_%')",
  );
  const sortPolicies = (rows: Record<string, unknown>[]) => rows.sort((a, b) =>
    `${a.schemaname}.${a.tablename}.${a.policyname}`.localeCompare(`${b.schemaname}.${b.tablename}.${b.policyname}`));
  assert.deepEqual(sortPolicies(snapshot.policies), sortPolicies(policies.rows));
  assert.ok(snapshot.tables.every((table) => table.rls));
  assert.ok(snapshot.constraints.some((constraint) => constraint.table === 'appointments' && /EXCLUDE USING gist/.test(constraint.definition)));
  assert.equal(snapshot.counts.subscriptions, snapshot.subscriptions.length);
  for (const file of ['202610080001_security_stability.sql', '202610080002_trial.sql', '202610080003_manual_pix.sql', '202610080004_terms_acceptance.sql']) {
    await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));
  }
  const readiness = await db.query<{ check_name: string; passed: boolean }>(
    await readFile('supabase/checks/launch-readiness.sql', 'utf8'),
  );
  assert.equal(readiness.rows.length, 8);
  for (const check of readiness.rows) assert.equal(check.passed, true, check.check_name);
  console.log(`Snapshot validado: ${snapshot.functions.length} funções recuperadas localmente, ${snapshot.policies.length} políticas compatíveis, RLS/GiST preservados e quatro migrações aplicadas no banco isolado.`);
} finally {
  await db.close();
}
