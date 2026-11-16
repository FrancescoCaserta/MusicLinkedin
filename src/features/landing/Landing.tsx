import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Award, CalendarDays, CornerDownLeft, Euro, MapPin, Music2, Quote, Search, Zap } from 'lucide-react';
import { enterPath, PERSONA_GUIDE } from '../../app/personas';
import { useSession } from '../../app/session';
import { api } from '../../data/client';
import { useApiQuery } from '../../data/hooks';
import { today } from '../../domain/dates';
import { EMPTY_OPPORTUNITY_QUERY } from '../../domain/search/opportunities';
import { parseQuery } from '../../domain/search/parse';
import { EMPTY_QUERY, isEmptyQuery, queryToParams, type MusicianQuery } from '../../domain/search/query';
import { fmt, plural, t } from '../../i18n';
import { Avatar, ErrorState, feeRange, instrumentsLine, Skeleton } from '../../ui/basics';
import { Logo } from '../../ui/Logo';
import { MapView } from '../../ui/MapView';
import { CalendarLegend, MonthCalendar } from '../../ui/MonthCalendar';
import { MatchReasons, OpportunityCard, RepertoireStatus } from '../shared';
import { queryChips, relaxationLabel } from '../search/chips';

const HEADLINE = 'Accordionist within 50 km of Bologna, free on 14 March, budget €250';
const EXAMPLES = [
  HEADLINE,
  'Mezzo for Bach Christmas Oratorio near Vienna',
  'Baroque violin within 100 km of Venice, period instruments',
  'Cellist near Bologna this Saturday, urgent',
  'Theorbo for Monteverdi Vespers within 300 km of Ravenna',
];

/** The real search engine on the real demo data, typed out in front of the visitor. */
function LiveSearch() {
  const [text, setText] = useState('');
  const [touched, setTouched] = useState(false);
  const [debounced, setDebounced] = useState('');
  const [active, setActive] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // Type the headline example once, unless the visitor takes over or prefers no motion.
  useEffect(() => {
    if (touched) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setText(HEADLINE);
      return;
    }
    let k = 0;
    let timer = window.setTimeout(function step() {
      k += 1;
      setText(HEADLINE.slice(0, k));
      if (k < HEADLINE.length) timer = window.setTimeout(step, HEADLINE[k - 1] === ',' ? 260 : 26 + (k % 5) * 6);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [touched]);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(text), 220);
    return () => window.clearTimeout(id);
  }, [text]);

  const query: MusicianQuery = useMemo(() => ({ ...EMPTY_QUERY, ...parseQuery(debounced, today()).patch }), [debounced]);
  const empty = isEmptyQuery(query);
  const search = useApiQuery(['landing-search', query], () => api.searchMusicians(query), { enabled: !empty, placeholderData: (prev) => prev });
  const chips = queryChips(query);
  const hits = search.data?.hits ?? [];
  const top = hits.slice(0, 4);
  const openHref = enterPath('acc-lorenzo', `/search?${queryToParams(query).toString()}`);

  const choose = (example: string) => {
    setTouched(true);
    setText(example);
    input.current?.focus();
  };

  return (
    <div className="live card card--lift" id="search">
      <div className="live__bar">
        <Search size={20} aria-hidden className="live__icon" />
        <input
          ref={input}
          className="live__input"
          value={text}
          onChange={(e) => {
            setTouched(true);
            setText(e.target.value);
          }}
          onFocus={() => text === HEADLINE || setTouched(true)}
          placeholder={t('Describe who you are looking for…')}
          aria-label={t('Describe the musician you are looking for')}
          spellCheck={false}
        />
        <Link to={openHref} className="btn btn--primary live__go">
          {t('Open in the demo')} <ArrowRight size={16} aria-hidden />
        </Link>
      </div>

      <div className="live__understood">
        <span className="label">{t('Understood as')}</span>
        {chips.length ? chips.map((c) => <span key={c.key} className="chip chip--filter" style={{ paddingRight: 10 }}>{c.label}</span>) : <span className="muted small">{t('Type an instrument, a place, a date, a budget or a piece.')}</span>}
      </div>

      <div className="live__body">
        <div className="live__list">
          {search.isError ? (
            <ErrorState error={search.error} onRetry={() => void search.refetch()} compact />
          ) : empty ? (
            <div className="live__hint muted">{t('Results appear here as you type.')}</div>
          ) : !search.data ? (
            <div className="stack">
              <Skeleton h={84} />
              <Skeleton h={84} />
              <Skeleton h={84} />
            </div>
          ) : (
            <>
              <div className="live__count small">
                <b>{plural(hits.length, '{n} musician matches', '{n} musicians match')}</b>
                {hits.length > top.length && <span className="muted"> · {t('showing the best {n}', { n: top.length })}</span>}
              </div>
              {top.length === 0 && <div className="live__hint soft">{t('Nobody matches every condition. The suggestions below show what would.')}</div>}
              <ol className="live__hits">
                {top.map((h, k) => (
                  <li key={h.musician.id} className={`live__hit${active === h.musician.id ? ' is-active' : ''}`} onMouseEnter={() => setActive(h.musician.id)} onMouseLeave={() => setActive(null)}>
                    <span className="live__rank num">{k + 1}</span>
                    <Avatar name={h.musician.name} tint={h.musician.tint} />
                    <div className="grow">
                      <div className="live__name">{h.musician.name}</div>
                      <div className="small soft">{instrumentsLine(h.musician.instruments, 2)} · {h.musician.base.name}</div>
                      <MatchReasons hit={h} query={query} />
                    </div>
                  </li>
                ))}
              </ol>
              {search.data.relaxations.length > 0 && (
                <div className="live__near">
                  <span className="label">{t('Near misses')}</span>
                  {search.data.relaxations.map((r) => (
                    <span key={r.kind} className="chip chip--dashed">{relaxationLabel(r, query)}</span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div className="live__map">
          <MapView
            markers={top.map((h, k) => ({ id: h.musician.id, lat: h.musician.base.lat, lng: h.musician.base.lng, label: h.musician.name, badge: String(k + 1), tone: h.availability === 'tentative' ? 'warn' : 'plain' }))}
            center={query.place}
            radiusKm={query.place ? query.radiusKm : undefined}
            activeId={active}
            onHover={setActive}
          />
        </div>
      </div>

      <div className="live__examples">
        <span className="label">{t('Try')}</span>
        {EXAMPLES.slice(1).map((e) => (
          <button key={e} type="button" className="chip" onClick={() => choose(e)}>
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProfilePreview({ demoDate }: { demoDate?: string }) {
  const profile = useApiQuery(['landing-profile'], () => api.getProfile('nicolo-baldini'));
  if (profile.isError) return <ErrorState error={profile.error} onRetry={() => void profile.refetch()} compact />;
  if (!profile.data) return <Skeleton h={520} style={{ borderRadius: 6 }} />;
  const { musician: m, concerts, endorsements } = profile.data;
  const [y, mo] = (demoDate ?? today()).split('-').map(Number);
  const rep = m.repertoire.filter((r) => r.status === 'ready').slice(0, 6);
  const past = concerts.filter((c) => c.date < today()).slice(0, 3);
  const quote = endorsements.find((e) => e.from.kind === 'organiser') ?? endorsements[0];
  return (
    <article className="preview card card--lift">
      <header className="preview__head">
        <Avatar name={m.name} tint={m.tint} size="lg" />
        <div className="grow">
          <h3 className="display preview__name">{m.name}</h3>
          <div className="soft">{m.headline}</div>
          <div className="meta" style={{ marginTop: 8 }}>
            <span><MapPin size={14} aria-hidden />{t('{city} · travels {km}', { city: m.base.name, km: fmt.km(m.travelRadiusKm) })}</span>
            <span><Euro size={14} aria-hidden />{t('{range} per engagement', { range: feeRange(m.fee) })}</span>
            <span><Award size={14} aria-hidden />{plural(endorsements.length, '{n} endorsement', '{n} endorsements')}</span>
          </div>
        </div>
      </header>
      <div className="preview__grid">
        <section>
          <div className="label">{t('Repertoire')}</div>
          <ul className="preview__rep">
            {rep.map((r) => (
              <li key={r.id}>
                <span>
                  <b>{r.composer}</b> {r.work}
                </span>
                <RepertoireStatus status={r.status} year={r.lastPerformed} />
              </li>
            ))}
          </ul>
          <div className="tiny muted">{t('{n} works in total, each searchable', { n: m.repertoire.length })}</div>
        </section>
        <section>
          <div className="label">{t('Availability')}</div>
          <MonthCalendar year={y} month={mo} availability={m.availability} today={today()} highlight={demoDate} />
          <CalendarLegend />
        </section>
        <section className="preview__wide">
          <div className="label">{t('Concert history')}</div>
          <ul className="preview__concerts">
            {past.map((c) => (
              <li key={c.id}>
                <span className="num muted">{fmt.date(c.date)}</span>
                <span>
                  <b>{c.programme[0].composer}</b>, {c.programme[0].work}
                  <span className="soft"> — {c.ensembleName ?? t('Recital')}, {c.venue}, {c.city}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
        {quote && (
          <blockquote className="preview__quote preview__wide">
            <Quote size={18} aria-hidden />
            <p>{quote.text}</p>
            <footer>
              <b>{quote.from.name}</b>, {quote.from.title} · <span className="muted">{t('after {venue}, {date}', { venue: quote.concert.venue, date: fmt.date(quote.concert.date) })}</span>
            </footer>
          </blockquote>
        )}
      </div>
      <footer className="preview__foot">
        <span className="small muted">{t('A real profile from the demo data.')}</span>
        <Link to={enterPath(m.id, `/musicians/${m.slug}`)} className="btn btn--ghost">
          {t('See the full profile as {name}', { name: m.firstName })} <ArrowRight size={16} aria-hidden />
        </Link>
      </footer>
    </article>
  );
}

function Feature({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="feature">
      <span className="feature__icon">{icon}</span>
      <div>
        <h4 className="feature__title">{title}</h4>
        <p className="soft">{children}</p>
      </div>
    </li>
  );
}

const PRINCIPLES: [string, string][] = [
  ['Every opportunity states the fee.', 'A posting cannot go live without one. Rehearsals, travel, accommodation, dress code and pitch are stated in the same place.'],
  ['Repertoire is data, not a paragraph.', 'Composer, work, part, and whether it is ready to perform. Search it, and see it ticked against the programme of every opportunity.'],
  ['Endorsements cite the concert.', 'Only someone who took part in the same concert — on stage, or as the organisation that presented it — can endorse you.'],
  ['The calendar is part of the search.', 'Hirers see who is free on the date before they write. Confirmed engagements block the day automatically.'],
  ['Classical music, and nothing else.', 'Voice types and period instruments, continuo and doublings, A=415 and tails. Built for one world so that it can fit it properly.'],
];

export function Landing() {
  const { accountId, session } = useSession();
  const meta = useApiQuery(['meta'], () => api.getMeta());
  const personas = useApiQuery(['personas'], () => api.listPersonas());
  const opps = useApiQuery(['landing-opps'], () => api.listOpportunities(EMPTY_OPPORTUNITY_QUERY));
  const demoDate = meta.data?.demoDate;
  const board = useMemo(() => {
    const list = opps.data ?? [];
    const pick = (id: string) => list.find((v) => v.opportunity.id === id);
    return [pick('opp-u-accordion-reno'), pick('opp-naviglio-gamba'), pick('opp-a-reno-viola')].filter((x): x is NonNullable<typeof x> => !!x);
  }, [opps.data]);

  return (
    <div className="landing">
      <header className="landing__top">
        <div className="wrap landing__top-in">
          <Logo size={28} />
          <nav className="landing__nav" aria-label={t('Sections')}>
            <a href="#hire">{t('For those who hire')}</a>
            <a href="#musicians">{t('For musicians')}</a>
            <a href="#principles">{t('Principles')}</a>
          </nav>
          {accountId ? (
            <Link to="/home" className="btn btn--primary btn--sm">{t('Continue as {name}', { name: session?.account.name.split(' ')[0] ?? '…' })}</Link>
          ) : (
            <Link to="/demo" className="btn btn--primary btn--sm">{t('Open the demo')}</Link>
          )}
        </div>
      </header>

      <section className="hero">
        <div className="wrap">
          <div className="label label--accent hero__kicker">{t('The professional network for classical musicians')}</div>
          <h1 className="display hero__title">
            {t('Every stand filled.')} <em>{t('Every fee stated.')}</em>
          </h1>
          <p className="hero__lead">
            {t('Leggio is built around how classical musicians are actually hired: by instrument, distance, date and fee — and by whether you have already played the piece. Ask for who you need in one sentence.')}
          </p>
          <LiveSearch />
          <div className="hero__cta">
            <Link to={enterPath('acc-lorenzo', demoDate ? `/search?i=accordion&near=bologna&r=50&d=${demoDate}&b=250` : '/search')} className="btn btn--accent btn--lg">
              {t('I need a musician')} <ArrowRight size={18} aria-hidden />
            </Link>
            <Link to={enterPath('m-nicolo-baldini', '/home')} className="btn btn--ghost btn--lg">
              {t('I am a musician')}
            </Link>
            <span className="small muted hero__note">{t('No sign-up: the demo opens as a prepared persona, and nothing leaves your browser.')}</span>
          </div>
        </div>
      </section>

      <div className="wrap">
        <div className="stave" aria-hidden />
      </div>

      <section className="band" id="hire">
        <div className="wrap band__cols">
          <div>
            <div className="label">{t('For those who hire')}</div>
            <h2 className="display band__title">{t('Ensembles, orchestras, festivals, churches, weddings — and musicians who need a sub.')}</h2>
            <ul className="features">
              <Feature icon={<Search size={18} aria-hidden />} title={t('Ask in one sentence')}>
                {t('Instrument, place, date, budget, repertoire. Leggio turns it into a ranked shortlist and tells you why each person is on it.')}
              </Feature>
              <Feature icon={<CalendarDays size={18} aria-hidden />} title={t('Know before you write')}>
                {t('Free that day? Inside their travel radius? Have they played the piece? It is on the result, not three messages later.')}
              </Feature>
              <Feature icon={<Zap size={18} aria-hidden />} title={t('A substitute in minutes')}>
                {t('An urgent call goes to players who are free, close and willing. You see answers as they arrive, and the first one you confirm fills the stand.')}
              </Feature>
            </ul>
          </div>
          <div id="musicians">
            <div className="label">{t('For musicians')}</div>
            <h2 className="display band__title">{t('A profile shaped like a classical career, and work with the fee on the first line.')}</h2>
            <ul className="features">
              <Feature icon={<Music2 size={18} aria-hidden />} title={t('Your repertoire, searchable')}>
                {t('Instruments and doublings, voice type, the works you could play tomorrow and the concerts you have actually given.')}
              </Feature>
              <Feature icon={<Euro size={18} aria-hidden />} title={t('No fee, no posting')}>
                {t('Every opportunity states what it pays, when the rehearsals are, what is covered and what to wear — and ticks off the pieces you already know.')}
              </Feature>
              <Feature icon={<Award size={18} aria-hidden />} title={t('Endorsements that mean something')}>
                {t('Written only by people who shared a concert with you, with the concert cited. No skill badges.')}
              </Feature>
            </ul>
          </div>
        </div>
      </section>

      <section className="band band--deep">
        <div className="wrap band__split">
          <div className="band__intro">
            <div className="label">{t('The profile')}</div>
            <h2 className="display band__title">{t('What a hirer sees before they call.')}</h2>
            <p className="soft">
              {t('Not a CV in a PDF. Repertoire with its state of readiness, a concert history that shows who you played with, a calendar that answers the first question, and an indicative fee so nobody wastes anybody’s time.')}
            </p>
            <ul className="band__list small">
              <li>{t('Primary, secondary and period instruments; voice type and roles for singers')}</li>
              <li>{t('Training, teachers, masterclasses, competitions')}</li>
              <li>{t('Pitch standards, languages, invoicing, own transport')}</li>
              <li>{t('A one-page printable version for programme books and applications')}</li>
            </ul>
          </div>
          <ProfilePreview demoDate={demoDate} />
        </div>
      </section>

      <section className="band" id="principles">
        <div className="wrap wrap--narrow">
          <div className="label">{t('Principles')}</div>
          <h2 className="display band__title">{t('Five rules the product is built on.')}</h2>
          <ol className="principles">
            {PRINCIPLES.map(([title, text], k) => (
              <li key={title}>
                <span className="principles__no display">{['I', 'II', 'III', 'IV', 'V'][k]}</span>
                <div>
                  <h3 className="principles__title">{t(title)}</h3>
                  <p className="soft">{t(text)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="band band--deep">
        <div className="wrap">
          <div className="row row--between row--wrap" style={{ marginBottom: 20, alignItems: 'flex-end' }}>
            <div>
              <div className="label">{t('Opportunities')}</div>
              <h2 className="display band__title" style={{ marginBottom: 0 }}>{t('This is what a posting looks like.')}</h2>
            </div>
            <Link to={enterPath('m-giulia-santoro', '/opportunities')} className="btn btn--ghost">
              {t('Browse all {n} in the demo', { n: opps.data?.length ?? '…' })} <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
          {opps.isError ? (
            <ErrorState error={opps.error} onRetry={() => void opps.refetch()} compact />
          ) : !opps.data ? (
            <div className="stack">
              <Skeleton h={120} />
              <Skeleton h={120} />
            </div>
          ) : (
            <div className="stack">
              {board.map((v) => (
                <OpportunityCard key={v.opportunity.id} view={v} to={enterPath(v.opportunity.instruments.includes('accordion') ? 'm-nicolo-baldini' : 'm-giulia-santoro', `/opportunities/${v.opportunity.id}`)} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="band" id="demo">
        <div className="wrap">
          <div className="label">{t('The demo')}</div>
          <h2 className="display band__title">{t('Step in as one of five people.')}</h2>
          <p className="soft" style={{ maxWidth: '62ch', marginBottom: 24 }}>
            {t('Everything works: searches filter, postings appear, applications reach the hirer, messages are stored. Switch persona at any time to see the other side of the same conversation.')}
          </p>
          <PersonaGrid demoDate={demoDate} personas={personas.data} error={personas.isError ? personas.error : undefined} retry={() => void personas.refetch()} />
        </div>
      </section>

      <footer className="landing__foot">
        <div className="wrap landing__foot-in">
          <Logo size={24} tagline />
          <p className="small muted" style={{ maxWidth: '70ch' }}>
            {meta.data
              ? t('Leggio is a working prototype. The {m} musicians, {o} ensembles and organisations and {p} opportunities in this demo are fictional; composers, works, cities and conservatories are real. All data lives in your browser.', {
                  m: meta.data.counts.musicians,
                  o: meta.data.counts.organisations,
                  p: meta.data.counts.opportunities,
                })
              : t('Leggio is a working prototype with fictional musicians and ensembles. All data lives in your browser.')}
          </p>
        </div>
      </footer>
    </div>
  );
}

export function PersonaGrid({
  personas,
  demoDate,
  next,
  error,
  retry,
}: {
  personas?: { account: { id: string; name: string; title: string; tint: number }; base: { name: string } }[];
  demoDate?: string;
  /** When set, every card leads here instead of its own suggestions. */
  next?: string;
  error?: unknown;
  retry?: () => void;
}) {
  if (error) return <ErrorState error={error} onRetry={retry} compact />;
  if (!personas)
    return (
      <div className="personas">
        {[0, 1, 2, 3, 4].map((k) => (
          <Skeleton key={k} h={250} style={{ borderRadius: 6 }} />
        ))}
      </div>
    );
  return (
    <div className="personas">
      {personas.map((p) => {
        const guide = PERSONA_GUIDE[p.account.id];
        const first = next ?? guide?.tries[0].to(demoDate ?? today()) ?? '/home';
        return (
          <article key={p.account.id} className="persona card">
            <Link to={enterPath(p.account.id, first)} className="persona__main">
              <Avatar name={p.account.name} tint={p.account.tint} size="lg" />
              <div className="label label--accent" style={{ marginTop: 14 }}>{t(guide?.role ?? '')}</div>
              <h3 className="h-card" style={{ marginTop: 4 }}>{p.account.name}</h3>
              <div className="tiny muted">{p.base.name}</div>
              <p className="small soft persona__blurb">{t(guide?.blurb ?? '')}</p>
            </Link>
            {!next && guide && (
              <ul className="persona__tries">
                {guide.tries.map((x) => (
                  <li key={x.label}>
                    <Link to={enterPath(p.account.id, x.to(demoDate ?? today()))}>
                      <CornerDownLeft size={13} aria-hidden style={{ transform: 'scaleX(-1)' }} />
                      {t(x.label)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {next && (
              <Link to={enterPath(p.account.id, first)} className="btn btn--ghost btn--sm persona__enter">
                {t('Continue as {name}', { name: p.account.name.split(' ')[0] })}
              </Link>
            )}
          </article>
        );
      })}
    </div>
  );
}
