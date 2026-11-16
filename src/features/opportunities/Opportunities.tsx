import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, BedDouble, Briefcase, CalendarDays, Check, CircleAlert, Clock, MapPin, Music2, Plus, Send, Shirt, SlidersHorizontal, Train, Users, Zap } from 'lucide-react';
import { useViewer } from '../../app/session';
import type { OpportunityView } from '../../data/api';
import { api } from '../../data/client';
import { useApiMutation, useApiQuery } from '../../data/hooks';
import { today } from '../../domain/dates';
import { EMPTY_OPPORTUNITY_QUERY, type OpportunityQuery } from '../../domain/search/opportunities';
import { OPPORTUNITY_TYPE_LABELS } from '../../domain/taxonomy';
import type { OpportunityDateKind, OpportunityType } from '../../domain/types';
import { fmt, plural, t } from '../../i18n';
import { Async, Avatar, EmptyState, ErrorState, FeeBlock, Field, Modal, SkeletonList } from '../../ui/basics';
import { MapView } from '../../ui/MapView';
import { CityPicker, InstrumentPicker } from '../../ui/pickers';
import { ApplicationStatusTag, instrumentListLabel, MessageButton, OpportunityCard, RepertoireStatus, travelLabel, TypeTag } from '../shared';

const TYPE_TABS: [OpportunityType | 'all' | 'urgent', string][] = [
  ['all', 'All'],
  ['urgent', 'Urgent'],
  ['engagement', 'Engagements'],
  ['audition', 'Auditions'],
  ['position', 'Positions'],
  ['teaching', 'Teaching'],
];

function BoardFilters({ q, set, mine, baseName }: { q: OpportunityQuery; set: (p: Partial<OpportunityQuery>) => void; mine: string[]; baseName?: string }) {
  const onlyMine = mine.length > 0 && q.instruments.length === mine.length && mine.every((i) => q.instruments.includes(i));
  return (
    <div className="filters">
      {mine.length > 0 && (
        <label className="check">
          <input type="checkbox" checked={onlyMine} onChange={(e) => set({ instruments: e.target.checked ? mine : [] })} />
          {t('Only for my instruments')}
        </label>
      )}
      <Field label={t('Instrument or voice')}>
        <InstrumentPicker value={q.instruments} onChange={(instruments) => set({ instruments })} small />
      </Field>
      <Field label={t('Near')} hint={baseName && !q.place ? t('Leave empty to see everywhere. You are based in {city}.', { city: baseName }) : undefined}>
        <CityPicker value={q.place?.name ?? ''} small onPick={(c) => set({ place: c ? { name: c.name, lat: c.lat, lng: c.lng, cityId: c.id } : undefined })} />
      </Field>
      {q.place && (
        <Field label={t('Within')}>
          <div className="segmented segmented--fill" role="group">
            {[50, 100, 200, 500].map((r) => (
              <button key={r} type="button" aria-pressed={q.radiusKm === r} onClick={() => set({ radiusKm: r })}>{r}</button>
            ))}
            <span className="segmented__unit">km</span>
          </div>
        </Field>
      )}
      <Field label={t('Fee at least')}>
        <div className="affix"><span>€</span><input type="number" className="input input--sm" min={0} step={10} value={q.minFee ?? ''} placeholder={t('Any')} onChange={(e) => set({ minFee: e.target.value ? Number(e.target.value) : undefined })} /></div>
      </Field>
      <label className="check"><input type="checkbox" checked={q.travelCovered} onChange={(e) => set({ travelCovered: e.target.checked })} />{t('Travel covered')}</label>
      <Field label={t('Keyword')}>
        <input className="input input--sm" value={q.text} onChange={(e) => set({ text: e.target.value })} placeholder={t('Composer, city, ensemble…')} />
      </Field>
    </div>
  );
}

export function OpportunitiesPage() {
  const viewer = useViewer();
  const mine = useMemo(() => viewer.musician?.instruments.map((p) => p.instrumentId) ?? [], [viewer.musician]);
  const [q, setQ] = useState<OpportunityQuery | null>(null);
  const [tab, setTab] = useState<(typeof TYPE_TABS)[number][0]>('all');
  const [sheet, setSheet] = useState(false);
  // Musicians start with the board filtered to what they play.
  const query: OpportunityQuery = q ?? { ...EMPTY_OPPORTUNITY_QUERY, instruments: mine };
  const set = (p: Partial<OpportunityQuery>) => setQ({ ...query, ...p });
  const full: OpportunityQuery = { ...query, types: tab === 'all' || tab === 'urgent' ? [] : [tab], urgentOnly: tab === 'urgent' };
  const list = useApiQuery(['opportunities', full, viewer.id], () => api.listOpportunities(full, viewer.id), { enabled: !!viewer.account, placeholderData: (p) => p });
  const filterCount = (query.instruments.length ? 1 : 0) + (query.place ? 1 : 0) + (query.minFee ? 1 : 0) + (query.travelCovered ? 1 : 0) + (query.text.trim() ? 1 : 0);

  return (
    <div className="wrap page">
      <div className="page__head">
        <div>
          <div className="label">{t('Opportunities')}</div>
          <h1 className="h-page">{t('Work, with the fee on the first line')}</h1>
          <p className="page__sub">{t('Every posting states what it pays, when the rehearsals are and what is covered.')}</p>
        </div>
        <div className="row">
          <Link to="/opportunities/urgent" className="btn btn--urgent"><Zap size={15} aria-hidden />{t('Find a substitute')}</Link>
          <Link to="/opportunities/new" className="btn btn--primary"><Plus size={15} aria-hidden />{t('Post an opportunity')}</Link>
        </div>
      </div>

      <div className="tabs" role="tablist" style={{ marginBottom: 24 }}>
        {TYPE_TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className="tab" onClick={() => setTab(id)}>
            {id === 'urgent' && <Zap size={14} aria-hidden style={{ color: 'var(--urgent)' }} />}
            {t(label)}
          </button>
        ))}
      </div>

      <div className="search__layout">
        <aside className="search__filters">
          <div className="row row--between" style={{ marginBottom: 14 }}>
            <span className="label">{t('Filters')}</span>
            {filterCount > 0 && <button type="button" className="link small" onClick={() => setQ({ ...EMPTY_OPPORTUNITY_QUERY, sort: query.sort })}>{t('Clear all')}</button>}
          </div>
          <BoardFilters q={query} set={set} mine={mine} baseName={viewer.account?.base.name} />
        </aside>
        <section>
          <div className="search__toolbar">
            <button type="button" className="btn btn--ghost btn--sm search__filter-btn" onClick={() => setSheet(true)}>
              <SlidersHorizontal size={15} aria-hidden /> {t('Filters')}
              {filterCount > 0 && <span className="count">{filterCount}</span>}
            </button>
            <div className="grow search__count">{list.data ? <b>{plural(list.data.length, '{n} open opportunity', '{n} open opportunities')}</b> : <span className="muted">{t('Loading…')}</span>}</div>
            <select className="select select--sm" style={{ width: 'auto' }} value={query.sort} onChange={(e) => set({ sort: e.target.value as OpportunityQuery['sort'] })} aria-label={t('Sort by')}>
              <option value="recent">{t('Newest first')}</option>
              <option value="date">{t('Soonest date')}</option>
              <option value="fee">{t('Highest fee')}</option>
              <option value="distance" disabled={!query.place}>{t('Nearest')}</option>
            </select>
          </div>
          {list.isError ? (
            <ErrorState error={list.error} onRetry={() => void list.refetch()} />
          ) : !list.data ? (
            <SkeletonList rows={4} height={150} />
          ) : list.data.length === 0 ? (
            <EmptyState
              icon={<Briefcase size={22} aria-hidden />}
              title={t('Nothing open for that right now')}
              text={t('Try another type, remove a filter, or look beyond your own instruments. New postings appear here as soon as they are published.')}
              action={<button type="button" className="btn btn--ghost btn--sm" onClick={() => { setQ({ ...EMPTY_OPPORTUNITY_QUERY }); setTab('all'); }}>{t('Show everything')}</button>}
            />
          ) : (
            <div className="stack">{list.data.map((v) => <OpportunityCard key={v.opportunity.id} view={v} />)}</div>
          )}
        </section>
      </div>
      {sheet && (
        <Modal title={t('Filters')} onClose={() => setSheet(false)} footer={<button type="button" className="btn btn--primary" onClick={() => setSheet(false)}>{t('Show results')}</button>}>
          <BoardFilters q={query} set={set} mine={mine} baseName={viewer.account?.base.name} />
        </Modal>
      )}
    </div>
  );
}

const DATE_KIND: Record<OpportunityDateKind, string> = { rehearsal: 'Rehearsal', dress: 'Dress rehearsal', performance: 'Performance', audition: 'Audition', start: 'Start' };

function ApplyBox({ view }: { view: OpportunityView }) {
  const viewer = useViewer();
  const o = view.opportunity;
  const app = view.myApplication;
  const fit = view.fit;
  const [message, setMessage] = useState('');
  const apply = useApiMutation(() => api.apply(o.id, viewer.id, message), { success: t('Application sent to {name}.', { name: view.poster.name }) });
  const respond = useApiMutation((accept: boolean) => api.respond(app!.id, viewer.id, accept, message), {
    success: (r) => (r.status === 'confirmed' ? t('Confirmed. The dates are now in your calendar.') : r.status === 'applied' ? t('Sent — {name} knows you are available.', { name: view.poster.name }) : t('Declined. {name} has been told.', { name: view.poster.name })),
  });
  const withdraw = useApiMutation(() => api.withdraw(app!.id, viewer.id), { success: t('Application withdrawn.') });
  const busy = fit?.clashes.filter((c) => c.status === 'busy') ?? [];

  if (view.isMine) {
    return (
      <div className="applybox card card--pad">
        <div className="label">{t('Your posting')}</div>
        <p className="small soft" style={{ margin: '6px 0 14px' }}>{plural(view.applicants, '{n} musician has responded so far.', '{n} musicians have responded so far.')}</p>
        <Link to={`/hiring/${o.id}`} className="btn btn--primary btn--block"><Users size={15} aria-hidden />{t('Review applicants')}</Link>
      </div>
    );
  }
  if (!viewer.isMusician) {
    return (
      <div className="applybox card card--pad">
        <div className="label">{t('Applying')}</div>
        <p className="small soft" style={{ marginTop: 6 }}>{t('Musicians apply from their profile. You are signed in as an organiser — switch to a musician persona to apply.')}</p>
      </div>
    );
  }
  if (o.status !== 'open' && (!app || !['confirmed', 'offered'].includes(app.status))) {
    return (
      <div className="applybox card card--pad">
        <div className="label">{o.status === 'filled' ? t('Filled') : t('Closed')}</div>
        <p className="small soft" style={{ marginTop: 6 }}>{t('This opportunity is no longer open.')}</p>
        {app && <div style={{ marginTop: 10 }}><ApplicationStatusTag status={app.status} /></div>}
      </div>
    );
  }
  const note = (
    <Field label={t('A note to {name} (optional)', { name: view.poster.name.split(' ')[0] })}>
      <textarea className="textarea" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t('Have you played the piece? Are you free for every date? Anything they should know.')} />
    </Field>
  );
  return (
    <div className={`applybox card card--pad${o.urgent ? ' applybox--urgent' : ''}`}>
      {fit && (
        <ul className="fitlist">
          <li className={fit.instrumentMatch ? 'is-ok' : 'is-warn'}>{fit.instrumentMatch ? <Check size={15} aria-hidden /> : <CircleAlert size={15} aria-hidden />}{fit.instrumentMatch ? t('Matches what you play') : t('Asks for an instrument you have not listed')}</li>
          <li className={fit.withinTravelRadius ? 'is-ok' : 'is-warn'}>{fit.withinTravelRadius ? <Check size={15} aria-hidden /> : <CircleAlert size={15} aria-hidden />}{t('{km} from {city}', { km: fmt.km(fit.distanceKm), city: viewer.musician?.base.name ?? '' })}{!fit.withinTravelRadius && ` — ${t('beyond your usual radius')}`}</li>
          {o.dates.some((d) => d.kind !== 'start') && (
            <li className={fit.clashes.length ? 'is-warn' : 'is-ok'}>{fit.clashes.length ? <CircleAlert size={15} aria-hidden /> : <Check size={15} aria-hidden />}{fit.clashes.length ? t('Calendar clash: {dates}', { dates: fit.clashes.map((c) => fmt.day(c.date)).join(', ') }) : t('You are free on every date')}</li>
          )}
          {o.repertoire.length > 0 && (
            <li className={fit.known.length ? 'is-ok' : ''}>{fit.known.length ? <Check size={15} aria-hidden /> : <Music2 size={15} aria-hidden />}{fit.known.length ? t('In your repertoire: {n} of {total}', { n: fit.known.length, total: o.repertoire.length }) : t('None of the programme is in your repertoire yet')}</li>
          )}
        </ul>
      )}
      {!app || app.status === 'withdrawn' || app.status === 'unavailable' ? (
        <div className="stack">
          {note}
          {busy.length > 0 && <p className="tiny" style={{ color: 'var(--warn)' }}>{t('You are marked busy on {dates}. You can still apply — say so in your note.', { dates: busy.map((c) => fmt.day(c.date)).join(', ') })}</p>}
          <button type="button" className={`btn btn--block ${o.urgent ? 'btn--urgent' : 'btn--primary'}`} disabled={apply.isPending} onClick={() => apply.mutate(undefined)}>
            <Send size={15} aria-hidden /> {o.urgent ? t('I can do it') : o.type === 'audition' ? t('Apply for the audition') : t('Apply')}
          </button>
        </div>
      ) : app.status === 'invited' ? (
        <div className="stack">
          <div>
            <div className="label label--accent">{o.urgent ? t('Urgent call for you') : t('You are invited')}</div>
            {app.inviteMessage && <blockquote className="invite-note">“{app.inviteMessage}” <span className="muted">— {view.poster.name}</span></blockquote>}
          </div>
          {note}
          <div className="row">
            <button type="button" className={`btn grow ${o.urgent ? 'btn--urgent' : 'btn--primary'}`} disabled={respond.isPending} onClick={() => respond.mutate(true)}>{o.urgent ? t('I can do it') : t('I’m interested')}</button>
            <button type="button" className="btn btn--ghost grow" disabled={respond.isPending} onClick={() => respond.mutate(false)}>{t('Decline')}</button>
          </div>
        </div>
      ) : app.status === 'offered' ? (
        <div className="stack">
          <div>
            <div className="label label--accent">{t('You have an offer')}</div>
            <p className="small soft" style={{ marginTop: 6 }}>{t('{name} would like to engage you. Confirming blocks the dates in your calendar.', { name: view.poster.name })}</p>
          </div>
          <div className="row">
            <button type="button" className="btn btn--accent grow" disabled={respond.isPending} onClick={() => respond.mutate(true)}><Check size={15} aria-hidden />{t('Confirm engagement')}</button>
            <button type="button" className="btn btn--ghost" disabled={respond.isPending} onClick={() => respond.mutate(false)}>{t('Decline')}</button>
          </div>
        </div>
      ) : (
        <div className="stack">
          <div className="row row--between">
            <ApplicationStatusTag status={app.status} />
            <span className="tiny muted">{fmt.ago(app.updatedAt)}</span>
          </div>
          {app.message && <p className="small soft">“{app.message}”</p>}
          <p className="small muted">
            {app.status === 'confirmed' ? t('You are engaged for this. The dates are in your calendar.') : app.status === 'declined' ? t('This went to someone else. Thank you for applying.') : app.status === 'shortlisted' ? t('You are on the shortlist. {name} will be in touch.', { name: view.poster.name }) : t('{name} has your application.', { name: view.poster.name })}
          </p>
          {app.status !== 'declined' && (
            <button type="button" className="btn btn--quiet btn--sm" disabled={withdraw.isPending} onClick={() => window.confirm(app.status === 'confirmed' ? t('Withdraw from a confirmed engagement? The organiser will be told.') : t('Withdraw your application?')) && withdraw.mutate(undefined)}>
              {t('Withdraw')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ view }: { view: OpportunityView }) {
  const o = view.opportunity;
  const fit = view.fit;
  const known = (composer: string, work: string) => fit?.known.find((k) => k.item.composer === composer && k.item.work === work)?.repertoire;
  return (
    <div className="wrap page">
      <Link to="/opportunities" className="btn btn--quiet btn--sm" style={{ marginLeft: -10, marginBottom: 12 }}>
        <ArrowLeft size={15} aria-hidden /> {t('All opportunities')}
      </Link>
      <div className="cols oppd">
        <article>
          <div className="row row--wrap" style={{ gap: 8, marginBottom: 12 }}>
            <TypeTag o={o} />
            {!o.urgent && o.type === 'substitution' && <span className="tag tag--line">{t('Substitution')}</span>}
            {o.status !== 'open' && <span className="tag">{o.status === 'filled' ? t('Filled') : t('Closed')}</span>}
            <span className="tiny muted">{t('posted {when}', { when: fmt.ago(o.createdAt) })}</span>
          </div>
          <h1 className="display oppd__title">{o.title}</h1>
          <div className="oppd__poster">
            <Avatar name={view.organisation?.name ?? view.poster.name} tint={view.poster.tint} org={!!view.organisation} size="sm" />
            <span>
              {view.organisation ? <Link className="link" to={`/ensembles/${view.organisation.slug}`}>{view.organisation.name}</Link> : view.poster.slug ? <Link className="link" to={`/musicians/${view.poster.slug}`}>{view.poster.name}</Link> : <b>{view.poster.name}</b>}
              {view.organisation && <span className="muted"> · {view.poster.name}</span>}
            </span>
          </div>

          <div className="oppd__fee">
            <div>
              <div className="label">{t('Fee')}</div>
              <FeeBlock fee={o.fee} size="lg" />
              {o.fee.note && <div className="small soft">{o.fee.note}</div>}
            </div>
            <div className="oppd__facts">
              <div className="icon-line"><Users size={15} aria-hidden /><span><b>{instrumentListLabel(o.instruments)}</b>{o.roleLabel ? ` · ${o.roleLabel}` : ''}</span></div>
              <div className="icon-line"><MapPin size={15} aria-hidden /><span>{o.place.venue ? `${o.place.venue}, ` : ''}{o.place.name}</span></div>
              <div className="icon-line">{o.travel === 'travel-accommodation' ? <BedDouble size={15} aria-hidden /> : <Train size={15} aria-hidden />}<span>{travelLabel(o)}{o.travelNote ? ` — ${o.travelNote}` : ''}</span></div>
              {o.dressCode && <div className="icon-line"><Shirt size={15} aria-hidden /><span>{t('Dress')}: {o.dressCode}</span></div>}
              {o.pitch && <div className="icon-line"><Music2 size={15} aria-hidden /><span>{t('Pitch')}: A={o.pitch}</span></div>}
              {o.deadline && <div className="icon-line"><Clock size={15} aria-hidden /><span>{o.deadline < today() ? t('Deadline passed on {date}', { date: fmt.date(o.deadline) }) : t('Apply by {date}', { date: fmt.date(o.deadline) })}</span></div>}
            </div>
          </div>

          <section className="section">
            <div className="section__head"><h2 className="h-section">{t('Dates')}</h2></div>
            <table className="dates">
              <tbody>
                {o.dates.map((d, k) => {
                  const clash = fit?.clashes.find((c) => c.date === d.date);
                  return (
                    <tr key={k} className={d.kind === 'performance' || d.kind === 'audition' ? 'is-key' : ''}>
                      <td className="num nowrap"><CalendarDays size={14} aria-hidden style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6, color: 'var(--ink-3)' }} />{fmt.day(d.date)} {d.date.slice(0, 4)}</td>
                      <td className="num">{d.time ?? ''}</td>
                      <td>
                        <b>{t(DATE_KIND[d.kind])}</b>
                        {d.note ? <span className="soft"> — {d.note}</span> : ''}
                        {clash && <span className="tag tag--warn" style={{ marginLeft: 8 }}>{clash.status === 'busy' ? t('you are busy') : t('pencilled in your calendar')}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {o.repertoire.length > 0 && (
            <section className="section">
              <div className="section__head">
                <h2 className="h-section">{o.type === 'audition' ? t('Audition repertoire') : t('Repertoire')}</h2>
                {fit && <span className="small muted">{t('ticked against your own')}</span>}
              </div>
              <ul className="programme oppd__programme">
                {o.repertoire.map((p, k) => {
                  const mine = known(p.composer, p.work);
                  return (
                    <li key={k}>
                      <b>{p.composer}</b>
                      <span className="row row--between" style={{ alignItems: 'baseline' }}>
                        <span>{p.work}</span>
                        {mine && <RepertoireStatus status={mine.status} year={mine.lastPerformed} />}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="section">
            <div className="section__head"><h2 className="h-section">{t('About this engagement')}</h2></div>
            <div className="prose">{o.description.split('\n').map((p, k) => <p key={k}>{p}</p>)}</div>
          </section>

          <section className="section no-print">
            <div className="section__head"><h2 className="h-section">{t('Where')}</h2></div>
            <div className="oppd__map"><MapView markers={[]} center={{ lat: o.place.lat, lng: o.place.lng }} radiusKm={8} interactive={false} /></div>
          </section>
        </article>

        <aside className="oppd__side">
          <ApplyBox view={view} />
          {!view.isMine && (
            <div className="card card--pad">
              <div className="label" style={{ marginBottom: 10 }}>{t('Posted by')}</div>
              <div className="mini" style={{ marginBottom: 12 }}>
                <Avatar name={view.poster.name} tint={view.poster.tint} />
                <span className="grow">
                  <span className="mini__name">{view.poster.name}</span>
                  <span className="mini__sub" style={{ whiteSpace: 'normal' }}>{view.poster.title}</span>
                </span>
              </div>
              <MessageButton to={{ id: view.poster.id, name: view.poster.name }} opportunityId={o.id} />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export function OpportunityPage() {
  const { id = '' } = useParams();
  const viewer = useViewer();
  const view = useApiQuery(['opportunity', id, viewer.id], () => api.getOpportunity(id, viewer.id));
  return <Async query={view} page>{(v) => <Detail view={v} key={v.opportunity.id} />}</Async>;
}

/** The musician's side of the pipeline: invitations, offers, applications. */
export function ApplicationsPage() {
  const viewer = useViewer();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'past' ? 'past' : 'active';
  const list = useApiQuery(['my-applications', viewer.id], () => api.listMyApplications(viewer.id), { enabled: viewer.isMusician });
  if (viewer.account && !viewer.isMusician) {
    return (
      <div className="wrap wrap--narrow page">
        <EmptyState title={t('Applications belong to musicians')} text={t('{name} hires rather than applies. Your postings and their applicants are under “My postings”.', { name: viewer.account.name })} action={<Link to="/hiring" className="btn btn--primary btn--sm">{t('My postings')}</Link>} />
      </div>
    );
  }
  const active = list.data?.filter((v) => ['invited', 'offered', 'applied', 'shortlisted', 'confirmed'].includes(v.application.status)) ?? [];
  const past = list.data?.filter((v) => !active.includes(v)) ?? [];
  const order = { invited: 0, offered: 0, confirmed: 1, shortlisted: 2, applied: 3 } as Record<string, number>;
  const shown = tab === 'active' ? [...active].sort((a, b) => (order[a.application.status] ?? 9) - (order[b.application.status] ?? 9)) : past;
  return (
    <div className="wrap wrap--narrow page">
      <div className="page__head">
        <div>
          <div className="label">{t('My work')}</div>
          <h1 className="h-page">{t('Applications and invitations')}</h1>
        </div>
      </div>
      <div className="tabs" role="tablist" style={{ marginBottom: 20 }}>
        <button type="button" role="tab" aria-selected={tab === 'active'} className="tab" onClick={() => setParams({}, { replace: true })}>{t('In progress')}{active.length > 0 && <span className="count">{active.length}</span>}</button>
        <button type="button" role="tab" aria-selected={tab === 'past'} className="tab" onClick={() => setParams({ tab: 'past' }, { replace: true })}>{t('Closed')}</button>
      </div>
      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : !list.data ? (
        <SkeletonList rows={3} height={110} />
      ) : shown.length === 0 ? (
        <EmptyState icon={<Briefcase size={22} aria-hidden />} title={tab === 'active' ? t('Nothing in progress') : t('Nothing here yet')} text={tab === 'active' ? t('When you apply to an opportunity or a hirer invites you, it appears here with its status.') : undefined} action={<Link to="/opportunities" className="btn btn--primary btn--sm">{t('Browse opportunities')}</Link>} />
      ) : (
        <div className="stack">
          {shown.map((v) => (
            <Link key={v.application.id} to={`/opportunities/${v.opportunity.id}`} className={`opp${v.opportunity.urgent && v.application.status === 'invited' ? ' opp--urgent' : ''}`}>
              <div className="opp__main">
                <div className="row row--wrap" style={{ gap: 8 }}>
                  <ApplicationStatusTag status={v.application.status} />
                  {v.opportunity.urgent && <span className="tag tag--urgent"><Zap size={11} aria-hidden />{t('Urgent')}</span>}
                  <span className="tiny muted">{fmt.ago(v.application.updatedAt)}</span>
                </div>
                <h3 className="h-card opp__title">{v.opportunity.title}</h3>
                <div className="small soft">{v.organisation?.name ?? v.poster.name} · {v.opportunity.place.name} · {t(OPPORTUNITY_TYPE_LABELS[v.opportunity.type])}</div>
                {v.application.status === 'invited' && v.application.inviteMessage && <p className="small soft" style={{ marginTop: 8 }}>“{v.application.inviteMessage}”</p>}
              </div>
              <div className="opp__fee"><FeeBlock fee={v.opportunity.fee} /></div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
