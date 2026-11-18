import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Plus, X } from 'lucide-react';
import { useViewer } from '../../app/session';
import type { AccountSummary, ConcertView, EventInput, LineupEntry } from '../../data/api';
import { api } from '../../data/client';
import { useApiMutation, useApiQuery } from '../../data/hooks';
import type { EventFormat, EventSession, ID, ISODate, ProgrammeItem } from '../../domain/types';
import type { City } from '../../domain/cities';
import { fmt, t } from '../../i18n';
import { Async, Avatar, Field } from '../../ui/basics';
import { CityPicker, Combobox } from '../../ui/pickers';

export const FORMAT_LABELS: Record<EventFormat, string> = {
  concert: 'Concert',
  opera: 'Opera production',
  recording: 'Recording session',
  masterclass: 'Masterclass',
  audition: 'Audition',
};

/** Dates as the design writes them: 14.03 */
export const dotDate = (iso: ISODate) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

export const eventTitle = (c: Pick<ConcertView, 'title' | 'venue' | 'city' | 'programme'>) =>
  c.title ?? (c.programme[0] ? `${c.programme[0].composer}: ${c.programme[0].work}` : `${c.venue}, ${c.city}`);

// ── Confirm / That's not me ──────────────────────────────────────────────

export function LineupAnswer({ eventId, small = true }: { eventId: ID; small?: boolean }) {
  const viewer = useViewer();
  const who = viewer.musician?.id ?? viewer.id;
  const answer = useApiMutation((accept: boolean) => api.respondToLineup(eventId, who, accept), {
    success: (_r, accept) => (accept ? t('Confirmed. The event is now in your concert history and calendar.') : t('Thanks — you have been taken off the lineup.')),
  });
  const sm = small ? ' btn--sm' : '';
  return (
    <span className="row" style={{ gap: 8 }}>
      <button type="button" className={`btn btn--accent${sm}`} disabled={answer.isPending} onClick={() => answer.mutate(true)}>{t('Confirm')}</button>
      <button type="button" className={`btn btn--ghost${sm}`} disabled={answer.isPending} onClick={() => answer.mutate(false)}>{t('That’s not me')}</button>
    </span>
  );
}

/** Pending lineup invitations, for Alerts and Home. */
export function LineupInvites() {
  const viewer = useViewer();
  const who = viewer.musician?.id;
  const q = useApiQuery(['lineup-invites', who], () => api.listLineupInvites(who!), { enabled: !!who });
  if (!q.data?.length) return null;
  return (
    <ul className="lineup-invites">
      {q.data.map((x) => (
        <li key={x.event.id} className="alert is-unread">
          <Avatar name={x.invitedBy.name} tint={x.invitedBy.tint} />
          <span className="grow">
            <span className="label label--urgent" style={{ marginBottom: 4 }}>{t('Needs your answer')}</span>
            <span className="alert__text">
              {t('{who} added you to a lineup', { who: x.invitedBy.name })} · {x.role}
            </span>
            <Link to={`/events/${x.event.id}`} className="small link">{dotDate(x.event.date)} · {eventTitle(x.event)}</Link>
          </span>
          <LineupAnswer eventId={x.event.id} />
        </li>
      ))}
    </ul>
  );
}

// ── Event page ───────────────────────────────────────────────────────────

function LineupRow({ e }: { e: LineupEntry }) {
  if (e.status === 'open') {
    const inner = (
      <>
        <span className="seat__mark" aria-hidden><Plus size={14} /></span>
        <span className="grow seat__label">{t('Open seat')} · {e.role}</span>
        {e.opportunityId && <span className="small">{t('Apply')} ▸</span>}
      </>
    );
    return <li className="lineup__row lineup__row--open">{e.opportunityId ? <Link to={`/opportunities/${e.opportunityId}`} className="row grow">{inner}</Link> : inner}</li>;
  }
  return (
    <li className={`lineup__row${e.status !== 'confirmed' ? ' lineup__row--pending' : ''}`}>
      {e.person && <Avatar name={e.person.name} tint={e.person.tint} size="sm" />}
      <span className="grow">
        {e.person?.slug ? <Link to={`/musicians/${e.person.slug}`} className="lineup__name">{e.person.name}</Link> : <span className="lineup__name">{e.person?.name}</span>}
      </span>
      <span className="small muted">{e.role}</span>
      {e.status === 'invited' && <span className="tag tag--warn">{t('Waiting to confirm')}</span>}
      {e.status === 'declined' && <span className="tag">{t('Declined')}</span>}
    </li>
  );
}

export function EventPage() {
  const { id = '' } = useParams();
  const viewer = useViewer();
  const q = useApiQuery(['event', id, viewer.id], () => api.getEvent(id, viewer.id));
  return (
    <Async query={q} page>
      {(v) => {
        const c = v.event;
        const perfs = (c.sessions ?? [{ date: c.date, time: c.time, kind: 'performance' as const }]).filter((s) => s.kind === 'performance');
        const rehearsals = (c.sessions ?? []).filter((s) => s.kind === 'rehearsal');
        const confirmed = v.lineup.filter((l) => l.status === 'confirmed').length;
        const open = v.lineup.filter((l) => l.status === 'open');
        const by = v.organisation ? <Link className="link" to={`/ensembles/${v.organisation.slug}`}>{v.organisation.name}</Link> : v.organiser.slug ? <Link className="link" to={`/musicians/${v.organiser.slug}`}>{v.organiser.name}</Link> : v.organiser.name;
        return (
          <div className="wrap page event">
            <div className="event__grid">
              <div className="stack stack--lg">
                <header className="event__head">
                  <p className="small muted">
                    {t('Event')} · {t(FORMAT_LABELS[c.format ?? 'concert']).toLowerCase()} · {t('by')} {by}
                    {c.visibility === 'private' && <span className="tag" style={{ marginLeft: 8 }}>{t('Private')}</span>}
                  </p>
                  <h1 className="h-page">{eventTitle(c)}</h1>
                  <div className="event__when">
                    <span className="event__date">{dotDate(perfs[0]?.date ?? c.date)}</span>
                    <span>
                      {fmt.long(perfs[0]?.date ?? c.date).split(',')[0]}
                      {perfs[0]?.time ? ` · ${perfs[0].time}` : ''}
                      <span className="event__venue">{c.venue}, {c.city}</span>
                    </span>
                  </div>
                  {perfs.length > 1 && <p className="small muted">{t('Also on')} {perfs.slice(1).map((p) => dotDate(p.date)).join(' · ')}</p>}
                  {v.viewer.invite && (
                    <div className="event__ask">
                      <span className="grow">
                        <span className="label label--urgent">{t('Needs your answer')}</span>
                        <span style={{ display: 'block' }}>{t('{who} added you to this lineup as {role}.', { who: v.viewer.invite.invitedBy.name, role: v.viewer.invite.role })}</span>
                      </span>
                      <LineupAnswer eventId={c.id} small={false} />
                    </div>
                  )}
                </header>

                {c.description && <p className="prose">{c.description}</p>}

                {c.programme.length > 0 && (
                  <section className="event__section">
                    <p className="label">{t('Programme')}</p>
                    <ol className="event__programme">
                      {c.programme.map((p, k) => (
                        <li key={k}>
                          <span className="event__composer">{p.composer}</span>
                          <span className="work-title">{p.work}</span>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}

                <section className="event__section">
                  <p className="row row--between">
                    <span className="label">{t('Lineup')}</span>
                    <span className="small muted">
                      {t('{n} confirmed', { n: confirmed })}
                      {open.length > 0 && ` · ${open.length === 1 ? t('1 open seat') : t('{n} open seats', { n: open.length })}`}
                    </span>
                  </p>
                  {v.lineup.length ? <ul className="lineup">{v.lineup.map((e, k) => <LineupRow key={k} e={e} />)}</ul> : <p className="muted small">{t('No one on the lineup yet.')}</p>}
                  {v.viewer.canManage && <p className="tiny muted" style={{ marginTop: 8 }}>{t('People confirm before they appear on the public event.')}</p>}
                </section>
              </div>

              <aside className="stack stack--lg event__side">
                {open.map((s) => (
                  <section key={s.seatId} className="event__seat">
                    <p className="label label--urgent">{t('Open seat')}</p>
                    <p className="h-card">{s.role}</p>
                    <p className="small muted">{t('Fee shown when you open it')}</p>
                    {s.opportunityId ? (
                      <Link to={`/opportunities/${s.opportunityId}`} className="btn btn--accent btn--block">{t('See the seat and apply')}</Link>
                    ) : v.viewer.canManage ? (
                      <Link to={`/opportunities/new?event=${c.id}&seat=${s.seatId}`} className="btn btn--primary btn--block">{t('Post it as an opportunity')}</Link>
                    ) : null}
                  </section>
                ))}
                <div className="stack">
                  {c.ticketUrl && <a className="btn btn--ghost btn--block" href={c.ticketUrl} target="_blank" rel="noreferrer">{t('Tickets')}</a>}
                  {v.viewer.canManage && <Link className="btn btn--ghost btn--block" to={`/opportunities/new?event=${c.id}`}>{t('Open a seat')}</Link>}
                </div>
                <dl className="event__facts">
                  {rehearsals.length > 0 && (
                    <div><dt>{t('Rehearsals')}</dt><dd>{rehearsals.map((r) => `${dotDate(r.date)}${r.time ? ` ${r.time}` : ''}`).join(' · ')}</dd></div>
                  )}
                  {c.conductor && <div><dt>{t('Conductor')}</dt><dd>{c.conductor}</dd></div>}
                  <div><dt>{t('Organiser')}</dt><dd>{v.organiser.name}</dd></div>
                  {v.viewer.inLineup && <div><dt>{t('You')}</dt><dd>{v.viewer.role}</dd></div>}
                </dl>
              </aside>
            </div>
          </div>
        );
      }}
    </Async>
  );
}

// ── Create an event ──────────────────────────────────────────────────────

interface Invitee { person: AccountSummary; role: string }

export function CreateEventPage() {
  const viewer = useViewer();
  const navigate = useNavigate();
  const [format, setFormat] = useState<EventFormat>('concert');
  const [orgId, setOrgId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [venue, setVenue] = useState('');
  const [city, setCity] = useState<City | undefined>();
  const [conductor, setConductor] = useState('');
  const [description, setDescription] = useState('');
  const [ticketUrl, setTicketUrl] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');
  const [sessions, setSessions] = useState<EventSession[]>([{ date: '', time: '20:30', kind: 'performance' }]);
  const [programme, setProgramme] = useState<ProgrammeItem[]>([{ composer: '', work: '' }]);
  const [myRole, setMyRole] = useState('');
  const [invitees, setInvitees] = useState<Invitee[]>([]);
  const [seats, setSeats] = useState<string[]>([]);
  const [text, setText] = useState('');
  const people = useApiQuery(['people', text], () => api.suggestPeople(text, viewer.id, 10), { enabled: text.trim().length > 1 });

  const input: EventInput = useMemo(
    () => ({
      format,
      title,
      orgId: orgId || undefined,
      venue,
      city: city?.name ?? '',
      country: city?.country ?? 'IT',
      conductor,
      description,
      ticketUrl,
      visibility,
      sessions: sessions.filter((s) => s.date),
      programme,
      myRole: viewer.isMusician ? myRole : undefined,
      invite: invitees.map((i) => ({ musicianId: i.person.id, role: i.role })),
      openSeats: seats.map((role) => ({ role })),
    }),
    [format, title, orgId, venue, city, conductor, description, ticketUrl, visibility, sessions, programme, myRole, invitees, seats, viewer.isMusician],
  );
  const create = useApiMutation((i: EventInput) => api.createEvent(i, viewer.id), {
    success: t('Event created. Invitations have been sent.'),
    onDone: (c) => navigate(`/events/${c.id}`),
  });
  const ready = !!venue.trim() && !!city && input.sessions.some((s) => s.kind === 'performance');
  const setSession = (k: number, patch: Partial<EventSession>) => setSessions(sessions.map((s, j) => (j === k ? { ...s, ...patch } : s)));
  const setWork = (k: number, patch: Partial<ProgrammeItem>) => setProgramme(programme.map((s, j) => (j === k ? { ...s, ...patch } : s)));

  return (
    <div className="wrap page">
      <form
        className="event__grid"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) create.mutate(input);
        }}
      >
        <div className="stack stack--lg">
          <header className="row row--between row--wrap" style={{ alignItems: 'flex-end', borderBottom: '1px solid var(--ink)', paddingBottom: 20 }}>
            <h1 className="h-page">{t('New event')}</h1>
            {viewer.organisations.length > 0 && (
              <Field label={t('Organised by')}>
                <select className="select" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
                  <option value="">{t('Myself')}</option>
                  {viewer.organisations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </Field>
            )}
          </header>

          <fieldset className="plain">
            <legend className="label">{t('Type')}</legend>
            <div className="row row--wrap" style={{ gap: 8, marginTop: 10 }}>
              {(Object.keys(FORMAT_LABELS) as EventFormat[]).map((f) => (
                <button key={f} type="button" className={`chip${format === f ? ' is-on' : ''}`} aria-pressed={format === f} onClick={() => setFormat(f)}>{t(FORMAT_LABELS[f])}</button>
              ))}
            </div>
          </fieldset>

          <div className="form-grid">
            <Field label={t('Title')}><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('e.g. Tango nights')} /></Field>
            <Field label={t('Venue')}><input className="input" value={venue} onChange={(e) => setVenue(e.target.value)} /></Field>
            <Field label={t('City')}><CityPicker value={city?.name ?? ''} onPick={setCity} /></Field>
            <Field label={t('Conductor (optional)')}><input className="input" value={conductor} onChange={(e) => setConductor(e.target.value)} /></Field>
          </div>

          <section className="event__section">
            <p className="label">{t('Dates')}</p>
            <ul className="stack stack--sm" style={{ marginTop: 10 }}>
              {sessions.map((s, k) => (
                <li key={k} className="row row--wrap" style={{ gap: 12 }}>
                  <input className="input" type="date" aria-label={t('Date')} value={s.date} onChange={(e) => setSession(k, { date: e.target.value })} style={{ width: 170 }} />
                  <select className="select" aria-label={t('Kind')} value={s.kind} onChange={(e) => setSession(k, { kind: e.target.value as EventSession['kind'] })} style={{ width: 150 }}>
                    <option value="performance">{t('Performance')}</option>
                    <option value="rehearsal">{t('Rehearsal')}</option>
                  </select>
                  <input className="input" aria-label={t('Time')} value={s.time ?? ''} onChange={(e) => setSession(k, { time: e.target.value })} placeholder="20:30" style={{ width: 120 }} />
                  {sessions.length > 1 && <button type="button" className="btn btn--quiet btn--icon btn--sm" aria-label={t('Remove date')} onClick={() => setSessions(sessions.filter((_, j) => j !== k))}><X size={15} /></button>}
                </li>
              ))}
            </ul>
            <button type="button" className="link small" style={{ marginTop: 10 }} onClick={() => setSessions([...sessions, { date: '', kind: 'rehearsal' }])}>+ {t('Add a date')}</button>
          </section>

          <section className="event__section">
            <p className="label">{t('Programme')}</p>
            <ul className="stack stack--sm" style={{ marginTop: 10 }}>
              {programme.map((p, k) => (
                <li key={k} className="row row--wrap" style={{ gap: 12 }}>
                  <input className="input" aria-label={t('Composer')} placeholder={t('Composer')} value={p.composer} onChange={(e) => setWork(k, { composer: e.target.value })} style={{ flex: '1 1 160px' }} />
                  <input className="input work-title" aria-label={t('Work')} placeholder={t('Work')} value={p.work} onChange={(e) => setWork(k, { work: e.target.value })} style={{ flex: '2 1 220px' }} />
                  {programme.length > 1 && <button type="button" className="btn btn--quiet btn--icon btn--sm" aria-label={t('Remove work')} onClick={() => setProgramme(programme.filter((_, j) => j !== k))}><X size={15} /></button>}
                </li>
              ))}
            </ul>
            <button type="button" className="link small" style={{ marginTop: 10 }} onClick={() => setProgramme([...programme, { composer: '', work: '' }])}>+ {t('Add a work')}</button>
          </section>

          <Field label={t('About the event')}><textarea className="textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
          <Field label={t('Ticket link (optional)')}><input className="input" type="url" value={ticketUrl} onChange={(e) => setTicketUrl(e.target.value)} /></Field>
        </div>

        <aside className="stack stack--lg event__side">
          <section className="event__panel">
            <p className="label">{t('Lineup')}</p>
            <p className="small muted" style={{ margin: '6px 0 12px' }}>{t('People confirm before they appear on the event.')}</p>
            <ul className="lineup">
              {viewer.isMusician && (
                <li className="lineup__row">
                  <span className="grow lineup__name">{viewer.account?.name} <span className="muted small">({t('you')})</span></span>
                  <input className="input input--sm" aria-label={t('Your role')} placeholder={t('Your role, if you play')} value={myRole} onChange={(e) => setMyRole(e.target.value)} style={{ width: 150 }} />
                </li>
              )}
              {invitees.map((i, k) => (
                <li key={i.person.id} className="lineup__row lineup__row--pending">
                  <span className="grow lineup__name">{i.person.name}</span>
                  <input className="input input--sm" aria-label={t('Role of {name}', { name: i.person.name })} value={i.role} onChange={(e) => setInvitees(invitees.map((x, j) => (j === k ? { ...x, role: e.target.value } : x)))} placeholder={t('Role')} style={{ width: 120 }} />
                  <button type="button" className="btn btn--quiet btn--icon btn--sm" aria-label={t('Remove {name}', { name: i.person.name })} onClick={() => setInvitees(invitees.filter((_, j) => j !== k))}><X size={14} /></button>
                </li>
              ))}
              {seats.map((role, k) => (
                <li key={`s${k}`} className="lineup__row lineup__row--open">
                  <span className="seat__mark" aria-hidden><Plus size={14} /></span>
                  <input className="input input--sm grow" aria-label={t('Open seat')} value={role} onChange={(e) => setSeats(seats.map((x, j) => (j === k ? e.target.value : x)))} placeholder={t('Open seat · instrument')} />
                  <button type="button" className="btn btn--quiet btn--icon btn--sm" aria-label={t('Remove seat')} onClick={() => setSeats(seats.filter((_, j) => j !== k))}><X size={14} /></button>
                </li>
              ))}
            </ul>
            <div style={{ marginTop: 12 }}>
              <Combobox
                value={text}
                onChange={setText}
                clearOnPick
                ariaLabel={t('Add a musician')}
                placeholder={t('+ Add a musician')}
                options={() => (people.data ?? []).filter((a) => a.kind === 'musician' && a.id !== viewer.id && !invitees.some((i) => i.person.id === a.id)).map((a) => ({ key: a.id, label: a.name, hint: a.title.slice(0, 40), value: a }))}
                onPick={(o) => {
                  setInvitees([...invitees, { person: o.value, role: '' }]);
                  setText('');
                }}
              />
            </div>
            <button type="button" className="link small" style={{ marginTop: 10 }} onClick={() => setSeats([...seats, ''])}>+ {t('Open a seat')}</button>
          </section>

          <fieldset className="plain">
            <legend className="label">{t('Who can see it')}</legend>
            <label className="check" style={{ marginTop: 10 }}>
              <input type="radio" name="vis" checked={visibility === 'private'} onChange={() => setVisibility('private')} />
              <span><b>{t('Private for now')}</b><br /><span className="small muted">{t('Only the lineup and invited musicians')}</span></span>
            </label>
            <label className="check" style={{ marginTop: 10 }}>
              <input type="radio" name="vis" checked={visibility === 'public'} onChange={() => setVisibility('public')} />
              <span><b>{t('Public')}</b><br /><span className="small muted">{t('Anyone on Leggio can see it')}</span></span>
            </label>
          </fieldset>

          <button type="submit" className="btn btn--accent btn--lg btn--block" disabled={!ready || create.isPending}>{t('Create event')}</button>
          {!ready && <p className="tiny muted">{t('Add a venue, a city and at least one performance date.')}</p>}
        </aside>
      </form>
    </div>
  );
}
