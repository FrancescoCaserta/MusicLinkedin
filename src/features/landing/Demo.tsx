import { useEffect } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { useSession } from '../../app/session';
import { api } from '../../data/client';
import { useApiQuery } from '../../data/hooks';
import { t } from '../../i18n';
import { Logo } from '../../ui/Logo';
import { PersonaGrid } from './Landing';

/** Only in-app paths are accepted as a destination. */
function safeNext(next: string | null): string | undefined {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : undefined;
}

/** The "login" screen of the prototype: choose who you are. */
export function Demo() {
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const meta = useApiQuery(['meta'], () => api.getMeta());
  const personas = useApiQuery(['personas'], () => api.listPersonas());
  return (
    <div className="landing">
      <header className="landing__top">
        <div className="wrap landing__top-in">
          <Link to="/" aria-label={t('Leggio home')}>
            <Logo size={28} />
          </Link>
          <Link to="/" className="btn btn--quiet btn--sm">
            <ArrowLeft size={15} aria-hidden /> {t('Back to the overview')}
          </Link>
        </div>
      </header>
      <section className="band" style={{ paddingTop: 48 }}>
        <div className="wrap">
          <div className="label label--accent">{t('Demo')}</div>
          <h1 className="display band__title" style={{ fontSize: 'clamp(32px, 5vw, 48px)' }}>{t('Who would you like to be?')}</h1>
          <p className="soft" style={{ maxWidth: '64ch', marginBottom: 28 }}>
            {next
              ? t('That page is inside the demo. Choose a persona to continue — there is no sign-up, and you can switch at any time from the menu in the top right.')
              : t('There is no sign-up in the prototype. Choose one of five prepared people — three musicians and two who hire them — and switch at any time from the menu in the top right.')}
          </p>
          <PersonaGrid personas={personas.data} demoDate={meta.data?.demoDate} next={next} error={personas.isError ? personas.error : undefined} retry={() => void personas.refetch()} />
        </div>
      </section>
    </div>
  );
}

/** /enter/:accountId?next=… — sign in as a persona and go straight to a page. */
export function Enter() {
  const { accountId = '' } = useParams();
  const [params] = useSearchParams();
  const { signIn } = useSession();
  const navigate = useNavigate();
  useEffect(() => {
    signIn(accountId);
    navigate(safeNext(params.get('next')) ?? '/home', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export function NotFound({ inside = false }: { inside?: boolean }) {
  return (
    <div className="wrap" style={{ padding: '96px 24px', textAlign: 'center' }}>
      <div className="label">{t('Page not found')}</div>
      <h1 className="display" style={{ fontSize: 'clamp(40px, 8vw, 72px)', margin: '12px 0' }}>
        <em>{t('Tacet.')}</em>
      </h1>
      <p className="soft" style={{ maxWidth: '44ch', margin: '0 auto 24px' }}>{t('There is nothing written on this page. The address may be wrong, or the page may have been removed.')}</p>
      <Link to={inside ? '/home' : '/'} className="btn btn--primary">{inside ? t('Back to home') : t('Back to the overview')}</Link>
    </div>
  );
}
