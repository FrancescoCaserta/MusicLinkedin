import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, Plus, Trash2, Zap } from 'lucide-react';
import { useViewer } from '../../app/session';
import type { OpportunityInput } from '../../data/api';
import { api } from '../../data/client';
import { useApiMutation, useApiQuery } from '../../data/hooks';
import { suggestRepertoire } from '../../domain/catalogue';
import { cityById, placeOf, type City } from '../../domain/cities';
import { today } from '../../domain/dates';
import { EMPTY_QUERY } from '../../domain/search/query';
import { instrument, instrumentName, PITCHES } from '../../domain/taxonomy';
import type { FeeUnit, OpportunityDate, OpportunityDateKind, OpportunityType, ProgrammeItem, TravelCover } from '../../domain/types';
import { fmt, plural, t } from '../../i18n';
import { Avatar, Field } from '../../ui/basics';
import { dotDate, eventTitle } from '../events/Events';
import { CityPicker, Combobox, InstrumentPicker } from '../../ui/pickers';

const TYPES: [OpportunityType, string, string][] = [
  ['engagement', 'Engagement', 'A concert, a project, a run of performances'],
  ['substitution', 'Substitution', 'Someone has dropped out and must be replaced'],
  ['audition', 'Audition', 'A post or a list filled by audition'],
  ['position', 'Permanent position', 'A contract or post, with or without audition'],
  ['teaching', 'Teaching', 'Lessons, coaching, courses'],
];
const UNITS: [FeeUnit, string][] = [
  ['total', 'in total'],
  ['per-concert', 'per concert'],
  ['per-service', 'per service'],
  ['per-hour', 'per hour'],
  ['per-month', 'per month'],
  ['per-year', 'per year'],
];
const KINDS: [OpportunityDateKind, string][] = [
  ['rehearsal', 'Rehearsal'],
  ['dress', 'Dress rehearsal'],
  ['performance', 'Performance'],
  ['audition', 'Audition'],
  ['start', 'Start date'],
];

function parsePrefill(p: URLSearchParams) {
  const instruments = (p.get('i') ?? '').split(',').filter((x) => instrument(x));
  const city = p.get('city') ? cityById(p.get('city')!) : undefined;
  const date = p.get('d') ?? '';
  const fee = Number(p.get('fee')) || 0;
  const rep = p.get('rep') ?? '';
  const match = rep ? suggestRepertoire(rep, 6).find((s) => s.work) : undefined;
  const repertoire: ProgrammeItem[] = match ? [{ composer: match.composer, work: match.work! }] : rep ? [{ composer: rep, work: '' }] : [];
  return { instruments, city, date, fee, repertoire };
}

export function ProgrammeEditor({ value, onChange }: { value: ProgrammeItem[]; onChange: (v: ProgrammeItem[]) => void }) {
  const setAt = (k: number, item: ProgrammeItem) => onChange(value.map((x, j) => (j === k ? item : x)));
  return (
    <div className="stack">
      {value.map((p, k) => (
        <div key={k} className="editrow">
          <div className="editrow__fields editrow__fields--2">
            <Combobox value={p.composer} onChange={(composer) => setAt(k, { ...p, composer })} placeholder={t('Composer')} ariaLabel={t('Composer')} options={(x) => suggestRepertoire(x).filter((o) => !o.work).map((o) => ({ key: o.label, label: o.label, value: o }))} onPick={(o) => setAt(k, { ...p, composer: o.value.composer })} onEnterFreeText={() => {}} />
            <Combobox value={p.work} onChange={(work) => setAt(k, { ...p, work })} placeholder={t('Work')} ariaLabel={t('Work')} options={(x) => suggestRepertoire(`${p.composer} ${x}`.trim(), 10).filter((o) => o.work).map((o) => ({ key: o.label, label: o.work!, hint: o.composer, value: o }))} onPick={(o) => setAt(k, { composer: o.value.composer, work: o.value.work! })} onEnterFreeText={() => {}} />
          </div>
          <button type="button" className="btn btn--quiet btn--icon btn--sm" onClick={() => onChange(value.filter((_x, j) => j !== k))} aria-label={t('Remove')}><Trash2 size={15} aria-hidden /></button>
        </div>
      ))}
      <div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange([...value, { composer: '', work: '' }])}><Plus size={14} aria-hidden /> {t('Add a work')}</button>
      </div>
    </div>
  );
}

export function PostPage() {
  const viewer = useViewer();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const pre = useMemo(() => parsePrefill(params), [params]);
  const [type, setType] = useState<OpportunityType>('engagement');
  const [orgId, setOrgId] = useState<string>('');
  const [title, setTitle] = useState(pre.instruments.length ? `${instrumentName(pre.instruments[0])}${pre.repertoire[0]?.work ? ` — ${pre.repertoire[0].composer}: ${pre.repertoire[0].work}` : ''}` : '');
  const [instruments, setInstruments] = useState<string[]>(pre.instruments);
  const [roleLabel, setRoleLabel] = useState('');
  const [city, setCity] = useState<City | undefined>(pre.city);
  const [venue, setVenue] = useState('');
  const [dates, setDates] = useState<OpportunityDate[]>([{ date: pre.date, time: '', kind: 'performance' }]);
  const [amount, setAmount] = useState(pre.fee ? String(pre.fee) : '');
  const [max, setMax] = useState('');
  const [unit, setUnit] = useState<FeeUnit>('total');
  const [feeNote, setFeeNote] = useState('');
  const [travel, setTravel] = useState<TravelCover>('none');
  const [travelNote, setTravelNote] = useState('');
  const [repertoire, setRepertoire] = useState<ProgrammeItem[]>(pre.repertoire);
  const [dressCode, setDressCode] = useState('');
  const [pitch, setPitch] = useState('');
  const [deadline, setDeadline] = useState('');
  const [description, setDescription] = useState('');
  const [tried, setTried] = useState(false);
  const myEvents = useApiQuery(['my-events', viewer.id], () => api.listMyEvents(viewer.id));
  const [modeChoice, setMode] = useState<'event' | 'self' | null>(params.get('event') ? 'event' : null);
  const [eventChoice, setEventId] = useState(params.get('event') ?? '');
  const [seatId, setSeatId] = useState(params.get('seat') ?? '');
  const events = myEvents.data ?? [];
  const mode = modeChoice ?? (events.length ? 'event' : 'self');
  const linked = mode === 'event' ? events.find((e) => e.id === (eventChoice || events[0]?.id)) : undefined;
  const freeSeats = linked?.openSeats?.filter((x) => !x.opportunityId) ?? [];

  const org = orgId || (viewer.organisations.length === 1 && orgId !== 'self' ? viewer.organisations[0].id : '');
  const errors = {
    title: !title.trim() ? t('Give it a title musicians will recognise.') : '',
    fee: !(Number(amount) > 0) ? t('State the fee. No posting goes live on Leggio without one.') : max && Number(max) < Number(amount) ? t('The upper figure must be higher than the lower one.') : '',
    event: mode === 'event' && !linked ? t('Choose the event, or switch to “Write it yourself”.') : '',
    city: !linked && !city ? t('Choose the city where it takes place.') : '',
    dates: linked ? '' : !dates.some((d) => d.date) ? t('Add at least one date.') : dates.some((d) => d.date && d.date < today()) ? t('Dates cannot be in the past.') : '',
    description: description.trim().length < 20 ? t('Describe the engagement in a sentence or two.') : '',
  };
  const invalid = Object.values(errors).some(Boolean);
  const show = (k: keyof typeof errors) => (tried ? errors[k] || undefined : undefined);

  const create = useApiMutation(
    () => {
      const input: OpportunityInput = {
        type,
        title,
        orgId: org && org !== 'self' ? org : undefined,
        instruments,
        roleLabel: roleLabel.trim() || undefined,
        // When linked, schedule, place and programme are taken from the event by the server.
        place: linked ? { name: linked.city, country: linked.country, lat: 0, lng: 0, venue: linked.venue } : placeOf(city!, venue.trim() || undefined),
        dates: linked
          ? (linked.sessions ?? [{ date: linked.date, time: linked.time, kind: 'performance' as const }]).map((d) => ({ date: d.date, time: d.time, kind: d.kind }))
          : dates.filter((d) => d.date).map((d) => ({ ...d, time: d.time || undefined, note: d.note?.trim() || undefined })),
        fee: { amount: Number(amount), max: max ? Number(max) : undefined, unit, note: feeNote.trim() || undefined },
        travel,
        travelNote: travelNote.trim() || undefined,
        dressCode: dressCode.trim() || undefined,
        pitch: pitch ? Number(pitch) : undefined,
        repertoire: repertoire.filter((p) => p.composer.trim() && p.work.trim()),
        description: description.trim(),
        deadline: deadline || undefined,
        urgent: false,
        eventId: linked?.id,
        seatId: linked && seatId ? seatId : undefined,
      };
      if (linked) input.repertoire = linked.programme;
      return api.createOpportunity(input, viewer.id);
    },
    { success: t('Published. Now invite the musicians who fit.'), onDone: (o) => navigate(`/hiring/${o.id}`) },
  );

  const setDate = (k: number, patch: Partial<OpportunityDate>) => setDates(dates.map((d, j) => (j === k ? { ...d, ...patch } : d)));

  return (
    <div className="wrap page" style={{ maxWidth: 860 }}>
      <Link to="/hiring" className="btn btn--quiet btn--sm" style={{ marginLeft: -10, marginBottom: 8 }}><ArrowLeft size={15} aria-hidden /> {t('My postings')}</Link>
      <div className="page__head">
        <div>
          <div className="label">{t('Post an opportunity')}</div>
          <h1 className="h-page">{t('Say what musicians ask first')}</h1>
          <p className="page__sub">{t('The fee, the dates, the repertoire, what is covered, what to wear. A clear posting gets better applicants and fewer questions.')}</p>
        </div>
      </div>
      <div className="postnote card">
        <Zap size={18} aria-hidden />
        <span className="grow">{t('Is it for today or the next few days? The urgent flow takes one minute and calls the players who are free.')}</span>
        <Link to={`/opportunities/urgent?${params.toString()}`} className="btn btn--urgent btn--sm">{t('Find a substitute')}</Link>
      </div>

      <form
        className="postform"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setTried(true);
          if (invalid) {
            window.setTimeout(() => document.querySelector('.field__error')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30);
            return;
          }
          create.mutate(undefined);
        }}
      >
        <section className="postform__section">
          <div className="segmented" role="tablist" aria-label={t('Details from')}>
            <button type="button" role="tab" aria-selected={mode === 'event'} onClick={() => setMode('event')}>{t('Link to an event')}</button>
            <button type="button" role="tab" aria-selected={mode === 'self'} onClick={() => setMode('self')}>{t('Write it yourself')}</button>
          </div>
          {mode === 'event' && (
            events.length === 0 ? (
              <p className="small muted">
                {myEvents.isLoading ? t('Loading your events…') : t('You have no upcoming events.')}{' '}
                <Link className="link" to="/events/new">{t('Create an event')}</Link>
              </p>
            ) : (
              <>
                <Field label={t('Event')} error={show('event')}>
                  <select className="select" value={linked?.id ?? ''} onChange={(e) => { setEventId(e.target.value); setSeatId(''); }}>
                    {events.map((e) => <option key={e.id} value={e.id}>{dotDate(e.date)} · {eventTitle(e)} · {e.venue}, {e.city}</option>)}
                  </select>
                </Field>
                {linked && (
                  <div className="event__panel">
                    <p className="label">{t('Filled in from the event')}</p>
                    <dl className="event__facts">
                      <div><dt>{t('Schedule')}</dt><dd>{(linked.sessions ?? [{ date: linked.date, time: linked.time, kind: 'performance' as const }]).map((d) => `${dotDate(d.date)} ${d.kind === 'rehearsal' ? t('rehearsal') : t('concert')}${d.time ? ` ${d.time}` : ''}`).join(' · ')}</dd></div>
                      <div><dt>{t('Place')}</dt><dd>{linked.venue}, {linked.city}</dd></div>
                      <div><dt>{t('Programme')}</dt><dd>{linked.programme.map((p) => `${p.composer}, ${p.work}`).join(' · ') || '—'}</dd></div>
                    </dl>
                    <p className="tiny muted" style={{ marginTop: 10 }}>{t('Whoever you hire is added to the event’s lineup once they confirm.')}</p>
                  </div>
                )}
                {freeSeats.length > 0 && (
                  <Field label={t('Open seat')}>
                    <select className="select" value={seatId} onChange={(e) => { setSeatId(e.target.value); const r = freeSeats.find((x) => x.id === e.target.value)?.role; if (r) setRoleLabel(r); }}>
                      <option value="">{t('A new seat')}</option>
                      {freeSeats.map((x) => <option key={x.id} value={x.id}>{x.role}</option>)}
                    </select>
                  </Field>
                )}
              </>
            )
          )}
        </section>

        <section className="postform__section">
          <h2 className="h-section"><span className="postform__no">I</span>{t('What')}</h2>
          <div className="typegrid" role="radiogroup" aria-label={t('Type')}>
            {TYPES.map(([id, label, hint]) => (
              <label key={id} className={`pick${type === id ? ' is-on' : ''}`}>
                <span className="check"><input type="radio" name="type" checked={type === id} onChange={() => setType(id)} /></span>
                <span><b style={{ display: 'block' }}>{t(label)}</b><span className="tiny muted">{t(hint)}</span></span>
              </label>
            ))}
          </div>
          {viewer.organisations.length > 0 && (
            <Field label={t('Post as')}>
              <select className="select" value={org || 'self'} onChange={(e) => setOrgId(e.target.value)}>
                {viewer.organisations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                <option value="self">{t('Myself — {name}', { name: viewer.account?.name ?? '' })}</option>
              </select>
            </Field>
          )}
          <Field label={t('Title')} error={show('title')} hint={t('e.g. “Viola da gamba — Johannes-Passion”, “Extras for Mahler 1: horns 5–7”')}>
            <input className="input" value={title} maxLength={120} aria-invalid={!!show('title')} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <div className="form-grid">
            <Field label={t('Instrument or voice sought')} hint={t('Add several if any of them will do. Leave empty for conductors or open calls.')}>
              <InstrumentPicker value={instruments} onChange={setInstruments} />
            </Field>
            <Field label={t('Role (optional)')} hint={t('e.g. Principal, Continuo, Soloist, Violin II second desk')}>
              <input className="input" value={roleLabel} onChange={(e) => setRoleLabel(e.target.value)} />
            </Field>
          </div>
        </section>

        <section className="postform__section">
          <h2 className="h-section"><span className="postform__no">II</span>{t('The fee')}</h2>
          <div className="feegrid">
            <Field label={t('Amount')} error={show('fee')} hint={linked ? t('Shown to applicants only, never on the public event') : undefined}>
              <div className="affix"><span>€</span><input className="input num" type="number" min={0} inputMode="numeric" value={amount} aria-invalid={!!show('fee')} onChange={(e) => setAmount(e.target.value)} /></div>
            </Field>
            <Field label={t('Up to (optional)')}>
              <div className="affix"><span>€</span><input className="input num" type="number" min={0} inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} /></div>
            </Field>
            <Field label={t('Paid')}>
              <select className="select" value={unit} onChange={(e) => setUnit(e.target.value as FeeUnit)}>{UNITS.map(([id, label]) => <option key={id} value={id}>{t(label)}</option>)}</select>
            </Field>
          </div>
          <Field label={t('What the fee covers (optional)')} hint={t('e.g. “two rehearsals and concert”, “gross, six services”')}>
            <input className="input" value={feeNote} onChange={(e) => setFeeNote(e.target.value)} />
          </Field>
          <div className="form-grid">
            <Field label={t('Travel and accommodation')}>
              <select className="select" value={travel} onChange={(e) => setTravel(e.target.value as TravelCover)}>
                <option value="none">{t('Not covered')}</option>
                <option value="travel">{t('Travel covered')}</option>
                <option value="travel-accommodation">{t('Travel and accommodation covered')}</option>
              </select>
            </Field>
            <Field label={t('Details (optional)')}>
              <input className="input" value={travelNote} placeholder={t('e.g. second-class rail, €0.30/km, hotel for two nights')} onChange={(e) => setTravelNote(e.target.value)} />
            </Field>
          </div>
        </section>

        <section className="postform__section">
          <h2 className="h-section"><span className="postform__no">III</span>{t('Where and when')}</h2>
          {!linked && (<>
          <div className="form-grid">
            <Field label={t('City')} error={show('city')}><CityPicker value={city?.name ?? ''} onPick={setCity} /></Field>
            <Field label={t('Venue (optional)')}><input className="input" value={venue} onChange={(e) => setVenue(e.target.value)} /></Field>
          </div>
          <div className="field">
            <span className="field__label">{t('Dates')}</span>
            <span className="field__hint">{t('List rehearsals as well as performances — musicians check each one against their calendar.')}</span>
            <div className="stack" style={{ marginTop: 6 }}>
              {dates.map((d, k) => (
                <div key={k} className="editrow">
                  <div className="editrow__fields editrow__fields--dates">
                    <input type="date" className="input" value={d.date} min={today()} aria-label={t('Date')} aria-invalid={!!show('dates') && !d.date} onChange={(e) => setDate(k, { date: e.target.value })} />
                    <input type="time" className="input" value={d.time ?? ''} aria-label={t('Time')} onChange={(e) => setDate(k, { time: e.target.value })} />
                    <select className="select" value={d.kind} aria-label={t('Kind')} onChange={(e) => setDate(k, { kind: e.target.value as OpportunityDateKind })}>{KINDS.map(([id, label]) => <option key={id} value={id}>{t(label)}</option>)}</select>
                    <input className="input" value={d.note ?? ''} placeholder={t('Note (optional)')} aria-label={t('Note')} onChange={(e) => setDate(k, { note: e.target.value })} />
                  </div>
                  <button type="button" className="btn btn--quiet btn--icon btn--sm" disabled={dates.length === 1} onClick={() => setDates(dates.filter((_x, j) => j !== k))} aria-label={t('Remove date')}><Trash2 size={15} aria-hidden /></button>
                </div>
              ))}
              <div><button type="button" className="btn btn--ghost btn--sm" onClick={() => setDates([...dates, { date: dates[dates.length - 1]?.date ?? '', time: '', kind: 'rehearsal' }])}><Plus size={14} aria-hidden /> {t('Add a date')}</button></div>
            </div>
            {show('dates') && <span className="field__error" role="alert">{show('dates')}</span>}
          </div>
          </>)}
          {linked && <p className="small muted">{t('Dates and place come from the event.')}</p>}
          <Field label={t('Apply by (optional)')}><input type="date" className="input" style={{ maxWidth: 220 }} min={today()} value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
        </section>

        <section className="postform__section">
          <h2 className="h-section"><span className="postform__no">IV</span>{t('The music')}</h2>
          {!linked && (
          <div className="field">
            <span className="field__label">{t('Repertoire')}</span>
            <span className="field__hint">{t('Musicians see at a glance which of these they have already played.')}</span>
            <div style={{ marginTop: 6 }}><ProgrammeEditor value={repertoire} onChange={setRepertoire} /></div>
          </div>
          )}
          <div className="form-grid">
            <Field label={t('Dress code (optional)')}><input className="input" value={dressCode} placeholder={t('e.g. all black, tails / long black')} onChange={(e) => setDressCode(e.target.value)} /></Field>
            <Field label={t('Pitch (optional)')}>
              <select className="select" value={pitch} onChange={(e) => setPitch(e.target.value)}>
                <option value="">{t('Not specified')}</option>
                {PITCHES.map((p) => <option key={p} value={p}>A={p}</option>)}
              </select>
            </Field>
          </div>
          <Field label={t('Description')} error={show('description')} hint={t('What is the project, who else is playing, what do you expect from the person you engage?')}>
            <textarea className="textarea" rows={6} value={description} aria-invalid={!!show('description')} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </section>

        <div className="savebar">
          <span className="small muted">{tried && invalid ? <span style={{ color: 'var(--urgent)', fontWeight: 600 }}>{t('Some things are missing — see above.')}</span> : t('You can close or fill the posting at any time.')}</span>
          <button type="submit" className="btn btn--accent btn--lg" disabled={create.isPending}>{create.isPending ? t('Publishing…') : t('Publish opportunity')}</button>
        </div>
      </form>
    </div>
  );
}

/** Two fields and a button: the fastest way to say "I need someone now". */
export function UrgentPage() {
  const viewer = useViewer();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const pre = useMemo(() => parsePrefill(params), [params]);
  const base = viewer.account?.base;
  const [instruments, setInstruments] = useState<string[]>(pre.instruments);
  const [cityPick, setCityPick] = useState<City | undefined>(pre.city);
  const city = cityPick ?? (base?.cityId ? cityById(base.cityId) : undefined);
  const [venue, setVenue] = useState('');
  const [date, setDate] = useState(pre.date || today());
  const [time, setTime] = useState('20:30');
  const [rehearsal, setRehearsal] = useState('');
  const [amount, setAmount] = useState(pre.fee ? String(pre.fee) : '');
  const [repertoire, setRepertoire] = useState<ProgrammeItem[]>(pre.repertoire.length ? pre.repertoire : [{ composer: '', work: '' }]);
  const [roleLabel, setRoleLabel] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);

  const ready = instruments.length > 0 && !!city && !!date;
  const preview = useApiQuery(
    ['urgent-preview', instruments, city?.id, date, amount],
    () => api.searchMusicians({ ...EMPTY_QUERY, instruments, place: { name: city!.name, lat: city!.lat, lng: city!.lng, cityId: city!.id }, radiusKm: 150, date, budget: Number(amount) > 0 ? Number(amount) : undefined, urgentOnly: true }, viewer.id),
    { enabled: ready, placeholderData: (p) => p },
  );
  const errors = {
    instruments: !instruments.length ? t('Which instrument or voice do you need?') : '',
    city: !city ? t('Where is it?') : '',
    date: !date || date < today() ? t('Choose today or a date in the future.') : '',
    fee: !(Number(amount) > 0) ? t('State the fee — even an urgent call says what it pays.') : '',
  };
  const invalid = Object.values(errors).some(Boolean);
  const show = (k: keyof typeof errors) => (tried ? errors[k] || undefined : undefined);
  const works = repertoire.filter((p) => p.composer.trim() && p.work.trim());

  const create = useApiMutation(
    () => {
      const dates: OpportunityDate[] = [];
      if (rehearsal) dates.push({ date, time: rehearsal, kind: 'rehearsal' });
      dates.push({ date, time: time || undefined, kind: 'performance' });
      return api.createOpportunity(
        {
          type: 'substitution',
          urgent: true,
          title: `${instruments.map((i) => instrumentName(i)).join(' / ')}${roleLabel.trim() ? ` (${roleLabel.trim()})` : ''} — ${works[0] ? `${works[0].composer}: ${works[0].work}` : t('substitute needed')}, ${fmt.dayMonth(date)}`,
          instruments,
          roleLabel: roleLabel.trim() || undefined,
          place: placeOf(city!, venue.trim() || undefined),
          dates,
          fee: { amount: Number(amount), unit: 'total' },
          travel: 'none',
          repertoire: works,
          description: note.trim() || t('Urgent substitution. Please answer only if you are free and can prepare in time.'),
        },
        viewer.id,
      );
    },
    { onDone: (o) => navigate(`/hiring/${o.id}`) },
  );
  const n = preview.data?.hits.length ?? 0;

  return (
    <div className="wrap page" style={{ maxWidth: 1040 }}>
      <div className="page__head">
        <div>
          <div className="label" style={{ color: 'var(--urgent)' }}><Zap size={12} aria-hidden style={{ display: 'inline', verticalAlign: '-1px' }} /> {t('Urgent substitution')}</div>
          <h1 className="h-page">{t('Who dropped out?')}</h1>
          <p className="page__sub">{t('Tell us the essentials. On the next screen you choose who to call among the players who are free that day, close enough, and take last-minute work.')}</p>
        </div>
      </div>
      <div className="cols urgent">
        <form
          className="stack stack--lg"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setTried(true);
            if (!invalid) create.mutate(undefined);
          }}
        >
          <div className="form-grid">
            <Field label={t('Instrument or voice')} error={show('instruments')}><InstrumentPicker value={instruments} onChange={setInstruments} /></Field>
            <Field label={t('Chair or role (optional)')}><input className="input" value={roleLabel} placeholder={t('e.g. Violin II, second horn, alto soloist')} onChange={(e) => setRoleLabel(e.target.value)} /></Field>
            <Field label={t('Date')} error={show('date')}><input type="date" className="input" min={today()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <div className="filters__pair">
              <Field label={t('Concert at')}><input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
              <Field label={t('Rehearsal at')}><input type="time" className="input" value={rehearsal} onChange={(e) => setRehearsal(e.target.value)} /></Field>
            </div>
            <Field label={t('City')} error={show('city')}><CityPicker value={city?.name ?? ''} onPick={setCityPick} /></Field>
            <Field label={t('Venue (optional)')}><input className="input" value={venue} onChange={(e) => setVenue(e.target.value)} /></Field>
            <Field label={t('Fee, in total')} error={show('fee')}>
              <div className="affix"><span>€</span><input className="input num" type="number" min={0} inputMode="numeric" value={amount} aria-invalid={!!show('fee')} onChange={(e) => setAmount(e.target.value)} /></div>
            </Field>
          </div>
          <div className="field">
            <span className="field__label">{t('What is on the stand')}</span>
            <ProgrammeEditor value={repertoire} onChange={setRepertoire} />
          </div>
          <Field label={t('Anything else they need to know (optional)')}>
            <textarea className="textarea" rows={3} value={note} placeholder={t('Edition, pitch, dress, where to park, who to ask for…')} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div>
            <button type="submit" className="btn btn--urgent btn--lg" disabled={create.isPending}>
              <Zap size={17} aria-hidden /> {create.isPending ? t('Preparing…') : t('Choose who to call')}
            </button>
          </div>
        </form>

        <aside className="card card--pad urgent__preview">
          <div className="label">{t('Who could do it')}</div>
          {!ready ? (
            <p className="small soft" style={{ marginTop: 8 }}>{t('Choose an instrument, a place and a date to see who is free.')}</p>
          ) : preview.isError ? (
            <p className="small" style={{ marginTop: 8, color: 'var(--urgent)' }}>{t('The preview could not be loaded. You can still continue.')}</p>
          ) : !preview.data ? (
            <p className="small muted" style={{ marginTop: 8 }}>{t('Checking calendars…')}</p>
          ) : (
            <>
              <div className="urgent__count display num">{n}</div>
              <p className="small soft">{plural(n, 'player is free on {date}, within 150 km of {city}, and takes last-minute calls.', 'players are free on {date}, within 150 km of {city}, and take last-minute calls.', { date: fmt.day(date), city: city!.name })}</p>
              {n > 0 && (
                <div className="avatars" style={{ marginTop: 14 }}>
                  {preview.data.hits.slice(0, 7).map((h) => <Avatar key={h.musician.id} name={h.musician.name} tint={h.musician.tint} size="sm" />)}
                </div>
              )}
              {n === 0 && <p className="small soft" style={{ marginTop: 10 }}>{preview.data.relaxations.length ? t('Nobody fits exactly — a higher fee or another instrument listing may help. You can still post the call; it will be visible on the board.') : t('You can still post the call; it will be visible to everyone on the board.')}</p>}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
