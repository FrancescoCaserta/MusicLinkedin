import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CornerDownLeft, List, Map as MapIcon, Search, SearchX, Send, SlidersHorizontal, X, Zap } from 'lucide-react';
import { useViewer } from '../../app/session';
import type { SearchHit } from '../../data/api';
import { api } from '../../data/client';
import { useApiQuery } from '../../data/hooks';
import { addDays, today } from '../../domain/dates';
import { RADIUS_STEPS } from '../../domain/geo';
import { parseQuery } from '../../domain/search/parse';
import { countFilters, EMPTY_QUERY, isEmptyQuery, paramsToQuery, queryToParams, type MusicianQuery, type SortKey } from '../../domain/search/query';
import { ROLES } from '../../domain/taxonomy';
import type { RoleId } from '../../domain/types';
import { plural, t } from '../../i18n';
import { Avatar, EmptyState, ErrorState, Field, instrumentsLine, Modal, SkeletonList } from '../../ui/basics';
import { MapView } from '../../ui/MapView';
import { CityPicker, InstrumentPicker, RepertoireInput } from '../../ui/pickers';
import { InviteModal, MatchReasons, MessageButton, postHrefFromQuery, ShortlistButton } from '../shared';
import { queryChips, relaxationLabel } from './chips';

const EXAMPLES = ['Accordionist within 50 km of Bologna, free on 14 March, budget €250', 'Soprano for Mozart Requiem near Modena', 'Harpsichord continuo player, period instruments, near Venice', 'Cellist near Bologna this Saturday, urgent'];

/** The sentence bar: type what you need, see what was understood, press Enter. */
function AskBar({ onSubmit }: { onSubmit: (patch: Partial<MusicianQuery>) => void }) {
  const [text, setText] = useState('');
  const [focus, setFocus] = useState(false);
  const parsed = useMemo(() => parseQuery(text, today()), [text]);
  const preview = queryChips({ ...EMPTY_QUERY, ...parsed.patch });
  const submit = () => {
    if (!text.trim()) return;
    onSubmit(parsed.patch);
    setText('');
  };
  return (
    <div className="ask">
      <form
        className="ask__bar"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Search size={20} aria-hidden className="ask__icon" />
        <input
          className="ask__input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => window.setTimeout(() => setFocus(false), 150)}
          placeholder={t('Who do you need? e.g. “accordionist within 50 km of Bologna, free on 14 March, budget €250”')}
          aria-label={t('Describe the musician you are looking for')}
          spellCheck={false}
        />
        <button type="submit" className="btn btn--primary" disabled={!text.trim()}>
          {t('Search')}
        </button>
      </form>
      {focus && (
        <div className="ask__pop card card--lift">
          {text.trim() ? (
            <>
              <div className="label">{t('Understood as')}</div>
              <div className="row row--wrap" style={{ gap: 6, marginTop: 8 }}>
                {preview.map((c) => (
                  <span key={c.key} className="chip chip--filter" style={{ paddingRight: 10 }}>{c.label}</span>
                ))}
              </div>
              <div className="tiny muted" style={{ marginTop: 10 }}>
                <CornerDownLeft size={12} aria-hidden style={{ display: 'inline', verticalAlign: '-2px' }} /> {t('Press Enter to search. You can refine every part with the filters.')}
              </div>
            </>
          ) : (
            <>
              <div className="label">{t('Ask in a sentence')}</div>
              <ul className="ask__examples">
                {EXAMPLES.map((e) => (
                  <li key={e}>
                    <button type="button" onMouseDown={(ev) => ev.preventDefault()} onClick={() => setText(e)}>
                      {e}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Filters({ q, set }: { q: MusicianQuery; set: (patch: Partial<MusicianQuery>) => void }) {
  const toggleRole = (r: RoleId) => set({ roles: q.roles.includes(r) ? q.roles.filter((x) => x !== r) : [...q.roles, r] });
  return (
    <div className="filters">
      <Field label={t('Instrument or voice')}>
        <InstrumentPicker value={q.instruments} onChange={(instruments) => set({ instruments })} small />
      </Field>
      {q.instruments.length > 0 && (
        <label className="check small">
          <input type="checkbox" checked={!q.includeSecondary} onChange={(e) => set({ includeSecondary: !e.target.checked })} />
          {t('Main instrument only (no doublers)')}
        </label>
      )}
      <Field label={t('Near')}>
        <CityPicker value={q.place?.name ?? ''} small onPick={(c) => set({ place: c ? { name: c.name, lat: c.lat, lng: c.lng, cityId: c.id } : undefined })} />
      </Field>
      {q.place && (
        <Field label={t('Within')}>
          <div className="segmented segmented--fill" role="group" aria-label={t('Radius')}>
            {RADIUS_STEPS.slice(0, 5).map((r) => (
              <button key={r} type="button" aria-pressed={q.radiusKm === r} onClick={() => set({ radiusKm: r })}>
                {r}
              </button>
            ))}
            <span className="segmented__unit">km</span>
          </div>
        </Field>
      )}
      <div className="filters__pair">
        <Field label={t('Free on')}>
          <input type="date" className="input input--sm" value={q.date ?? ''} min={today()} onChange={(e) => set({ date: e.target.value || undefined, dateTo: undefined })} />
        </Field>
        <Field label={t('Until (optional)')}>
          <input type="date" className="input input--sm" value={q.dateTo ?? ''} min={q.date ?? today()} disabled={!q.date} onChange={(e) => set({ dateTo: e.target.value || undefined })} />
        </Field>
      </div>
      <Field label={t('Budget for the engagement')} hint={t('Compared with the lower end of each musician’s indicative fee.')}>
        <div className="affix">
          <span>€</span>
          <input type="number" className="input input--sm" inputMode="numeric" min={0} step={10} value={q.budget ?? ''} placeholder={t('Any')} onChange={(e) => set({ budget: e.target.value ? Math.max(0, Number(e.target.value)) : undefined })} />
        </div>
      </Field>
      <Field label={t('Has already played')} hint={t('Composer, work or part — e.g. “Brahms Requiem”, “Evangelist”.')}>
        <RepertoireInput value={q.repertoire} onChange={(repertoire) => set({ repertoire })} small />
      </Field>
      <div className="field">
        <span className="field__label">{t('Works as')}</span>
        <div className="row row--wrap" style={{ gap: 6 }}>
          {ROLES.map((r) => (
            <button key={r.id} type="button" className={`chip${q.roles.includes(r.id) ? ' is-on' : ''}`} aria-pressed={q.roles.includes(r.id)} onClick={() => toggleRole(r.id)}>
              {t(r.label)}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span className="field__label">{t('Also')}</span>
        <label className="check"><input type="checkbox" checked={q.periodOnly} onChange={(e) => set({ periodOnly: e.target.checked })} />{t('Plays period instruments')}</label>
        <label className="check"><input type="checkbox" checked={q.urgentOnly} onChange={(e) => set({ urgentOnly: e.target.checked })} />{t('Takes last-minute calls')}</label>
        <label className="check"><input type="checkbox" checked={q.networkOnly} onChange={(e) => set({ networkOnly: e.target.checked })} />{t('In my network')}</label>
        <label className="check"><input type="checkbox" checked={q.invoiceOnly} onChange={(e) => set({ invoiceOnly: e.target.checked })} />{t('Can invoice')}</label>
      </div>
      <Field label={t('Name or keyword')}>
        <input className="input input--sm" value={q.text} onChange={(e) => set({ text: e.target.value })} placeholder={t('e.g. a surname')} />
      </Field>
    </div>
  );
}

function ResultCard({ hit, rank, q, active, selected, onSelect, onHover, onInvite }: { hit: SearchHit; rank: number; q: MusicianQuery; active: boolean; selected: boolean; onSelect: () => void; onHover: (on: boolean) => void; onInvite: () => void }) {
  const m = hit.musician;
  return (
    <li className={`result card${active ? ' is-active' : ''}${selected ? ' is-selected' : ''}`} id={`hit-${m.id}`} onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)}>
      <label className="result__select check" title={t('Select to invite several musicians at once')}>
        <input type="checkbox" checked={selected} onChange={onSelect} aria-label={t('Select {name}', { name: m.name })} />
      </label>
      <Link to={`/musicians/${m.slug}`} className="result__avatar" tabIndex={-1} aria-hidden>
        <Avatar name={m.name} tint={m.tint} size="lg" />
        <span className="result__rank num">{rank}</span>
      </Link>
      <div className="result__body">
        <div className="result__head">
          <div className="grow">
            <h3 className="h-card">
              <Link to={`/musicians/${m.slug}`}>{m.name}</Link>
            </h3>
            <div className="small soft">{m.headline}</div>
            <div className="small muted">
              {instrumentsLine(m.instruments)} · {m.base.name}
              {hit.instrumentMatch && hit.instrumentMatch.level !== 'primary' && (
                <span className="tag" style={{ marginLeft: 8 }}>{hit.instrumentMatch.level === 'period' ? t('period instrument') : hit.instrumentMatch.level === 'doubling' ? t('doubling') : t('second instrument')}</span>
              )}
            </div>
          </div>
        </div>
        <MatchReasons hit={hit} query={q} />
        <div className="result__actions">
          <button type="button" className="btn btn--primary btn--sm" onClick={onInvite}>
            <Send size={14} aria-hidden /> {t('Invite')}
          </button>
          <MessageButton to={{ id: m.id, name: m.name }} />
          <Link to={`/musicians/${m.slug}`} className="btn btn--quiet btn--sm">{t('View profile')}</Link>
          <span className="grow" />
          <ShortlistButton musicianId={m.id} on={hit.shortlisted} />
        </div>
      </div>
    </li>
  );
}

export function SearchPage() {
  const viewer = useViewer();
  const [params, setParams] = useSearchParams();
  const q = useMemo(() => paramsToQuery(params), [params]);
  const set = (patch: Partial<MusicianQuery>, replace = true) => setParams(queryToParams({ ...q, ...patch }), { replace });
  const search = useApiQuery(['search', q, viewer.id], () => api.searchMusicians(q, viewer.id), { placeholderData: (prev) => prev });

  const [view, setView] = useState<'list' | 'map'>('list');
  const [sheet, setSheet] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [inviting, setInviting] = useState<{ id: string; name: string }[] | null>(null);
  const listRef = useRef<HTMLOListElement>(null);

  const hits = search.data?.hits ?? [];
  useEffect(() => setSelected((sel) => sel.filter((id) => hits.some((h) => h.musician.id === id))), [search.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const chips = queryChips(q);
  const empty = isEmptyQuery(q);
  const shown = hits.slice(0, 60);
  const markers = shown.map((h, k) => ({
    id: h.musician.id,
    lat: h.musician.base.lat,
    lng: h.musician.base.lng,
    label: `${h.musician.name} — ${instrumentsLine(h.musician.instruments, 1)}`,
    badge: String(k + 1),
    tone: (h.availability === 'tentative' ? 'warn' : 'plain') as 'warn' | 'plain',
  }));
  const jump = (id: string) => {
    setView('list');
    setActive(id);
    window.setTimeout(() => document.getElementById(`hit-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
  };
  const postHref = postHrefFromQuery(q);
  const urgentSoon = q.date && q.date <= addDays(today(), 3);

  return (
    <div className="wrap page search">
      <div className="page__head">
        <div>
          <div className="label">{t('Find musicians')}</div>
          <h1 className="h-page">{t('Who do you need?')}</h1>
        </div>
      </div>

      <AskBar onSubmit={(patch) => setParams(queryToParams({ ...EMPTY_QUERY, sort: q.sort, ...patch }), { replace: false })} />

      <div className="search__layout">
        <aside className="search__filters" aria-label={t('Filters')}>
          <div className="row row--between" style={{ marginBottom: 14 }}>
            <span className="label">{t('Filters')}</span>
            {!empty && (
              <button type="button" className="link small" onClick={() => setParams(new URLSearchParams())}>
                {t('Clear all')}
              </button>
            )}
          </div>
          <Filters q={q} set={set} />
        </aside>

        <section className="search__results" aria-live="polite">
          <div className="search__toolbar">
            <button type="button" className="btn btn--ghost btn--sm search__filter-btn" onClick={() => setSheet(true)}>
              <SlidersHorizontal size={15} aria-hidden /> {t('Filters')}
              {countFilters(q) > 0 && <span className="count">{countFilters(q)}</span>}
            </button>
            <div className="grow search__count">
              {search.data ? (
                <b>{empty ? plural(hits.length, '{n} musician on Leggio', '{n} musicians on Leggio') : plural(hits.length, '{n} musician matches', '{n} musicians match')}</b>
              ) : (
                <span className="muted">{t('Searching…')}</span>
              )}
              {search.isFetching && search.data && <span className="spinner" style={{ display: 'inline-block', marginLeft: 10, verticalAlign: '-3px', color: 'var(--ink-3)' }} aria-label={t('Updating')} />}
            </div>
            <select className="select select--sm" style={{ width: 'auto' }} value={q.sort} onChange={(e) => set({ sort: e.target.value as SortKey })} aria-label={t('Sort by')}>
              <option value="best">{t('Best match')}</option>
              <option value="distance" disabled={!q.place}>{t('Nearest')}</option>
              <option value="fee">{t('Lowest fee')}</option>
              <option value="endorsements">{t('Most endorsed')}</option>
            </select>
            <div className="segmented search__viewtoggle" role="group" aria-label={t('View')}>
              <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={15} aria-hidden />{t('List')}</button>
              <button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')}><MapIcon size={15} aria-hidden />{t('Map')}</button>
            </div>
          </div>

          {chips.length > 0 && (
            <div className="row row--wrap search__chips">
              {chips.map((c) => (
                <span key={c.key} className="chip chip--filter">
                  {c.label}
                  <button type="button" onClick={() => set(c.clear)} aria-label={t('Remove filter: {label}', { label: c.label })}>
                    <X size={12} aria-hidden />
                  </button>
                </span>
              ))}
            </div>
          )}

          {search.data && search.data.relaxations.length > 0 && (
            <div className="near card">
              <div>
                <div className="label">{hits.length ? t('A few more, if you can bend') : t('Nobody matches every condition')}</div>
                <div className="small soft" style={{ marginTop: 2 }}>{hits.length ? t('These would join the list if one condition moved:') : t('But these musicians are one condition away:')}</div>
              </div>
              <div className="row row--wrap" style={{ gap: 6 }}>
                {search.data.relaxations.map((r) => (
                  <button key={r.kind} type="button" className="chip chip--dashed" onClick={() => set(r.patch, false)}>
                    {relaxationLabel(r, q)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={`search__split search__split--${view}`}>
            <div className="search__list">
              {search.isError ? (
                <ErrorState error={search.error} onRetry={() => void search.refetch()} />
              ) : !search.data ? (
                <SkeletonList rows={5} height={150} />
              ) : hits.length === 0 ? (
                <EmptyState
                  icon={<SearchX size={22} aria-hidden />}
                  title={t('No one fits all of that')}
                  text={search.data.relaxations.length ? t('Try one of the suggestions above, or remove a filter. You can also post the opportunity and let musicians come to you.') : t('Remove a filter or widen the area. You can also post the opportunity and let musicians come to you.')}
                  action={
                    <div className="row row--wrap" style={{ justifyContent: 'center' }}>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setParams(new URLSearchParams())}>{t('Clear all filters')}</button>
                      <Link to={postHref} className="btn btn--primary btn--sm">{t('Post this as an opportunity')}</Link>
                    </div>
                  }
                />
              ) : (
                <>
                  <ol className="stack" ref={listRef}>
                    {shown.map((h, k) => (
                      <ResultCard
                        key={h.musician.id}
                        hit={h}
                        rank={k + 1}
                        q={q}
                        active={active === h.musician.id}
                        selected={selected.includes(h.musician.id)}
                        onSelect={() => setSelected((s) => (s.includes(h.musician.id) ? s.filter((x) => x !== h.musician.id) : [...s, h.musician.id]))}
                        onHover={(on) => setActive(on ? h.musician.id : null)}
                        onInvite={() => setInviting([{ id: h.musician.id, name: h.musician.name }])}
                      />
                    ))}
                  </ol>
                  {hits.length > shown.length && <p className="small muted" style={{ marginTop: 16, textAlign: 'center' }}>{t('Showing the best {n} of {total}. Add a filter to narrow the list.', { n: shown.length, total: hits.length })}</p>}
                  {!empty && (
                    <div className="search__after card card--pad">
                      <div className="grow">
                        <div style={{ fontWeight: 650 }}>{urgentSoon ? t('Need someone fast?') : t('Rather let them come to you?')}</div>
                        <div className="small soft">{urgentSoon ? t('Send an urgent call to everyone who is free, close and takes last-minute work.') : t('Post this as an opportunity — these filters are carried over, and you can invite from the list.')}</div>
                      </div>
                      {urgentSoon ? (
                        <Link to={postHrefFromQuery(q, true)} className="btn btn--urgent btn--sm"><Zap size={14} aria-hidden />{t('Urgent call')}</Link>
                      ) : (
                        <Link to={postHref} className="btn btn--ghost btn--sm">{t('Post an opportunity')}</Link>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="search__map">
              <MapView markers={markers} center={q.place} radiusKm={q.place ? q.radiusKm : undefined} activeId={active} onHover={setActive} onSelect={jump} />
            </div>
          </div>
        </section>
      </div>

      {selected.length > 0 && (
        <div className="selbar no-print" role="region" aria-label={t('Selected musicians')}>
          <span>
            <b>{plural(selected.length, '{n} musician selected', '{n} musicians selected')}</b>
          </span>
          <button type="button" className="btn btn--quiet btn--sm" style={{ color: 'inherit' }} onClick={() => setSelected([])}>{t('Clear')}</button>
          <button type="button" className="btn btn--sm selbar__go" onClick={() => setInviting(hits.filter((h) => selected.includes(h.musician.id)).map((h) => ({ id: h.musician.id, name: h.musician.name })))}>
            <Send size={14} aria-hidden /> {t('Invite all')}
          </button>
        </div>
      )}

      {sheet && (
        <Modal title={t('Filters')} onClose={() => setSheet(false)} footer={<><button type="button" className="btn btn--ghost" onClick={() => setParams(new URLSearchParams())}>{t('Clear all')}</button><button type="button" className="btn btn--primary" onClick={() => setSheet(false)}>{search.data ? plural(hits.length, 'Show {n} musician', 'Show {n} musicians') : t('Show results')}</button></>}>
          <Filters q={q} set={set} />
        </Modal>
      )}
      {inviting && (
        <InviteModal
          musicians={inviting}
          createHref={postHref}
          onClose={() => {
            setInviting(null);
            setSelected([]);
          }}
        />
      )}
    </div>
  );
}

export function ShortlistPage() {
  const viewer = useViewer();
  const list = useApiQuery(['shortlist', viewer.id], () => api.getShortlist(viewer.id));
  const [inviting, setInviting] = useState<{ id: string; name: string }[] | null>(null);
  return (
    <div className="wrap wrap--narrow page">
      <div className="page__head">
        <div>
          <div className="label">{t('Saved musicians')}</div>
          <h1 className="h-page">{t('Your shortlist')}</h1>
          <p className="page__sub">{t('People you have saved from search and from profiles — your own list of who to call first.')}</p>
        </div>
        {!!list.data?.length && (
          <button type="button" className="btn btn--primary" onClick={() => setInviting(list.data!.map((m) => ({ id: m.id, name: m.name })))}>
            <Send size={15} aria-hidden /> {t('Invite all to a posting')}
          </button>
        )}
      </div>
      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : !list.data ? (
        <SkeletonList rows={4} height={72} />
      ) : list.data.length === 0 ? (
        <EmptyState icon={<Search size={22} aria-hidden />} title={t('Nobody saved yet')} text={t('Use the bookmark on a search result or a profile to keep the musicians you would call again.')} action={<Link to="/search" className="btn btn--primary btn--sm">{t('Find musicians')}</Link>} />
      ) : (
        <ul className="card rows">
          {list.data.map((m) => (
            <li key={m.id} className="rows__item">
              <Link to={`/musicians/${m.slug}`} className="mini__main">
                <Avatar name={m.name} tint={m.tint} />
                <span className="grow">
                  <span className="mini__name">{m.name}</span>
                  <span className="mini__sub">{m.headline}</span>
                </span>
              </Link>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setInviting([{ id: m.id, name: m.name }])}>{t('Invite')}</button>
              <MessageButton to={{ id: m.id, name: m.name }} />
              <ShortlistButton musicianId={m.id} on />
            </li>
          ))}
        </ul>
      )}
      {inviting && <InviteModal musicians={inviting} createHref="/opportunities/new" onClose={() => setInviting(null)} />}
    </div>
  );
}
