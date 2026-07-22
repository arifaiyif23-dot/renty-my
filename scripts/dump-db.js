const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const OLD_DB = 'postgresql://postgres:#jPQHu9uf/gB76L@db.vrlukohqzwuddmuathai.supabase.co:5432/postgres';

async function getSchemas(client) {
  const { rows } = await client.query(`
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
    AND schema_name NOT LIKE 'pg_%'
    ORDER BY schema_name
  `);
  return rows.map(r => r.schema_name);
}

async function dumpTableData(client, schema, table) {
  const { rows } = await client.query(`SELECT * FROM "${schema}"."${table}"`);
  if (rows.length === 0) return '';
  const cols = Object.keys(rows[0]);
  const values = rows.map(row => {
    const vals = cols.map(c => {
      const v = row[c];
      if (v === null || v === undefined) return 'NULL';
      if (typeof v === 'object') {
        if (v instanceof Date) return `'${v.toISOString()}'`;
        return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
      }
      if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
      if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
      return v;
    });
    return `(${vals.join(', ')})`;
  });
  return `INSERT INTO "${schema}"."${table}" ("${cols.join('", "')}") VALUES\n${values.join(',\n')};\n\n`;
}

async function main() {
  console.log('Connecting to old database...');
  const client = new Client({ connectionString: OLD_DB });
  await client.connect();
  console.log('Connected.');

  const schemas = await getSchemas(client);
  console.log('Schemas:', schemas.join(', '));

  let output = '-- Dumped from renty-my production DB\n-- Generated via Node.js pg client\n\n';

  // Dump schema first (CREATE TABLE, etc.)
  for (const schema of schemas) {
    // Get all tables
    const { rows: tables } = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = $1 AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `, [schema]);

    for (const { table_name } of tables) {
      // Get CREATE TABLE statement
      const { rows: [def] } = await client.query(`
        SELECT pg_catalog.pg_get_viewdef(c.oid, true) as view_def,
               c.relkind
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1 AND c.relname = $2
      `, [schema, table_name]);

      if (def && def.relkind === 'v') {
        // It's a view
        output += `CREATE OR REPLACE VIEW "${schema}"."${table_name}" AS\n${def.view_def};\n\n`;
      }
    }
  }

  // Dump sequences
  const { rows: sequences } = await client.query(`
    SELECT sequence_schema, sequence_name, data_type
    FROM information_schema.sequences
    WHERE sequence_schema NOT IN ('information_schema', 'pg_catalog')
  `);
  for (const seq of sequences) {
    const { rows: [curr] } = await client.query(`SELECT last_value FROM "${seq.sequence_schema}"."${seq.sequence_name}"`);
    output += `SELECT setval('"${seq.sequence_schema}"."${seq.sequence_name}"', ${curr.last_value}, true);\n`;
  }

  if (sequences.length > 0) output += '\n';

  // Dump data
  for (const schema of schemas) {
    const { rows: tables } = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = $1 AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `, [schema]);

    for (const { table_name } of tables) {
      const data = await dumpTableData(client, schema, table_name);
      output += data;
    }
  }

  // Dump functions
  const { rows: functions } = await client.query(`
    SELECT proname, prosrc, pronargs, pg_get_functiondef(p.oid) as def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname NOT IN ('information_schema', 'pg_catalog')
    AND n.nspname NOT LIKE 'pg_%'
    AND p.prokind = 'f'
  `);
  for (const fn of functions) {
    output += `${fn.def};\n\n`;
  }

  console.log(`Total output size: ${(output.length / 1024 / 1024).toFixed(2)} MB`);
  
  const outPath = path.join(__dirname, '..', 'supabase', 'dump.sql');
  fs.writeFileSync(outPath, output, 'utf8');
  console.log(`Written to: ${outPath}`);

  await client.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
