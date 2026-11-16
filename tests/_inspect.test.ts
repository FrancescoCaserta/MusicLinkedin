import { test } from 'vitest';
import { buildSeed } from '../src/data/mock/seed';

test('inspect', () => {
  const t0 = Date.now();
  const db = buildSeed('2026-11-16');
  console.log('ms', Date.now() - t0, 'size KB', Math.round(JSON.stringify(db).length / 1024));
  console.log({
    musicians: db.musicians.length, accounts: db.accounts.length, orgs: db.organisations.length, concerts: db.concerts.length,
    upcoming: db.concerts.filter(c => c.date >= '2026-11-16').length,
    opps: db.opportunities.length, apps: db.applications.length, conns: db.connections.length, endorsements: db.endorsements.length,
    threads: db.threads.length, msgs: db.messages.length, demo: db.meta.demoDate,
  });
  const cc = db.musicians.map(m => db.concerts.filter(c => c.participants.some(p => p.musicianId === m.id)).length);
  console.log('concerts per musician min/avg/max', Math.min(...cc), (cc.reduce((a, b) => a + b, 0) / cc.length).toFixed(1), Math.max(...cc));
  const rr = db.musicians.map(m => m.repertoire.length);
  console.log('rep per musician min/avg/max', Math.min(...rr), (rr.reduce((a, b) => a + b, 0) / rr.length).toFixed(1), Math.max(...rr));
  console.log('low concerts:', db.musicians.filter((_m, i) => cc[i] < 3).map(m => m.name));
  console.log('orgs members:', db.organisations.map(o => `${o.name}: ${o.members.length} / ${db.concerts.filter(c => c.orgId === o.id).length}c`).join('\n'));
  for (const name of ['Nicolò Baldini', 'Marta Ghidoni', 'Edoardo Gualandi', 'Giulia Santoro', 'Hannah Lindner', 'Moritz Schäfer', 'Anna Bedeschi', 'Jacopo Verdirame', 'Sara Guidotti']) {
    const m = db.musicians.find(x => x.name === name)!;
    console.log('\n=====', m.name, '|', m.headline, '| roles', m.roles.join(','), '| pitches', m.pitches.join(','), '| langs', m.languages.join(','));
    console.log(m.bio);
    console.log('TRAINING', m.training.map(t => `${t.from}-${t.to} ${t.institution} / ${t.qualification} / ${t.teacher}`).join(' || '));
    console.log('POS', m.positions.map(p => `${p.title} @ ${p.organisation} ${p.from}`).join(' | '));
    console.log('AWARDS', m.awards.map(a => `${a.year} ${a.result} ${a.competition}`).join(' | '));
    console.log('REP', m.repertoire.length, m.repertoire.slice(0, 14).map(r => `${r.composer}: ${r.work}${r.part ? ' [' + r.part + ']' : ''} (${r.status} ${r.lastPerformed ?? ''})`).join('\n   '));
    console.log('REC', m.recordings.map(r => `${r.title} — ${r.note}`).join(' | '));
    const cs = db.concerts.filter(c => c.participants.some(p => p.musicianId === m.id));
    console.log('CONCERTS', cs.length, cs.slice(0, 7).map(c => `${c.date} ${c.city}, ${c.venue} · ${c.ensembleName ?? ''} · ${c.programme.map(p => p.composer + ' ' + p.work).join('; ')} · as ${c.participants.find(p => p.musicianId === m.id)!.role}`).join('\n   '));
    console.log('ENDORSE', db.endorsements.filter(e => e.toId === m.id).map(e => `${db.accounts.find(a => a.id === e.fromId)?.name}: ${e.text}`).join('\n   '));
    console.log('AVAIL', Object.keys(m.availability).length, 'conn', db.connections.filter(c => c.from === m.id || c.to === m.id).length);
  }
});
