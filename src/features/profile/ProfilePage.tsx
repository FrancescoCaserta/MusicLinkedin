import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Award, Building2, CalendarDays, Car, Check, ChevronLeft, ChevronRight, Clock, ExternalLink, FileText, GraduationCap, Languages, MapPin, Pause, Pencil, Play, Printer, Quote, Send, UserCheck, UserPlus, Video, Zap } from 'lucide-react';
import { useViewer } from '../../app/session';
import type { ProfileView } from '../../data/api';
import { api } from '../../data/client';
import { useApiMutation, useApiQuery } from '../../data/hooks';
import { addMonths, today } from '../../domain/dates';
import { availabilityOn } from '../../domain/search/engine';
import { instrument, instrumentName, normalise, roleLabel } from '../../domain/taxonomy';
import type { Genre, Recording, RepertoireItem } from '../../domain/types';
import { fmt, plural, t } from '../../i18n';
import { Async, Avatar, AvailabilityTag, EmptyState, feeRange, Field, Modal, Skeleton } from '../../ui/basics';
import { CalendarLegend, MonthCalendar } from '../../ui/MonthCalendar';
import { ConcertItem, InviteModal, MessageButton, MusicianMini, RepertoireStatus, ShortlistButton } from '../shared';

const GENRE_LABEL: Record<Genre, string> = {
  concerto: 'Concertos',
  solo: 'Solo',
  chamber: 'Chamber music',
  orchestral: 'Orchestral',
  opera: 'Opera',
  sacred: 'Sacred and oratorio',
  song: 'Song',
  contemporary: 'Contemporary',
};
const GENRE_ORDER: Genre[] = ['opera', 'sacred', 'song', 'concerto', 'solo', 'chamber', 'contemporary', 'orchestral'];

/**
 * Seeded recordings have no media file, so the player synthesises a short
 * placeholder (a slow broken chord seeded by the recording) — the control
 * works, and says honestly what it is.
 */
function useTone() {
  const ctx = useRef<AudioContext | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const [playing, setPlaying] = useState<string | null>(null);
  const stop = () => {
    window.clearTimeout(timer.current);
    void ctx.current?.close();
    ctx.current = null;
    setPlaying(null);
  };
  useEffect(() => stop, []); // eslint-disable-line react-hooks/exhaustive-deps
  const play = (id: string) => {
    if (playing === id) return stop();
    stop();
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new AC();
    ctx.current = ac;
    let seed = [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const root = 196 * 2 ** (Math.floor(rnd() * 7) / 12);
    const scale = [0, 3, 7, 10, 12, 15, 19, 12, 7, 3];
    const master = ac.createGain();
    master.gain.value = 0.16;
    master.connect(ac.destination);
    scale.forEach((semi, k) => {
      const at = ac.currentTime + 0.05 + k * 0.42;
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.value = root * 2 ** (semi / 12);
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.9, at + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, at + 1.6);
      osc.connect(g).connect(master);
      osc.start(at);
      osc.stop(at + 1.7);
    });
    setPlaying(id);
    timer.current = window.setTimeout(stop, scale.length * 420 + 1400);
  };
  return { playing, play };
}

function Recordings({ list }: { list: Recording[] }) {
  const { playing, play } = useTone();
  return (
    <>
      <ul className="recordings">
        {list.map((r) => (
          <li key={r.id} className="recording">
            {r.url ? (
              <a className="recording__play" href={r.url} target="_blank" rel="noreferrer noopener" aria-label={t('Open {title} in a new tab', { title: r.title })}>
                <ExternalLink size={16} aria-hidden />
              </a>
            ) : (
              <button type="button" className={`recording__play${playing === r.id ? ' is-on' : ''}`} onClick={() => play(r.id)} aria-label={playing === r.id ? t('Stop') : t('Play {title}', { title: r.title })}>
                {playing === r.id ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
              </button>
            )}
            <div className="grow">
              <div className="recording__title">{r.title}</div>
              <div className="tiny muted">
                {r.kind === 'video' ? t('Video') : t('Audio')} · {r.year}
                {r.durationSec ? ` · ${fmt.duration(r.durationSec)}` : ''}
                {r.note ? ` · ${r.note}` : ''}
              </div>
            </div>
            {r.kind === 'video' && <Video size={16} aria-hidden className="muted" />}
          </li>
        ))}
      </ul>
      {list.some((r) => !r.url) && <p className="tiny muted" style={{ marginTop: 10 }}>{t('Demo note: recordings in the seed data have no media file. Play gives a short synthesised placeholder; recordings you add with a link open that link.')}</p>}
    </>
  );
}

function Repertoire({ items }: { items: RepertoireItem[] }) {
  const [text, setText] = useState('');
  const [onlyReady, setOnlyReady] = useState(false);
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => {
    const words = normalise(text).split(' ').filter(Boolean);
    return items.filter((r) => (!onlyReady || r.status === 'ready') && words.every((w) => normalise(`${r.composer} ${r.work} ${r.part ?? ''}`).includes(w)));
  }, [items, text, onlyReady]);
  const groups = GENRE_ORDER.map((g) => ({ g, list: filtered.filter((r) => r.genre === g) })).filter((x) => x.list.length);
  const searching = !!text.trim() || onlyReady;
  const LIMIT = 6;
  const ready = items.filter((r) => r.status === 'ready').length;
  return (
    <div>
      <div className="rep__tools no-print">
        <input className="input input--sm" style={{ maxWidth: 280 }} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('Search this repertoire…')} aria-label={t('Search this repertoire')} />
        <label className="check small">
          <input type="checkbox" checked={onlyReady} onChange={(e) => setOnlyReady(e.target.checked)} />
          {t('Performance-ready only ({n})', { n: ready })}
        </label>
      </div>
      {filtered.length === 0 ? (
        <EmptyState compact title={t('Not in this repertoire')} text={t('No work matches “{text}”. Musicians can learn fast — it is still worth asking.', { text })} />
      ) : (
        <div className="rep">
          {groups.map(({ g, list }) => {
            const show = searching || open ? list : list.slice(0, LIMIT);
            return (
              <section key={g} className="rep__group">
                <h3 className="label">{t(GENRE_LABEL[g])} · {list.length}</h3>
                <ul>
                  {show.map((r) => (
                    <li key={r.id} className="rep__row">
                      <span className="rep__work">
                        <b>{r.composer}</b> {r.work}
                        {r.part && <span className="rep__part"> — {r.part}</span>}
                      </span>
                      <RepertoireStatus status={r.status} year={r.lastPerformed} />
                    </li>
                  ))}
                </ul>
                {!searching && !open && list.length > LIMIT && <div className="tiny muted" style={{ marginTop: 4 }}>{t('+ {n} more', { n: list.length - LIMIT })}</div>}
              </section>
            );
          })}
        </div>
      )}
      {!searching && items.length > 12 && (
        <button type="button" className="btn btn--ghost btn--sm no-print" style={{ marginTop: 16 }} onClick={() => setOpen(!open)}>
          {open ? t('Show less') : t('Show all {n} works', { n: items.length })}
        </button>
      )}
    </div>
  );
}

function EndorseModal({ profile, onClose }: { profile: ProfileView; onClose: () => void }) {
  const viewer = useViewer();
  const shared = profile.relation.sharedConcerts;
  const [concertId, setConcertId] = useState(shared[0]?.id ?? '');
  const [text, setText] = useState('');
  const m = profile.musician;
  const save = useApiMutation(() => api.endorse(viewer.id, m.id, concertId, text), { success: t('Endorsement published on {name}’s profile.', { name: m.firstName }), onDone: onClose });
  return (
    <Modal
      title={t('Endorse {name}', { name: m.name })}
      kicker={t('Tied to a concert you shared')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>{t('Cancel')}</button>
          <button type="button" className="btn btn--primary" disabled={text.trim().length < 20 || !concertId || save.isPending} onClick={() => save.mutate(undefined)}>{t('Publish endorsement')}</button>
        </>
      }
    >
      <div className="stack stack--lg">
        <Field label={t('Which concert?')} hint={t('Only concerts you both took part in are listed. The concert is shown with your words.')}>
          <select className="select" value={concertId} onChange={(e) => setConcertId(e.target.value)}>
            {shared.map((c) => (
              <option key={c.id} value={c.id}>
                {fmt.date(c.date)} — {c.programme[0]?.composer}: {c.programme[0]?.work} · {c.venue}, {c.city}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('What was it like to work with {name}?', { name: m.firstName })} hint={text.trim().length < 20 ? t('A sentence or two a hirer would find useful — preparation, reliability, how they play with others.') : undefined}>
          <textarea className="textarea" rows={5} value={text} onChange={(e) => setText(e.target.value)} maxLength={600} data-autofocus />
        </Field>
      </div>
    </Modal>
  );
}

function AvailabilityCard({ profile }: { profile: ProfileView }) {
  const m = profile.musician;
  const now = today();
  const [cursor, setCursor] = useState(now.slice(0, 7) + '-01');
  const [check, setCheck] = useState('');
  const [y, mo] = cursor.split('-').map(Number);
  return (
    <section className="card card--pad side-card">
      <div className="row row--between" style={{ marginBottom: 10 }}>
        <span className="label">{t('Availability')}</span>
        <span className="row" style={{ gap: 2 }}>
          <button type="button" className="btn btn--quiet btn--icon btn--sm no-print" disabled={cursor <= now.slice(0, 7) + '-01'} onClick={() => setCursor(addMonths(cursor, -1))} aria-label={t('Previous month')}><ChevronLeft size={16} aria-hidden /></button>
          <button type="button" className="btn btn--quiet btn--icon btn--sm no-print" onClick={() => setCursor(addMonths(cursor, 1))} aria-label={t('Next month')}><ChevronRight size={16} aria-hidden /></button>
        </span>
      </div>
      <MonthCalendar year={y} month={mo} availability={m.availability} today={now} highlight={check || undefined} />
      <CalendarLegend />
      <div className="side-card__check no-print">
        <Field label={t('Check a date')}>
          <input
            type="date"
            className="input input--sm"
            min={now}
            value={check}
            onChange={(e) => {
              setCheck(e.target.value);
              if (e.target.value) setCursor(e.target.value.slice(0, 7) + '-01');
            }}
          />
        </Field>
        {check && (
          <div style={{ marginTop: 8 }}>
            <AvailabilityTag value={availabilityOn(m, check)} date={check} />
          </div>
        )}
      </div>
      {profile.relation.state === 'self' && (
        <Link to="/calendar" className="btn btn--ghost btn--sm btn--block no-print" style={{ marginTop: 12 }}>
          <CalendarDays size={15} aria-hidden /> {t('Edit my calendar')}
        </Link>
      )}
    </section>
  );
}

function ProfileBody({ profile }: { profile: ProfileView }) {
  const viewer = useViewer();
  const m = profile.musician;
  const rel = profile.relation;
  const self = rel.state === 'self';
  const now = today();
  const [inviting, setInviting] = useState(false);
  const [endorsing, setEndorsing] = useState(false);
  const [allConcerts, setAllConcerts] = useState(false);
  const connect = useApiMutation(() => api.requestConnection(viewer.id, m.id), { success: rel.state === 'pending-in' ? t('You are now connected with {name}.', { name: m.firstName }) : t('Connection request sent to {name}.', { name: m.firstName }) });
  const upcoming = profile.concerts.filter((c) => c.date >= now).reverse();
  const past = profile.concerts.filter((c) => c.date < now);
  const primary = m.instruments[0];
  const voice = instrument(primary.instrumentId)?.family === 'voice';
  const others = m.instruments.slice(1);
  const levelLabel = { primary: '', secondary: t('second instrument'), doubling: t('doubling'), period: t('period instrument') };
  useEffect(() => {
    document.title = `${m.name} — Leggio`;
    return () => void (document.title = 'Leggio — the professional network for classical musicians');
  }, [m.name]);

  return (
    <div className="wrap page profile">
      <header className="profile__head">
        <Avatar name={m.name} tint={m.tint} size="xl" />
        <div className="grow">
          <div className="label label--accent">{voice ? t(instrumentName(primary.instrumentId)) : t(instrumentName(primary.instrumentId))}{others.length > 0 && !voice ? ` · ${others.map((p) => t(instrumentName(p.instrumentId))).join(' · ')}` : ''}</div>
          <h1 className="display profile__name">{m.name}</h1>
          <p className="profile__headline">{m.headline}</p>
          <div className="meta profile__meta">
            <span><MapPin size={15} aria-hidden />{m.base.name} · {m.travelsInternationally ? t('travels internationally') : t('travels up to {km}', { km: fmt.km(m.travelRadiusKm) })}</span>
            <span><Award size={15} aria-hidden />{plural(profile.endorsements.length, '{n} endorsement', '{n} endorsements')}</span>
            <span><UserCheck size={15} aria-hidden />{plural(profile.connections, '{n} connection', '{n} connections')}</span>
            {m.practical.urgentCalls && <span><Zap size={15} aria-hidden />{t('Takes last-minute calls')}</span>}
          </div>
          <div className="profile__actions no-print">
            {self ? (
              <>
                <Link to="/profile/edit" className="btn btn--primary"><Pencil size={15} aria-hidden />{t('Edit profile')}</Link>
                <Link to="/calendar" className="btn btn--ghost"><CalendarDays size={15} aria-hidden />{t('Calendar')}</Link>
              </>
            ) : (
              <>
                <button type="button" className="btn btn--primary" onClick={() => setInviting(true)}><Send size={15} aria-hidden />{t('Invite to an opportunity')}</button>
                <MessageButton to={{ id: m.id, name: m.name }} small={false} />
                {rel.state === 'connected' ? (
                  <span className="btn btn--ghost" aria-disabled="true" style={{ opacity: 1, cursor: 'default' }}><Check size={15} aria-hidden />{t('Connected')}</span>
                ) : rel.state === 'pending-out' ? (
                  <span className="btn btn--ghost" aria-disabled="true"><Clock size={15} aria-hidden />{t('Request sent')}</span>
                ) : (
                  <button type="button" className="btn btn--ghost" disabled={connect.isPending} onClick={() => connect.mutate(undefined)}><UserPlus size={15} aria-hidden />{rel.state === 'pending-in' ? t('Accept connection') : t('Connect')}</button>
                )}
                <ShortlistButton musicianId={m.id} on={profile.shortlisted} label />
              </>
            )}
            <button type="button" className="btn btn--quiet" onClick={() => window.print()} title={t('A one-page version for programme books and applications')}><Printer size={15} aria-hidden />{t('Print / PDF')}</button>
          </div>
        </div>
      </header>

      {!self && (rel.sharedConcerts.length > 0 || rel.mutuals.length > 0) && (
        <div className="together card no-print">
          <div className="grow">
            {rel.sharedConcerts.length > 0 ? (
              <>
                <b>{plural(rel.sharedConcerts.length, 'You have shared {n} concert with {name}', 'You have shared {n} concerts with {name}', { name: m.firstName })}</b>
                <span className="soft"> — {t('most recently {work}, {venue}, {date}.', { work: rel.sharedConcerts[0].programme[0]?.work ?? '', venue: rel.sharedConcerts[0].venue, date: fmt.date(rel.sharedConcerts[0].date) })}</span>
              </>
            ) : (
              <b>{plural(rel.mutuals.length, '{n} connection in common', '{n} connections in common')}</b>
            )}
            {rel.mutuals.length > 0 && rel.sharedConcerts.length > 0 && <span className="soft"> {plural(rel.mutuals.length, '{n} connection in common.', '{n} connections in common.')}</span>}
          </div>
          {rel.sharedConcerts.length > 0 &&
            (rel.endorsed ? (
              <span className="tag tag--ok"><Check size={12} aria-hidden />{t('You endorsed {name}', { name: m.firstName })}</span>
            ) : (
              <button type="button" className="btn btn--accent btn--sm" onClick={() => setEndorsing(true)}><Quote size={14} aria-hidden />{t('Write an endorsement')}</button>
            ))}
        </div>
      )}

      <div className="cols profile__cols">
        <div>
          <section className="section">
            <div className="section__head"><h2 className="h-section">{t('About')}</h2></div>
            <div className="prose">{m.bio.split('\n').map((p, k) => <p key={k}>{p}</p>)}</div>
            <div className="row row--wrap" style={{ gap: 6, marginTop: 16 }}>
              {m.roles.map((r) => <span key={r} className="tag tag--line">{t(roleLabel(r))}</span>)}
            </div>
          </section>

          <section className="section">
            <div className="section__head"><h2 className="h-section">{voice ? t('Voice and instruments') : t('Instruments')}</h2></div>
            <ul className="instruments">
              {m.instruments.map((p) => (
                <li key={p.instrumentId}>
                  <span className="instruments__name">{t(instrumentName(p.instrumentId))}</span>
                  {p.level !== 'primary' && <span className="tag">{levelLabel[p.level]}</span>}
                  {p.level === 'primary' && <span className="tag tag--accent">{voice ? t('voice type') : t('main instrument')}</span>}
                  {(p.note || (p.level === 'primary' && m.voiceDescription)) && <span className="small soft instruments__note">{p.level === 'primary' && m.voiceDescription ? m.voiceDescription : p.note}</span>}
                </li>
              ))}
            </ul>
            {m.pitches.length > 0 && (
              <p className="small soft" style={{ marginTop: 12 }}>
                <b>{t('Pitch')}</b> · {m.pitches.map((p) => `A=${p}`).join(' · ')}
              </p>
            )}
          </section>

          <section className="section" id="repertoire">
            <div className="section__head">
              <h2 className="h-section">{t('Repertoire')}</h2>
              <span className="small muted">{plural(m.repertoire.length, '{n} work', '{n} works')}</span>
            </div>
            {m.repertoire.length ? <Repertoire items={m.repertoire} /> : <EmptyState compact title={t('No repertoire listed yet')} text={self ? t('Add the works you have played — it is what hirers search for first.') : undefined} action={self ? <Link to="/profile/edit?tab=repertoire" className="btn btn--primary btn--sm">{t('Add repertoire')}</Link> : undefined} />}
          </section>

          {upcoming.length > 0 && (
            <section className="section">
              <div className="section__head"><h2 className="h-section">{t('Coming up')}</h2></div>
              <ul>{upcoming.slice(0, 4).map((c) => <ConcertItem key={c.id} c={c} focusId={m.id} />)}</ul>
            </section>
          )}

          <section className="section" id="concerts">
            <div className="section__head">
              <h2 className="h-section">{t('Concert history')}</h2>
              <span className="small muted">{plural(past.length, '{n} concert', '{n} concerts')}</span>
            </div>
            {past.length ? (
              <>
                <ul>{(allConcerts ? past : past.slice(0, 6)).map((c) => <ConcertItem key={c.id} c={c} focusId={m.id} showPeople />)}</ul>
                {past.length > 6 && (
                  <button type="button" className="btn btn--ghost btn--sm no-print" style={{ marginTop: 8 }} onClick={() => setAllConcerts(!allConcerts)}>
                    {allConcerts ? t('Show fewer') : t('Show all {n} concerts', { n: past.length })}
                  </button>
                )}
              </>
            ) : (
              <EmptyState compact title={t('No concerts listed yet')} />
            )}
          </section>

          {m.recordings.length > 0 && (
            <section className="section no-print">
              <div className="section__head"><h2 className="h-section">{t('Recordings')}</h2></div>
              <Recordings list={m.recordings} />
            </section>
          )}

          <section className="section" id="endorsements">
            <div className="section__head">
              <h2 className="h-section">{t('Endorsements')}</h2>
              <span className="small muted">{t('each tied to a shared concert')}</span>
            </div>
            {profile.endorsements.length ? (
              <ul className="endorsements">
                {profile.endorsements.map((e) => (
                  <li key={e.id} className="endorsement">
                    <p className="endorsement__text">{e.text}</p>
                    <div className="endorsement__by">
                      <Avatar name={e.from.name} tint={e.from.tint} size="sm" />
                      <div>
                        <div>
                          {e.from.slug ? <Link className="link" to={`/musicians/${e.from.slug}`}>{e.from.name}</Link> : <b>{e.from.name}</b>}
                          <span className="muted"> · {e.from.title}</span>
                        </div>
                        <div className="tiny muted endorsement__concert">
                          {e.concert.programme[0] ? `${e.concert.programme[0].composer}, ${e.concert.programme[0].work} — ` : ''}
                          {e.concert.venue}, {e.concert.city}, {fmt.date(e.concert.date)}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={<Quote size={20} aria-hidden />} title={t('No endorsements yet')} text={t('Endorsements come from people who shared a concert with {name}.', { name: m.firstName })} />
            )}
          </section>

          <section className="section">
            <div className="section__head"><h2 className="h-section">{t('Training')}</h2></div>
            <ul className="timeline">
              {m.training.map((x) => (
                <li key={x.id}>
                  <span className="timeline__when num">{x.from}–{x.to}</span>
                  <div>
                    <div style={{ fontWeight: 650 }}>{x.institution}</div>
                    <div className="small soft">{x.qualification}{x.teacher ? ` · ${t('class of {name}', { name: x.teacher })}` : ''}</div>
                  </div>
                </li>
              ))}
            </ul>
            {m.masterclasses.length > 0 && (
              <p className="small soft" style={{ marginTop: 14 }}>
                <b>{t('Masterclasses')}</b> · {m.masterclasses.map((x) => `${x.teacher} (${x.place}, ${x.year})`).join(' · ')}
              </p>
            )}
          </section>

          {m.awards.length > 0 && (
            <section className="section">
              <div className="section__head"><h2 className="h-section">{t('Competitions and awards')}</h2></div>
              <ul className="timeline">
                {m.awards.map((a) => (
                  <li key={a.id}>
                    <span className="timeline__when num">{a.year}</span>
                    <div>
                      <div style={{ fontWeight: 650 }}>{a.result}</div>
                      <div className="small soft">{a.competition}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="profile__side">
          <section className="card card--pad side-card">
            <div className="label">{t('Indicative fee')}</div>
            <div className="side-card__fee display num">{feeRange(m.fee)}</div>
            <div className="small soft">{t('per engagement — rehearsals and concert')}</div>
            {m.teachingRate && <div className="small soft" style={{ marginTop: 6 }}>{t('Teaching: {rate} per hour', { rate: fmt.money(m.teachingRate) })}</div>}
          </section>
          <AvailabilityCard profile={profile} />
          <section className="card card--pad side-card">
            <div className="label" style={{ marginBottom: 10 }}>{t('Practicalities')}</div>
            <div className="stack stack--sm">
              <div className="icon-line"><MapPin size={15} aria-hidden /><span>{t('Based in {city}', { city: m.base.name })} · {m.travelsInternationally ? t('{km} by road, further with travel covered', { km: fmt.km(m.travelRadiusKm) }) : t('up to {km}', { km: fmt.km(m.travelRadiusKm) })}</span></div>
              <div className="icon-line"><Languages size={15} aria-hidden /><span>{m.languages.map((l) => t(l)).join(', ')}</span></div>
              <div className="icon-line"><Car size={15} aria-hidden /><span>{m.practical.ownTransport ? t('Own transport') : t('Travels by public transport')}</span></div>
              <div className="icon-line"><FileText size={15} aria-hidden /><span>{m.practical.canInvoice ? t('Can invoice (VAT-registered)') : t('Engaged by contract — cannot invoice')}</span></div>
              <div className="icon-line"><Zap size={15} aria-hidden /><span>{m.practical.urgentCalls ? t('Last-minute calls: yes, from {n} hours’ notice', { n: m.practical.noticeHours ?? 24 }) : t('Does not take last-minute calls')}</span></div>
              <div className="icon-line"><GraduationCap size={15} aria-hidden /><span>{t('Working professionally since {year}', { year: m.activeSince })}</span></div>
            </div>
          </section>
          {m.positions.length > 0 && (
            <section className="card card--pad side-card">
              <div className="label" style={{ marginBottom: 10 }}>{t('Positions and ensembles')}</div>
              <ul className="stack">
                {m.positions.map((p) => {
                  const org = profile.organisations.find((o) => o.id === p.orgId);
                  return (
                    <li key={p.id} className="icon-line">
                      <Building2 size={15} aria-hidden />
                      <span>
                        {org ? <Link className="link" to={`/ensembles/${org.slug}`}>{p.organisation}</Link> : p.organisation}
                        <span className="muted"> · {p.title}, {p.to ? `${p.from}–${p.to}` : t('since {year}', { year: p.from })}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {rel.mutuals.length > 0 && (
            <section className="card card--pad side-card no-print">
              <div className="label" style={{ marginBottom: 10 }}>{t('Connections in common')}</div>
              <div className="stack">{rel.mutuals.slice(0, 5).map((a) => <MusicianMini key={a.id} m={a} />)}</div>
            </section>
          )}
        </aside>
      </div>

      {inviting && <InviteModal musicians={[{ id: m.id, name: m.name }]} createHref={`/opportunities/new?i=${primary.instrumentId}`} onClose={() => setInviting(false)} />}
      {endorsing && <EndorseModal profile={profile} onClose={() => setEndorsing(false)} />}
    </div>
  );
}

export function ProfilePage() {
  const { slug = '' } = useParams();
  const viewer = useViewer();
  const profile = useApiQuery(['profile', slug, viewer.id], () => api.getProfile(slug, viewer.id));
  return (
    <Async
      query={profile}
      page
      loading={
        <div className="wrap page">
          <div className="row" style={{ gap: 24, marginBottom: 32 }}>
            <Skeleton w={112} h={112} style={{ borderRadius: '50%' }} />
            <div className="grow stack">
              <Skeleton w="30%" h={14} />
              <Skeleton w="55%" h={44} />
              <Skeleton w="70%" h={16} />
            </div>
          </div>
          <Skeleton h={320} />
        </div>
      }
    >
      {(data) => <ProfileBody profile={data} key={data.musician.id} />}
    </Async>
  );
}
