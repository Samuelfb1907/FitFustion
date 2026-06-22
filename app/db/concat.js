#!/usr/bin/env node
// Migrations-Helfer: gibt alle DB-Migrationen ab einer Nummer in korrekter Reihenfolge
// kombiniert aus - praktisch, um ausstehende Migrationen am Stueck in den Supabase
// SQL-Editor zu kopieren. Die Migrationen sind idempotent (Mehrfach-Ausfuehrung schadet nicht).
//
//   node db/concat.js          -> alle nummerierten Migrationen (ohne schema.sql)
//   node db/concat.js 38       -> ab Migration 038 (z. B. nur die neuesten/ausstehenden)
//   node db/concat.js 24 > pending.sql
//
// Ausgabe -> stdout; kurze Zusammenfassung -> stderr.
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const from = Number(process.argv[2] || 0);
const files = fs
  .readdirSync(dir)
  .filter((f) => /^\d+_.*\.sql$/.test(f))
  .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
  .filter((f) => parseInt(f, 10) >= from);

let out = '';
for (const f of files) {
  out += '\n-- ============================================================\n';
  out += `-- ${f}\n`;
  out += '-- ============================================================\n';
  out += fs.readFileSync(path.join(dir, f), 'utf8').trim() + '\n';
}
process.stdout.write(out);
process.stderr.write(`\n[concat] ${files.length} Migration(en) ab ${from || 1} ausgegeben.\n`);
