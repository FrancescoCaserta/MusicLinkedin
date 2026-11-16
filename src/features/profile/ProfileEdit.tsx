import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useViewer } from '../../app/session';
import type { MusicianPatch } from '../../data/api';
import { api } from '../../data/client';
import { useApiMutation, useApiQuery } from '../../data/hooks';
import { suggestRepertoire } from '../../domain/catalogue';
import { COUNTRY_NAMES, placeOf } from '../../domain/cities';
import { today } from '../../domain/dates';
import { instrument, LANGUAGES, PITCHES, ROLES } from '../../domain/taxonomy';
import type { Genre, InstrumentLevel, Musician, ProgrammeItem, RepertoireItem, RepertoireStatus } from '../../domain/types';
import { fmt, t } from '../../i18n';
import { Async, EmptyState, Field } from '../../ui/basics';
import { CityPicker, Combobox, InstrumentSelect } from '../../ui/pickers';

const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const YEAR = new Date().getFullYear();
const TABS = [
  ['basics', 'Basics'],
  ['instruments', 'Instruments and roles'],
  ['repertoire', 'Repertoire'],
  ['concerts', 'Concerts'],
  ['training', 'Training and awards'],
  ['recordings', 'Recordings'],
  ['practical', 'Fee and practicalities'],
] as const;
type TabId = (typeof TABS)[number][0];

function SaveBar({ dirty, pending, onSave, error }: { dirty: boolean; pending: boolean; onSave: () => void; error?: string }) {
  return (
    <div className="savebar">
      <span className="small" style={{ color: error ? 'var(--urgent)' : 'var(--ink-3)' }}>{error ?? (dirty ? t('You have unsaved changes.') : t('All changes saved.'))}</span>
      <button type="button" className="btn btn--primary" disabled={!dirty || pending || !!error} onClick={onSave}>
        {pending ? t('Saving…') : t('Save changes')}
      </button>
    </div>
  );
}

/** Local draft of part of the profile, saved through the data layer. */
function useSection<T extends MusicianPatch>(m: Musician, pick: (m: Musician) => T) {
  const [draft, setDraft] = useState<T>(() => structuredClone(pick(m)));
  const [dirty, setDirty] = useState(false);
  const save = useApiMutation((patch: T) => api.updateMusician(m.id, patch), { success: t('Profile updated.'), onDone: () => setDirty(false) });
  const set = (patch: Partial<T>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };
  return { draft, set, dirty, pending: save.isPending, save: () => save.mutate(draft) };
}

function Rows<T extends { id: string }>({ items, onChange, render, add, addLabel, empty }: { items: T[]; onChange: (items: T[]) => void; render: (item: T, update: (patch: Partial<T>) => void) => ReactNode; add: () => T; addLabel: string; empty: string }) {
  return (
    <div className="stack">
      {items.length === 0 && <p className="muted small">{empty}</p>}
      {items.map((item, k) => (
        <div key={item.id} className="editrow">
          <div className="editrow__fields">{render(item, (patch) => onChange(items.map((x, j) => (j === k ? { ...x, ...patch } : x))))}</div>
          <button type="button" className="btn btn--quiet btn--icon btn--sm" onClick={() => onChange(items.filter((_x, j) => j !== k))} aria-label={t('Remove')}>
            <Trash2 size={15} aria-hidden />
          </button>
        </div>
      ))}
      <div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange([...items, add()])}>
          <Plus size={14} aria-hidden /> {addLabel}
        </button>
      </div>
    </div>
  );
}

function Basics({ m }: { m: Musician }) {
  const s = useSection(m, (x) => ({ headline: x.headline, bio: x.bio, base: x.base, languages: x.languages }));
  const d = s.draft;
  const error = !d.headline?.trim() ? t('A headline is needed — it is what people see in search results.') : undefined;
  return (
    <div className="stack stack--lg">
      <Field label={t('Headline')} hint={t('One line under your name, e.g. “Principal oboe, Orchestra …” or “Baroque violin · continuo”.')}>
        <input className="input" value={d.headline ?? ''} maxLength={110} onChange={(e) => s.set({ headline: e.target.value })} />
      </Field>
      <Field label={t('Biography')} hint={t('Written the way it would appear in a programme. {n} characters.', { n: (d.bio ?? '').length })}>
        <textarea className="textarea" rows={9} value={d.bio ?? ''} onChange={(e) => s.set({ bio: e.target.value })} />
      </Field>
      <Field label={t('Based in')} hint={d.base ? `${d.base.name}, ${t(COUNTRY_NAMES[d.base.country] ?? d.base.country)} — ${t('distance searches are measured from here.')}` : undefined}>
        <CityPicker value={d.base?.name ?? ''} onPick={(c) => c && s.set({ base: placeOf(c) })} />
      </Field>
      <div className="field">
        <span className="field__label">{t('Rehearsal languages')}</span>
        <div className="row row--wrap" style={{ gap: 6 }}>
          {LANGUAGES.map((l) => {
            const on = d.languages?.includes(l) ?? false;
            return (
              <button key={l} type="button" className={`chip${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => s.set({ languages: on ? d.languages!.filter((x) => x !== l) : [...(d.languages ?? []), l] })}>
                {t(l)}
              </button>
            );
          })}
        </div>
      </div>
      <SaveBar dirty={s.dirty} pending={s.pending} onSave={s.save} error={error} />
    </div>
  );
}

function Instruments({ m }: { m: Musician }) {
  const s = useSection(m, (x) => ({ instruments: x.instruments, roles: x.roles, pitches: x.pitches, voiceDescription: x.voiceDescription }));
  const d = s.draft;
  const list = d.instruments ?? [];
  const voice = instrument(list[0]?.instrumentId ?? '')?.family === 'voice';
  const dup = new Set(list.map((p) => p.instrumentId)).size !== list.length;
  const error = !list.length ? t('Add at least your main instrument or voice.') : dup ? t('The same instrument is listed twice.') : !d.roles?.length ? t('Choose at least one kind of work.') : undefined;
  const setAt = (k: number, patch: Partial<(typeof list)[number]>) => s.set({ instruments: list.map((p, j) => (j === k ? { ...p, ...patch } : p)) });
  return (
    <div className="stack stack--lg">
      <div className="field">
        <span className="field__label">{t('Instruments and voice')}</span>
        <span className="field__hint">{t('The first is your main instrument or voice type. Add second instruments, doublings (piccolo, cor anglais…) and period instruments.')}</span>
        <div className="stack" style={{ marginTop: 8 }}>
          {list.map((p, k) => (
            <div key={k} className="editrow">
              <div className="editrow__fields editrow__fields--3">
                <InstrumentSelect value={p.instrumentId} onChange={(instrumentId) => setAt(k, { instrumentId })} />
                {k === 0 ? (
                  <span className="tag tag--accent" style={{ alignSelf: 'center', justifySelf: 'start' }}>{t('Main')}</span>
                ) : (
                  <select className="select" value={p.level} onChange={(e) => setAt(k, { level: e.target.value as InstrumentLevel })} aria-label={t('How you play it')}>
                    <option value="secondary">{t('Second instrument')}</option>
                    <option value="doubling">{t('Doubling')}</option>
                    <option value="period">{t('Period instrument')}</option>
                  </select>
                )}
                <input className="input" value={p.note ?? ''} placeholder={t('Instrument details (maker, system, pitch…)')} onChange={(e) => setAt(k, { note: e.target.value || undefined })} />
              </div>
              <button type="button" className="btn btn--quiet btn--icon btn--sm" disabled={list.length === 1} onClick={() => s.set({ instruments: list.filter((_x, j) => j !== k).map((x, j) => (j === 0 ? { ...x, level: 'primary' as const } : x)) })} aria-label={t('Remove')}>
                <Trash2 size={15} aria-hidden />
              </button>
            </div>
          ))}
          <div>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => s.set({ instruments: [...list, { instrumentId: 'piano', level: 'secondary' }] })}>
              <Plus size={14} aria-hidden /> {t('Add an instrument')}
            </button>
          </div>
        </div>
      </div>
      {voice && (
        <Field label={t('Voice description')} hint={t('Fach or the repertoire your voice suits, e.g. “Lyric mezzo — Bach, Handel, Rossini”.')}>
          <input className="input" value={d.voiceDescription ?? ''} onChange={(e) => s.set({ voiceDescription: e.target.value || undefined })} />
        </Field>
      )}
      <div className="field">
        <span className="field__label">{t('I work as')}</span>
        <div className="row row--wrap" style={{ gap: 6 }}>
          {ROLES.map((r) => {
            const on = d.roles?.includes(r.id) ?? false;
            return (
              <button key={r.id} type="button" className={`chip${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => s.set({ roles: on ? d.roles!.filter((x) => x !== r.id) : [...(d.roles ?? []), r.id] })}>
                {t(r.label)}
              </button>
            );
          })}
        </div>
      </div>
      {!voice && (
        <div className="field">
          <span className="field__label">{t('Pitch standards I play at')}</span>
          <div className="row row--wrap" style={{ gap: 6 }}>
            {PITCHES.map((p) => {
              const on = d.pitches?.includes(p) ?? false;
              return (
                <button key={p} type="button" className={`chip num${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => s.set({ pitches: (on ? d.pitches!.filter((x) => x !== p) : [...(d.pitches ?? []), p]).sort((a, b) => a - b) })}>
                  A={p}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <SaveBar dirty={s.dirty} pending={s.pending} onSave={s.save} error={error} />
    </div>
  );
}

function WorkFields({ value, onChange }: { value: { composer: string; work: string }; onChange: (v: { composer: string; work: string; genre?: Genre }) => void }) {
  return (
    <>
      <Combobox
        value={value.composer}
        onChange={(composer) => onChange({ ...value, composer })}
        placeholder={t('Composer')}
        ariaLabel={t('Composer')}
        options={(x) => suggestRepertoire(x).filter((o) => !o.work).map((o) => ({ key: o.label, label: o.label, value: o }))}
        onPick={(o) => onChange({ ...value, composer: o.value.composer })}
        onEnterFreeText={() => {}}
      />
      <Combobox
        value={value.work}
        onChange={(work) => onChange({ ...value, work })}
        placeholder={t('Work')}
        ariaLabel={t('Work')}
        options={(x) => suggestRepertoire(`${value.composer} ${x}`.trim(), 10).filter((o) => o.work).map((o) => ({ key: o.label, label: o.work!, hint: o.composer, value: o }))}
        onPick={(o) => onChange({ composer: o.value.composer, work: o.value.work! })}
        onEnterFreeText={() => {}}
      />
    </>
  );
}

function RepertoireTab({ m }: { m: Musician }) {
  const s = useSection(m, (x) => ({ repertoire: x.repertoire }));
  const list = s.draft.repertoire ?? [];
  const [filter, setFilter] = useState('');
  const incomplete = list.some((r) => !r.composer.trim() || !r.work.trim());
  const shown = list.filter((r) => !filter.trim() || `${r.composer} ${r.work}`.toLowerCase().includes(filter.toLowerCase()) || !r.composer);
  const update = (id: string, patch: Partial<RepertoireItem>) => s.set({ repertoire: list.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  return (
    <div className="stack stack--lg">
      <p className="soft">{t('“Has already played this piece” is what gets musicians hired. Each work is searchable, and is ticked automatically against the programme of every opportunity you look at.')}</p>
      <div className="row row--wrap row--between">
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={() => {
            setFilter('');
            s.set({ repertoire: [{ id: uid('rep'), composer: '', work: '', genre: 'chamber', status: 'ready', lastPerformed: YEAR }, ...list] });
          }}
        >
          <Plus size={14} aria-hidden /> {t('Add a work')}
        </button>
        <input className="input input--sm" style={{ maxWidth: 240 }} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t('Filter {n} works…', { n: list.length })} aria-label={t('Filter repertoire')} />
      </div>
      <div className="stack">
        {shown.map((r) => (
          <div key={r.id} className="editrow">
            <div className="editrow__fields editrow__fields--rep">
              <WorkFields value={r} onChange={(v) => update(r.id, v)} />
              <input className="input" value={r.part ?? ''} placeholder={t('Part or role (optional)')} aria-label={t('Part or role')} onChange={(e) => update(r.id, { part: e.target.value || undefined })} />
              <select className="select" value={r.status} aria-label={t('Status')} onChange={(e) => update(r.id, { status: e.target.value as RepertoireStatus })}>
                <option value="ready">{t('Performance-ready')}</option>
                <option value="performed">{t('Performed before')}</option>
                <option value="learning">{t('In preparation')}</option>
              </select>
              <select className="select" value={r.genre} aria-label={t('Kind of work')} onChange={(e) => update(r.id, { genre: e.target.value as Genre })}>
                {(['solo', 'concerto', 'chamber', 'orchestral', 'opera', 'sacred', 'song', 'contemporary'] as Genre[]).map((g) => (
                  <option key={g} value={g}>{t(g.charAt(0).toUpperCase() + g.slice(1))}</option>
                ))}
              </select>
              <input className="input num" type="number" min={1960} max={YEAR} value={r.lastPerformed ?? ''} placeholder={t('Year')} aria-label={t('Last performed (year)')} onChange={(e) => update(r.id, { lastPerformed: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
            <button type="button" className="btn btn--quiet btn--icon btn--sm" onClick={() => s.set({ repertoire: list.filter((x) => x.id !== r.id) })} aria-label={t('Remove {work}', { work: r.work || t('this work') })}>
              <Trash2 size={15} aria-hidden />
            </button>
          </div>
        ))}
        {shown.length === 0 && <p className="muted small">{list.length ? t('No work matches that filter.') : t('No works yet. Add the first one.')}</p>}
      </div>
      <SaveBar dirty={s.dirty} pending={s.pending} onSave={s.save} error={incomplete ? t('Every work needs a composer and a title.') : undefined} />
    </div>
  );
}

function ConcertsTab({ m }: { m: Musician }) {
  const viewer = useViewer();
  const profile = useApiQuery(['profile', m.slug, viewer.id], () => api.getProfile(m.slug, viewer.id));
  const blank = { date: today(), venue: '', city: m.base.name, ensembleName: '', role: '', programme: [{ composer: '', work: '' }] as ProgrammeItem[] };
  const [form, setForm] = useState(blank);
  const [open, setOpen] = useState(false);
  const add = useApiMutation(
    () =>
      api.addConcert(
        { date: form.date, venue: form.venue, city: form.city, country: m.base.country, ensembleName: form.ensembleName, programme: form.programme.filter((p) => p.composer.trim() && p.work.trim()), participants: [{ musicianId: m.id, role: form.role.trim() || t('Performer') }] },
        m.id,
      ),
    {
      success: t('Concert added to your history.'),
      onDone: () => {
        setForm(blank);
        setOpen(false);
      },
    },
  );
  const remove = useApiMutation((id: string) => api.deleteConcert(id, m.id), { success: t('Concert removed.') });
  const valid = form.venue.trim() && form.city.trim() && form.programme.some((p) => p.composer.trim() && p.work.trim());
  return (
    <div className="stack stack--lg">
      <p className="soft">{t('Concerts are shared: when an ensemble adds a concert with you in it, it appears here, and colleagues from the same concert can endorse you. Add your own dates as well.')}</p>
      {!open ? (
        <div>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setOpen(true)}><Plus size={14} aria-hidden /> {t('Add a concert')}</button>
        </div>
      ) : (
        <div className="card card--pad stack">
          <div className="form-grid">
            <Field label={t('Date')}><input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label={t('Your role')} hint={t('e.g. Soloist, Violin II, Continuo, Evangelist')}><input className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></Field>
            <Field label={t('Venue')}><input className="input" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} /></Field>
            <Field label={t('City')}><input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
            <Field label={t('Ensemble or series (optional)')} className="span-2"><input className="input" value={form.ensembleName} onChange={(e) => setForm({ ...form, ensembleName: e.target.value })} /></Field>
          </div>
          <div className="field">
            <span className="field__label">{t('Programme')}</span>
            {form.programme.map((p, k) => (
              <div key={k} className="editrow">
                <div className="editrow__fields editrow__fields--2">
                  <WorkFields value={p} onChange={(v) => setForm({ ...form, programme: form.programme.map((x, j) => (j === k ? { composer: v.composer, work: v.work } : x)) })} />
                </div>
                <button type="button" className="btn btn--quiet btn--icon btn--sm" disabled={form.programme.length === 1} onClick={() => setForm({ ...form, programme: form.programme.filter((_x, j) => j !== k) })} aria-label={t('Remove')}><Trash2 size={15} aria-hidden /></button>
              </div>
            ))}
            <div><button type="button" className="btn btn--ghost btn--sm" onClick={() => setForm({ ...form, programme: [...form.programme, { composer: '', work: '' }] })}><Plus size={14} aria-hidden /> {t('Add a work')}</button></div>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn--ghost" onClick={() => setOpen(false)}>{t('Cancel')}</button>
            <button type="button" className="btn btn--primary" disabled={!valid || add.isPending} onClick={() => add.mutate(undefined)}>{t('Add to my history')}</button>
          </div>
        </div>
      )}
      <Async query={profile} compact>
        {(p) =>
          p.concerts.length === 0 ? (
            <EmptyState compact title={t('No concerts yet')} />
          ) : (
            <ul className="card rows">
              {p.concerts.slice(0, 40).map((c) => (
                <li key={c.id} className="rows__item">
                  <span className="num small muted" style={{ width: 92, flex: 'none' }}>{fmt.date(c.date)}</span>
                  <span className="grow small">
                    <b>{c.programme.map((x) => x.composer).filter((x, k, a) => a.indexOf(x) === k).join(', ')}</b> — {c.venue}, {c.city}
                    <span className="muted"> · {c.ensembleName ?? t('Recital')} · {c.participants.find((x) => x.musicianId === m.id)?.role}</span>
                  </span>
                  {c.createdBy === m.id ? (
                    <button type="button" className="btn btn--quiet btn--icon btn--sm" disabled={remove.isPending} onClick={() => window.confirm(t('Remove this concert from your history?')) && remove.mutate(c.id)} aria-label={t('Remove concert')}><Trash2 size={15} aria-hidden /></button>
                  ) : (
                    <span className="tiny muted nowrap">{t('added by the ensemble')}</span>
                  )}
                </li>
              ))}
            </ul>
          )
        }
      </Async>
    </div>
  );
}

function Training({ m }: { m: Musician }) {
  const s = useSection(m, (x) => ({ training: x.training, masterclasses: x.masterclasses, awards: x.awards }));
  const d = s.draft;
  const error = d.training?.some((x) => !x.institution.trim()) || d.awards?.some((x) => !x.competition.trim()) || d.masterclasses?.some((x) => !x.teacher.trim()) ? t('Fill in or remove the empty rows.') : undefined;
  return (
    <div className="stack stack--lg">
      <div className="field">
        <span className="field__label">{t('Conservatories and studies')}</span>
        <Rows
          items={d.training ?? []}
          onChange={(training) => s.set({ training })}
          addLabel={t('Add studies')}
          empty={t('No studies listed.')}
          add={() => ({ id: uid('tr'), institution: '', qualification: '', teacher: '', from: YEAR - 4, to: YEAR - 1 })}
          render={(x, up) => (
            <div className="editrow__fields editrow__fields--train">
              <input className="input" value={x.institution} placeholder={t('Institution')} aria-label={t('Institution')} onChange={(e) => up({ institution: e.target.value })} />
              <input className="input" value={x.qualification} placeholder={t('Qualification')} aria-label={t('Qualification')} onChange={(e) => up({ qualification: e.target.value })} />
              <input className="input" value={x.teacher ?? ''} placeholder={t('Teacher')} aria-label={t('Teacher')} onChange={(e) => up({ teacher: e.target.value || undefined })} />
              <input className="input num" type="number" value={x.from} aria-label={t('From (year)')} onChange={(e) => up({ from: Number(e.target.value) })} />
              <input className="input num" type="number" value={x.to} aria-label={t('To (year)')} onChange={(e) => up({ to: Number(e.target.value) })} />
            </div>
          )}
        />
      </div>
      <div className="field">
        <span className="field__label">{t('Masterclasses')}</span>
        <Rows
          items={d.masterclasses ?? []}
          onChange={(masterclasses) => s.set({ masterclasses })}
          addLabel={t('Add a masterclass')}
          empty={t('No masterclasses listed.')}
          add={() => ({ id: uid('mc'), teacher: '', place: '', year: YEAR - 1 })}
          render={(x, up) => (
            <div className="editrow__fields editrow__fields--3">
              <input className="input" value={x.teacher} placeholder={t('With')} aria-label={t('Teacher')} onChange={(e) => up({ teacher: e.target.value })} />
              <input className="input" value={x.place} placeholder={t('Where')} aria-label={t('Place')} onChange={(e) => up({ place: e.target.value })} />
              <input className="input num" type="number" value={x.year} aria-label={t('Year')} onChange={(e) => up({ year: Number(e.target.value) })} />
            </div>
          )}
        />
      </div>
      <div className="field">
        <span className="field__label">{t('Competitions and awards')}</span>
        <Rows
          items={d.awards ?? []}
          onChange={(awards) => s.set({ awards })}
          addLabel={t('Add an award')}
          empty={t('No awards listed.')}
          add={() => ({ id: uid('aw'), competition: '', result: '', year: YEAR - 1 })}
          render={(x, up) => (
            <div className="editrow__fields editrow__fields--3">
              <input className="input" value={x.competition} placeholder={t('Competition or prize')} aria-label={t('Competition')} onChange={(e) => up({ competition: e.target.value })} />
              <input className="input" value={x.result} placeholder={t('Result')} aria-label={t('Result')} onChange={(e) => up({ result: e.target.value })} />
              <input className="input num" type="number" value={x.year} aria-label={t('Year')} onChange={(e) => up({ year: Number(e.target.value) })} />
            </div>
          )}
        />
      </div>
      <SaveBar dirty={s.dirty} pending={s.pending} onSave={s.save} error={error} />
    </div>
  );
}

function RecordingsTab({ m }: { m: Musician }) {
  const s = useSection(m, (x) => ({ recordings: x.recordings }));
  const list = s.draft.recordings ?? [];
  const bad = list.some((r) => !r.title.trim() || (r.url && !/^https?:\/\/\S+\.\S+/.test(r.url)));
  return (
    <div className="stack stack--lg">
      <p className="soft">{t('Link to audio or video hosted elsewhere (YouTube, Vimeo, SoundCloud, your own site). Hirers listen before they call.')}</p>
      <Rows
        items={list}
        onChange={(recordings) => s.set({ recordings })}
        addLabel={t('Add a recording')}
        empty={t('No recordings yet.')}
        add={() => ({ id: uid('rec'), title: '', kind: 'video' as const, year: YEAR, durationSec: 0, url: '' })}
        render={(x, up) => (
          <div className="editrow__fields editrow__fields--rec">
            <input className="input" value={x.title} placeholder={t('Title — composer: work')} aria-label={t('Title')} onChange={(e) => up({ title: e.target.value })} />
            <input className="input" type="url" value={x.url ?? ''} placeholder="https://…" aria-label={t('Link')} aria-invalid={!!x.url && !/^https?:\/\/\S+\.\S+/.test(x.url)} onChange={(e) => up({ url: e.target.value || undefined })} />
            <select className="select" value={x.kind} aria-label={t('Kind')} onChange={(e) => up({ kind: e.target.value as 'audio' | 'video' })}>
              <option value="video">{t('Video')}</option>
              <option value="audio">{t('Audio')}</option>
            </select>
            <input className="input num" type="number" value={x.year} aria-label={t('Year')} onChange={(e) => up({ year: Number(e.target.value) })} />
            <input className="input" value={x.note ?? ''} placeholder={t('Note (live at…, with…)')} aria-label={t('Note')} onChange={(e) => up({ note: e.target.value || undefined })} />
          </div>
        )}
      />
      <SaveBar dirty={s.dirty} pending={s.pending} onSave={s.save} error={bad ? t('Each recording needs a title; links must start with http:// or https://.') : undefined} />
    </div>
  );
}

function Practical({ m }: { m: Musician }) {
  const s = useSection(m, (x) => ({ fee: x.fee, teachingRate: x.teachingRate, travelRadiusKm: x.travelRadiusKm, travelsInternationally: x.travelsInternationally, practical: x.practical }));
  const d = s.draft;
  const fee = d.fee ?? { min: 0, max: 0 };
  const p = d.practical!;
  const error = !(fee.min > 0) || fee.max < fee.min ? t('Give a fee range: the higher figure cannot be below the lower one.') : undefined;
  return (
    <div className="stack stack--lg">
      <div className="field">
        <span className="field__label">{t('Indicative fee per engagement')}</span>
        <span className="field__hint">{t('Rehearsals and concert, before travel. Hirers who search with a budget see you when it reaches your lower figure.')}</span>
        <div className="row" style={{ maxWidth: 340, marginTop: 6 }}>
          <div className="affix grow"><span>€</span><input className="input num" type="number" min={0} step={10} value={fee.min || ''} aria-label={t('From')} onChange={(e) => s.set({ fee: { ...fee, min: Number(e.target.value) } })} /></div>
          <span className="muted">–</span>
          <div className="affix grow"><span>€</span><input className="input num" type="number" min={0} step={10} value={fee.max || ''} aria-label={t('To')} aria-invalid={fee.max < fee.min} onChange={(e) => s.set({ fee: { ...fee, max: Number(e.target.value) } })} /></div>
        </div>
      </div>
      <Field label={t('Teaching rate per hour (optional)')}>
        <div className="affix" style={{ maxWidth: 160 }}><span>€</span><input className="input num" type="number" min={0} value={d.teachingRate ?? ''} onChange={(e) => s.set({ teachingRate: e.target.value ? Number(e.target.value) : undefined })} /></div>
      </Field>
      <Field label={t('Travel radius: {km}', { km: fmt.km(d.travelRadiusKm ?? 0) })} hint={t('How far from {city} you normally travel for an engagement.', { city: m.base.name })}>
        <input type="range" min={10} max={600} step={10} value={d.travelRadiusKm} onChange={(e) => s.set({ travelRadiusKm: Number(e.target.value) })} className="range" />
      </Field>
      <div className="field">
        <label className="check"><input type="checkbox" checked={!!d.travelsInternationally} onChange={(e) => s.set({ travelsInternationally: e.target.checked })} />{t('I travel further, including abroad, when travel is covered')}</label>
        <label className="check"><input type="checkbox" checked={p.ownTransport} onChange={(e) => s.set({ practical: { ...p, ownTransport: e.target.checked } })} />{t('I have my own transport')}</label>
        <label className="check"><input type="checkbox" checked={p.canInvoice} onChange={(e) => s.set({ practical: { ...p, canInvoice: e.target.checked } })} />{t('I can invoice (VAT-registered)')}</label>
        <label className="check"><input type="checkbox" checked={p.urgentCalls} onChange={(e) => s.set({ practical: { ...p, urgentCalls: e.target.checked, noticeHours: e.target.checked ? (p.noticeHours ?? 12) : undefined } })} />{t('I take last-minute substitution calls')}</label>
      </div>
      {p.urgentCalls && (
        <Field label={t('Shortest notice I can usually manage')}>
          <select className="select" style={{ maxWidth: 220 }} value={p.noticeHours ?? 12} onChange={(e) => s.set({ practical: { ...p, noticeHours: Number(e.target.value) } })}>
            {[3, 6, 12, 24, 48].map((h) => <option key={h} value={h}>{t('{n} hours', { n: h })}</option>)}
          </select>
        </Field>
      )}
      <SaveBar dirty={s.dirty} pending={s.pending} onSave={s.save} error={error} />
    </div>
  );
}

export function ProfileEdit() {
  const viewer = useViewer();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find(([id]) => id === params.get('tab'))?.[0] ?? 'basics') as TabId;
  const m = viewer.musician;
  if (viewer.account && !m) {
    return (
      <div className="wrap wrap--narrow page">
        <EmptyState title={t('This account has no musician profile')} text={t('{name} uses Leggio to hire. Switch to one of the musician personas to edit a profile.', { name: viewer.account.name })} action={<Link to="/demo" className="btn btn--primary btn--sm">{t('Choose a persona')}</Link>} />
      </div>
    );
  }
  return (
    <div className="wrap page" style={{ maxWidth: 980 }}>
      <Link to={m ? `/musicians/${m.slug}` : '/home'} className="btn btn--quiet btn--sm" style={{ marginLeft: -10, marginBottom: 8 }}>
        <ArrowLeft size={15} aria-hidden /> {t('Back to my profile')}
      </Link>
      <div className="page__head">
        <div>
          <div className="label">{t('Edit profile')}</div>
          <h1 className="h-page">{m?.name ?? '…'}</h1>
        </div>
      </div>
      <div className="tabs" role="tablist" style={{ marginBottom: 28 }}>
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className="tab" onClick={() => setParams({ tab: id }, { replace: true })}>
            {t(label)}
          </button>
        ))}
      </div>
      {m && (
        <div key={`${tab}:${m.updatedAt}`} role="tabpanel">
          {tab === 'basics' && <Basics m={m} />}
          {tab === 'instruments' && <Instruments m={m} />}
          {tab === 'repertoire' && <RepertoireTab m={m} />}
          {tab === 'concerts' && <ConcertsTab m={m} />}
          {tab === 'training' && <Training m={m} />}
          {tab === 'recordings' && <RecordingsTab m={m} />}
          {tab === 'practical' && <Practical m={m} />}
        </div>
      )}
    </div>
  );
}
