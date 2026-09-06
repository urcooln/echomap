import { type ReactNode, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, useAuth } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { HeartHandshake, LockKeyhole, Sparkles } from 'lucide-react';
import { Link, Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Layout } from '@/components/layout';
import Overview from '@/pages/Overview';
import Dictionary from '@/pages/Dictionary';
import Team from '@/pages/Team';
import Session from '@/pages/Session';
import Settings from '@/pages/Settings';
import ChildDetail from '@/pages/ChildDetail';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const developmentDemoEnabled = import.meta.env.DEV;
const developmentDemoStorageKey = 'childled-development-demo';
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function WorkspaceRouter() {
  return (
    <Layout>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/overview" component={Overview} />
          <Route path="/dictionary" component={Dictionary} />
          <Route path="/team" component={Team} />
          <Route path="/session" component={Session} />
          <Route path="/settings" component={Settings} />
          <Route path="/child/:id" component={ChildDetail} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Layout>
  );
}

function AuthLoading() {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-background p-6">
      <section className="cc-card w-full max-w-md rounded-3xl p-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground"><LockKeyhole size={21} /></span>
        <h1 className="cc-serif mt-5 text-3xl text-primary">Checking your secure session</h1>
        <p data-testid="auth-loading-message" className="mt-3 text-sm leading-6 text-muted-foreground">ChildLed is verifying your account and care-team access.</p>
      </section>
    </main>
  );
}

function DevelopmentLoginButton() {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');

  const startDemo = async () => {
    setState('loading');
    try {
      const response = await fetch('/api/development/login', { method: 'POST', credentials: 'include' });
      if (!response.ok) throw new Error('Unable to start the demo workspace.');
      window.localStorage.setItem(developmentDemoStorageKey, 'active');
      queryClient.clear();
      window.location.assign(basePath || '/');
    } catch {
      setState('error');
    }
  };

  return (
    <div className="contents">
      <button data-testid="button-development-login" type="button" onClick={startDemo} disabled={state === 'loading'} className="cc-focus rounded-xl border border-primary/20 bg-secondary px-5 py-3 text-sm font-bold text-primary disabled:cursor-not-allowed disabled:opacity-60">
        {state === 'loading' ? 'Preparing demo…' : 'Development Login'}
      </button>
      {state === 'error' && <p data-testid="development-login-error" className="w-full text-center text-xs text-destructive">We could not prepare the demo workspace. Please try again.</p>}
    </div>
  );
}

function LandingPage() {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-background px-5 py-10">
      <section className="cc-card w-full max-w-2xl rounded-[2rem] p-8 text-center md:p-12">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent text-accent-foreground"><HeartHandshake size={27} /></span>
        <p className="cc-mono mt-6 text-[10px] font-bold uppercase tracking-[.2em] text-muted-foreground">ChildLed Command Center</p>
        <h1 className="cc-serif mt-3 text-4xl font-semibold tracking-tight text-primary md:text-5xl">Shared language, safely held.</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground">A private operations workspace that helps invited care teams turn reviewed communication evidence into the next clear action.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/sign-in" data-testid="link-sign-in" className="cc-focus rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/15">Sign in</Link>
          <Link href="/sign-up" data-testid="link-sign-up" className="cc-focus rounded-xl border border-primary/20 bg-card px-5 py-3 text-sm font-bold text-primary">Create account</Link>
          {developmentDemoEnabled && <DevelopmentLoginButton />}
        </div>
        <div className="mx-auto mt-8 max-w-xl rounded-2xl bg-secondary/65 p-4 text-left">
          <div className="flex gap-3">
            <Sparkles size={17} className="mt-0.5 shrink-0 text-accent-foreground" />
            <p className="text-sm leading-6 text-muted-foreground">Child profiles, sessions, and shared observations are available only after account and care-team access are verified.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

function HomeRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  const developmentSession = developmentDemoEnabled && window.localStorage.getItem(developmentDemoStorageKey) === 'active';
  if (!isLoaded) return <AuthLoading />;
  return isSignedIn || developmentSession ? <Redirect to="/overview" /> : <LandingPage />;
}

function CareTeamGate() {
  const { isLoaded, isSignedIn } = useAuth();
  const developmentSession = developmentDemoEnabled && window.localStorage.getItem(developmentDemoStorageKey) === 'active';
  const [status, setStatus] = useState<'loading' | 'ready' | 'blocked'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn && !developmentSession) {
      setStatus('blocked');
      return;
    }

    let active = true;
    fetch('/api/auth/viewer', { credentials: 'include', cache: 'no-store' })
      .then(async (response) => ({ ok: response.ok, message: (await response.json().catch(() => null))?.error as string | undefined }))
      .then((result) => {
        if (!active) return;
        if (result.ok) setStatus('ready');
        else {
          queryClient.clear();
          setMessage(result.message || 'Your account cannot access this care-team workspace.');
          setStatus('blocked');
        }
      })
      .catch(() => active && (setMessage('We could not verify your session. Please try signing in again.'), setStatus('blocked')));

    return () => { active = false; };
  }, [developmentSession, isLoaded, isSignedIn]);

  if (!isLoaded || status === 'loading') return <AuthLoading />;
  if (!isSignedIn && !developmentSession) return <Redirect to="/" />;
  if (status === 'ready') return <WorkspaceRouter />;

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-background p-6">
      <section className="cc-card w-full max-w-lg rounded-3xl p-8 text-center">
        <LockKeyhole className="mx-auto text-primary" size={30} />
        <h1 className="cc-serif mt-5 text-3xl text-primary">Care-team access needed</h1>
        <p data-testid="auth-access-message" className="mt-3 text-sm leading-6 text-muted-foreground">{message || 'Please verify your email and ask a care-team administrator to invite your account.'}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/sign-in" data-testid="link-use-another-account" className="cc-focus rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Use another account</Link>
          <Link href="/" data-testid="link-back-home" className="cc-focus rounded-xl border border-primary/20 px-4 py-2.5 text-sm font-bold text-primary">Back home</Link>
        </div>
      </section>
    </main>
  );
}

function SignInPage() {
  return <div className="grid min-h-[100dvh] place-items-center bg-background p-5"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div>;
}

function SignUpPage() {
  return <div className="grid min-h-[100dvh] place-items-center bg-background p-5"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRoute} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/overview" component={CareTeamGate} />
      <Route path="/dictionary" component={CareTeamGate} />
      <Route path="/team" component={CareTeamGate} />
      <Route path="/session" component={CareTeamGate} />
      <Route path="/settings" component={CareTeamGate} />
      <Route path="/child/:id" component={CareTeamGate} />
      <Route component={NotFound} />
    </Switch>
  );
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: 'hsl(160 34% 21%)',
    colorForeground: 'hsl(160 40% 12%)',
    colorMutedForeground: 'hsl(160 20% 45%)',
    colorDanger: 'hsl(0 84% 60%)',
    colorBackground: 'hsl(40 33% 98%)',
    colorInput: 'hsl(40 33% 98%)',
    colorInputForeground: 'hsl(160 40% 12%)',
    colorNeutral: 'hsl(160 15% 85%)',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '1rem',
  },
};

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  const stripBase = (destination: string) => basePath && destination.startsWith(basePath)
    ? destination.slice(basePath.length) || '/'
    : destination;

  return (
    <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={{ signIn: { start: { title: 'Welcome back to ChildLed', subtitle: 'Sign in to your verified care-team account' } }, signUp: { start: { title: 'Join ChildLed', subtitle: 'Create your verified care-team account' } } }} routerPush={(to) => setLocation(stripBase(to))} routerReplace={(to) => setLocation(stripBase(to), { replace: true })}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default function App() {
  return <WouterRouter base={basePath}><ClerkProviderWithRoutes /></WouterRouter>;
}