import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { Award, BedDouble, Bookmark, BookmarkCheck, CalendarDays, Check, Clock, MapPin, MessageSquare, Music2, Send, Train, Users, Zap } from 'lucide-react';
import { useViewer } from '../app/session';
import type { AccountSummary, ConcertView, MusicianCard, OpportunityView, SearchHit } from '../data/api';
import { api } from '../data/client';
import { useApiMutation, useApiQuery } from '../data/hooks';
import { diffDays, today } from '../domain/dates';
import { keyDate } from '../domain/search/opportunities';
import type { MusicianQuery } from '../domain/search/query';
import { instrumentName, OPPORTUNITY_TYPE_LABELS } from '../domain/taxonomy';
import type { ID, Opportunity, ProgrammeItem } from '../domain/types';
import { fmt, plural, t } from '../i18n';
import { Avatar, AvailabilityTag, FeeBlock, feeRange, Field, instrumentsLine, Modal } from '../ui/basics';

// ── Musicians ────────────────────────────────────────────────────────────

/** One line that says who this is: name, what they play, where. */
export function MusicianMini({ m, right, sub }: { m: MusicianCard | AccountSummary; right?: ReactNode; sub?: ReactNode }) {
  const isCard = 'instruments' in m;
  const body = (
    <>
      <Avatar name={m.name} tint={m.tint} />
      <span className="grow">
        <span className="mini__name">{m.name}</span>
        <span className="mini__sub">{sub ?? (isCard ? `${instrumentsLine(m.instruments, 2)} · ${m.base.name}` : m.title)}</span>
      </span>
    </>
  );
  return (
    <div className="mini">
      {m.slug ? (
        <Link to={`/musicians/${m.slug}`} className="mini__main">
          {body}
        </Link>
      ) : (
        <div className="mini__main">{body}</div>
      )}
      {right}
    </div>
  );
}

/** Why this person matches — the heart of a search result. */
export function MatchReasons({ hit, query }: { hit: SearchHit; query: Pick<MusicianQuery, 'place' | 'date' | 'budget' | 'repertoire'> }) {
  const m = hit.musician;
  return (
    <div className="reasons">
      {hit.distanceKm != null && query.place && (
        <span className="reason">
          <MapPin size={14} aria-hidden />
          {t('{km} from {place}', { km: fmt.km(hit.distanceKm), place: query.place.name })}
          {hit.withinTravelRadius === false && <span className="tag tag--warn">{t('beyond usual travel radius')}</span>}
        </span>
      )}
      {hit.availability && query.date && (
        <span className="reason">
          <AvailabilityTag value={hit.availability} date={query.date} />
        </span>
      )}
      <span className="reason">
        <span className="num" style={{ fontWeight: 650, color: 'var(--ink)' }}>{feeRange(m.fee)}</span>
        {hit.feeFit === 'comfortable' && <span className="tag tag--ok">{t('well within budget')}</span>}
        {hit.feeFit === 'within' && <span className="tag tag--ok">{t('within budget')}</span>}
      </span>
      {hit.repertoire.length > 0 && (
        <span className="reason reason--wide">
          <Music2 size={14} aria-hidden />
          <span>
            {hit.repertoire[0].composer} — {hit.repertoire[0].work}
            {hit.repertoire[0].part ? ` (${hit.repertoire[0].part})` : ''}
          </span>
          <RepertoireStatus status={hit.repertoire[0].status} year={hit.repertoire[0].lastPerformed} />
          {hit.repertoire.length > 1 && <span className="muted">+{hit.repertoire.length - 1}</span>}
        </span>
      )}
      {hit.network && (hit.network.connected || hit.network.sharedConcerts > 0 || hit.network.mutuals > 0) && (
        <span className="reason">
          <Users size={14} aria-hidden />
          {[
            hit.network.connected ? t('In your network') : '',
            hit.network.sharedConcerts ? plural(hit.network.sharedConcerts, '{n} concert together', '{n} concerts together') : '',
            !hit.network.connected && hit.network.mutuals ? plural(hit.network.mutuals, '{n} mutual connection', '{n} mutual connections') : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      )}
      {m.endorsements > 0 && (
        <span className="reason">
          <Award size={14} aria-hidden />
          {plural(m.endorsements, '{n} endorsement', '{n} endorsements')}
        </span>
      )}
      {m.urgentCalls && query.date && diffDays(query.date, today()) <= 3 && (
        <span className="reason">
          <Zap size={14} aria-hidden />
          {t('Takes last-minute calls')}
        </span>
      )}
    </div>
  );
}

export function RepertoireStatus({ status, year }: { status: 'ready' | 'performed' | 'learning'; year?: number }) {
  if (status === 'ready') return <span className="tag tag--ok">{t('performance-ready')}</span>;
  if (status === 'performed') return <span className="tag">{year ? t('performed {year}', { year }) : t('performed')}</span>;
  return <span className="tag tag--line">{t('in preparation')}</span>;
}

export function ShortlistButton({ musicianId, on, label = false }: { musicianId: ID; on: boolean; label?: boolean }) {
  const viewer = useViewer();
  const toggle = useApiMutation(() => api.toggleShortlist(viewer.id, musicianId), {
    success: (saved) => (saved ? t('Saved to your shortlist.') : t('Removed from your shortlist.')),
  });
  return (
    <button type="button" className={`btn btn--ghost btn--sm${label ? '' : ' btn--icon'}${on ? ' is-on' : ''}`} aria-pressed={on} aria-label={on ? t('Remove from shortlist') : t('Save to shortlist')} disabled={toggle.isPending} onClick={() => toggle.mutate(undefined)}>
      {on ? <BookmarkCheck size={16} aria-hidden /> : <Bookmark size={16} aria-hidden />}
      {label && (on ? t('Saved') : t('Save'))}
    </button>
  );
}

// ── Messaging ────────────────────────────────────────────────────────────

export function MessageModal({ to, onClose, opportunityId, preset = '' }: { to: { id: ID; name: string }; onClose: () => void; opportunityId?: ID; preset?: string }) {
  const viewer = useViewer();
  const navigate = useNavigate();
  const [body, setBody] = useState(preset);
  const send = useApiMutation(() => api.sendMessage({ fromId: viewer.id, toId: to.id, body, opportunityId }), {
    success: t('Message sent.'),
    onDone: (r) => {
      onClose();
      navigate(`/messages/${r.threadId}`);
    },
  });
  return (
    <Modal
      title={t('Message {name}', { name: to.name })}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>{t('Cancel')}</button>
          <button type="button" className="btn btn--primary" disabled={!body.trim() || send.isPending} onClick={() => send.mutate(undefined)}>
            <Send size={15} aria-hidden /> {t('Send')}
          </button>
        </>
      }
    >
      <Field label={t('Your message')} hint={t('Say what, when, where and the fee — it gets answers faster.')}>
        <textarea className="textarea" rows={6} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('Hello {name}, …', { name: to.name.split(' ')[0] })} />
      </Field>
    </Modal>
  );
}

export function MessageButton({ to, opportunityId, small = true, quiet = false }: { to: { id: ID; name: string }; opportunityId?: ID; small?: boolean; quiet?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`btn ${quiet ? 'btn--quiet' : 'btn--ghost'}${small ? ' btn--sm' : ''}`} onClick={() => setOpen(true)}>
        <MessageSquare size={15} aria-hidden /> {t('Message')}
      </button>
      {open && <MessageModal to={to} opportunityId={opportunityId} onClose={() => setOpen(false)} />}
    </>
  );
}

// ── Inviting ─────────────────────────────────────────────────────────────

/** Invite one or more musicians to one of the viewer's open postings. */
export function InviteModal({ musicians, onClose, createHref }: { musicians: { id: ID; name: string }[]; onClose: () => void; createHref: string }) {
  const viewer = useViewer();
  const postings = useApiQuery(['postings', viewer.id], () => api.listPostings(viewer.id));
  const open = postings.data?.filter((p) => p.opportunity.status === 'open') ?? [];
  const [oppId, setOppId] = useState<ID>('');
  const [message, setMessage] = useState('');
  const chosen = oppId || open[0]?.opportunity.id || '';
  const invite = useApiMutation(() => api.invite(chosen, musicians.map((m) => m.id), message, viewer.id), {
    success: (apps) => (apps.length ? plural(apps.length, 'Invitation sent to {n} musician.', 'Invitations sent to {n} musicians.') : t('They had already been invited or had applied.')),
    onDone: onClose,
  });
  const names = musicians.length <= 2 ? musicians.map((m) => m.name).join(' & ') : t('{n} musicians', { n: musicians.length });
  return (
    <Modal
      title={t('Invite {names}', { names })}
      kicker={t('Invitation')}
      onClose={onClose}
      footer={
        open.length > 0 ? (
          <>
            <button type="button" className="btn btn--ghost" onClick={onClose}>{t('Cancel')}</button>
            <button type="button" className="btn btn--primary" disabled={!chosen || invite.isPending} onClick={() => invite.mutate(undefined)}>
              <Send size={15} aria-hidden /> {t('Send invitation')}
            </button>
          </>
        ) : undefined
      }
    >
      {postings.isLoading ? (
        <p className="muted">{t('Loading your postings…')}</p>
      ) : postings.isError ? (
        <p style={{ color: 'var(--urgent)' }}>{t('Your postings could not be loaded. Close this window and try again.')}</p>
      ) : open.length === 0 ? (
        <div className="stack">
          <p className="soft">{t('An invitation always points to a posting, so the musician sees the dates, the repertoire and the fee before answering. You have no open posting yet.')}</p>
          <Link to={createHref} className="btn btn--primary" onClick={onClose}>{t('Post the opportunity first')}</Link>
        </div>
      ) : (
        <div className="stack stack--lg">
          <fieldset className="stack stack--sm" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="field__label" style={{ marginBottom: 8 }}>{t('To which opportunity?')}</legend>
            {open.map((p) => (
              <label key={p.opportunity.id} className={`pick${chosen === p.opportunity.id ? ' is-on' : ''}`}>
                <span className="check">
                  <input type="radio" name="opp" checked={chosen === p.opportunity.id} onChange={() => setOppId(p.opportunity.id)} />
                </span>
                <span className="grow">
                  <span style={{ fontWeight: 600, display: 'block' }}>{p.opportunity.title}</span>
                  <span className="tiny muted">
                    {keyDate(p.opportunity) ? fmt.day(keyDate(p.opportunity)!) : ''} · {p.opportunity.place.name}
                  </span>
                </span>
                <FeeBlock fee={p.opportunity.fee} />
              </label>
            ))}
            <Link to={createHref} className="link small" style={{ marginTop: 4 }} onClick={onClose}>{t('Or post a new opportunity')}</Link>
          </fieldset>
          <Field label={t('A personal note (optional)')}>
            <textarea className="textarea" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t('Why you thought of them, and anything not in the posting.')} />
          </Field>
        </div>
      )}
    </Modal>
  );
}

/** A search query carried into the "post an opportunity" form. */
export function postHrefFromQuery(q: Pick<MusicianQuery, 'instruments' | 'place' | 'date' | 'budget' | 'repertoire'>, urgent = false): string {
  const p = new URLSearchParams();
  if (q.instruments.length) p.set('i', q.instruments.join(','));
  if (q.place?.cityId) p.set('city', q.place.cityId);
  if (q.date) p.set('d', q.date);
  if (q.budget) p.set('fee', String(q.budget));
  if (q.repertoire) p.set('rep', q.repertoire);
  const qs = p.toString();
  return `${urgent ? '/opportunities/urgent' : '/opportunities/new'}${qs ? `?${qs}` : ''}`;
}

// ── Opportunities ────────────────────────────────────────────────────────

export function TypeTag({ o }: { o: Opportunity }) {
  if (o.urgent) return <span className="tag tag--urgent"><Zap size={11} aria-hidden />{t('Urgent')}</span>;
  return <span className="tag tag--line">{t(OPPORTUNITY_TYPE_LABELS[o.type])}</span>;
}

export function travelLabel(o: Pick<Opportunity, 'travel'>): string {
  return o.travel === 'travel-accommodation' ? t('Travel and accommodation covered') : o.travel === 'travel' ? t('Travel covered') : t('Travel not covered');
}

export function datesSummary(o: Opportunity): string {
  const key = keyDate(o);
  if (!key) return '';
  const perf = o.dates.filter((d) => d.kind === 'performance');
  const reh = o.dates.filter((d) => d.kind === 'rehearsal' || d.kind === 'dress');
  if (o.dates[0]?.kind === 'start' && perf.length === 0) return t('From {date}', { date: fmt.date(key) });
  if (o.dates.some((d) => d.kind === 'audition') && perf.length === 0) return t('Audition {date}', { date: fmt.date(key) });
  const parts = [fmt.day(key) + (perf.length > 1 ? ` +${perf.length - 1}` : '')];
  if (reh.length) parts.push(plural(reh.length, '{n} rehearsal', '{n} rehearsals'));
  return parts.join(' · ');
}

export function OpportunityCard({ view, compact = false, to }: { view: OpportunityView; compact?: boolean; to?: string }) {
  const o = view.opportunity;
  const fit = view.fit;
  const status = view.myApplication?.status;
  return (
    <Link to={to ?? `/opportunities/${o.id}`} className={`opp${o.urgent ? ' opp--urgent' : ''}`}>
      <div className="opp__main">
        <div className="row row--wrap" style={{ gap: 8 }}>
          <TypeTag o={o} />
          {o.urgent && <span className="tiny muted">{t('posted {when}', { when: fmt.ago(o.createdAt) })}</span>}
          {status && <ApplicationStatusTag status={status} />}
        </div>
        <h3 className="h-card opp__title">{o.title}</h3>
        <div className="small soft">{view.organisation?.name ?? view.poster.name}</div>
        <div className="meta" style={{ marginTop: 8 }}>
          <span><CalendarDays size={14} aria-hidden />{datesSummary(o)}</span>
          <span>
            <MapPin size={14} aria-hidden />
            {o.place.name}
            {fit && ` · ${fmt.km(fit.distanceKm)}`}
          </span>
          {o.travel !== 'none' && (
            <span>{o.travel === 'travel-accommodation' ? <BedDouble size={14} aria-hidden /> : <Train size={14} aria-hidden />}{travelLabel(o)}</span>
          )}
          {o.deadline && !o.urgent && <span><Clock size={14} aria-hidden />{t('Apply by {date}', { date: fmt.date(o.deadline) })}</span>}
        </div>
        {!compact && o.repertoire.length > 0 && (
          <div className="opp__rep small">
            {o.repertoire.slice(0, 3).map((r) => `${r.composer}: ${r.work}`).join(' · ')}
            {o.repertoire.length > 3 && ` +${o.repertoire.length - 3}`}
          </div>
        )}
        {fit && !compact && (fit.known.length > 0 || fit.clashes.length > 0) && (
          <div className="row row--wrap" style={{ gap: 6, marginTop: 10 }}>
            {fit.known.length > 0 && (
              <span className="tag tag--ok">
                <Check size={12} aria-hidden />
                {o.repertoire.length === fit.known.length ? t('You have played the whole programme') : t('You have played {n} of {total}', { n: fit.known.length, total: o.repertoire.length })}
              </span>
            )}
            {fit.clashes.length > 0 && <span className="tag tag--warn">{plural(fit.clashes.length, '{n} date clashes with your calendar', '{n} dates clash with your calendar')}</span>}
          </div>
        )}
      </div>
      <div className="opp__fee">
        <FeeBlock fee={o.fee} />
        {o.fee.note && !compact && <span className="tiny muted opp__fee-note">{o.fee.note}</span>}
      </div>
    </Link>
  );
}

const STATUS_LABEL: Record<string, [string, string]> = {
  invited: ['Invited — awaiting your answer', 'tag--accent'],
  applied: ['Applied', 'tag--line'],
  shortlisted: ['Shortlisted', 'tag--ok'],
  offered: ['Offer received', 'tag--accent'],
  confirmed: ['Confirmed', 'tag--ok'],
  declined: ['Not selected', ''],
  unavailable: ['You declined', ''],
  withdrawn: ['Withdrawn', ''],
};

/** Status of an application, in the musician's words. */
export function ApplicationStatusTag({ status }: { status: string }) {
  const [label, cls] = STATUS_LABEL[status] ?? [status, ''];
  return <span className={`tag ${cls}`}>{t(label)}</span>;
}

// ── Concerts ─────────────────────────────────────────────────────────────

export function Programme({ items, known, tight = false }: { items: ProgrammeItem[]; known?: (item: ProgrammeItem) => ReactNode; tight?: boolean }) {
  return (
    <ul className={`programme${tight ? ' programme--tight' : ''}`}>
      {items.map((p, k) => (
        <li key={k}>
          <b>{p.composer}</b>
          <span>
            {p.work}
            {known?.(p)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ConcertItem({ c, focusId, showPeople = false }: { c: ConcertView; focusId?: ID; showPeople?: boolean }) {
  const me = focusId ? c.participants.find((p) => p.musicianId === focusId) : undefined;
  const others = c.participants.filter((p) => p.musicianId !== focusId);
  return (
    <li className="concert">
      <div className="concert__date">
        <span className="concert__day num">{c.date.slice(8)}</span>
        <span className="concert__month">{fmt.monthShort(c.date)}</span>
        <span className="concert__year num">{c.date.slice(0, 4)}</span>
      </div>
      <div className="concert__body">
        <div className="concert__where">
          <Link to={`/events/${c.id}`}>
            {c.title && <span className="serif-italic">{c.title} · </span>}
            {c.venue}, {c.city}
          </Link>
          <span className={`tag concert__verify${c.verified ? ' tag--ok' : ' tag--warn'}`} title={c.verified ? t('Confirmed by others in the lineup') : t('Added by the musician; not yet confirmed by anyone else')}>
            {c.verified ? t('Verified') : t('Self-added')}
          </span>
        </div>
        <div className="small soft" style={{ marginBottom: 6 }}>
          {c.orgSlug ? <Link className="link" to={`/ensembles/${c.orgSlug}`}>{c.ensembleName}</Link> : c.ensembleName}
          {c.conductor && ` · ${t('cond. {name}', { name: c.conductor })}`}
          {me && <span className="tag" style={{ marginLeft: c.ensembleName ? 8 : 0 }}>{me.role}</span>}
        </div>
        <Programme items={c.programme} tight />
        {showPeople && others.length > 0 && (
          <div className="concert__people small">
            <span className="muted">{t('With')} </span>
            {others.slice(0, 8).map((p, k) => (
              <span key={p.musicianId}>
                {k > 0 && ', '}
                <Link className="link" to={`/musicians/${p.slug}`}>{p.name}</Link>
              </span>
            ))}
            {others.length > 8 && <span className="muted"> {t('and {n} more', { n: others.length - 8 })}</span>}
          </div>
        )}
      </div>
    </li>
  );
}

export function instrumentListLabel(ids: string[]): string {
  if (!ids.length) return t('Any instrument');
  return ids.slice(0, 4).map((i) => t(instrumentName(i))).join(', ') + (ids.length > 4 ? ` +${ids.length - 4}` : '');
}
