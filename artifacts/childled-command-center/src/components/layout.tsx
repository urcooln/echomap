import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Home, Users, Activity, BookOpen, Mic2, HeartHandshake, X, Menu, CircleHelp, Bell, Settings2, Sparkles, UserRound } from 'lucide-react';
import { useGetViewer } from '@workspace/api-client-react';

export function Layout({ children }: { children: React.ReactNode }) {
  const [mobileNav, setMobileNav] = useState(false);
  const [location] = useLocation();
  const { data: viewer } = useGetViewer();

  const nav = [
    { href: '/overview', label: 'Overview', icon: Home, exact: true },
    { href: '/dictionary', label: 'Phrase dictionary', icon: BookOpen },
    { href: '/session', label: 'Session recorder', icon: Mic2 },
    { href: '/team', label: 'Team activity', icon: Activity },
  ];

  // extract initials
  const initials = viewer?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'EM';

  return (
    <div className="min-h-[100dvh] bg-background text-foreground font-sans">
      <aside className={`fixed inset-y-0 left-0 z-30 flex w-[244px] flex-col bg-sidebar px-4 py-6 text-sidebar-foreground transition-transform md:translate-x-0 ${mobileNav ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-10 flex items-center gap-3 px-2">
          <div className="grid size-10 place-items-center rounded-2xl bg-sidebar-primary text-sidebar-primary-foreground"><HeartHandshake size={21} /></div>
          <div><div className="cc-serif text-2xl font-semibold leading-none">ChildLed</div><div className="cc-mono mt-1 text-[9px] uppercase tracking-[.18em] text-sidebar-primary">shared language</div></div>
          <button data-testid="button-close-nav" className="cc-focus ml-auto rounded-lg p-2 md:hidden text-sidebar-foreground hover:bg-sidebar-accent" aria-label="Close navigation" onClick={() => setMobileNav(false)}><X size={18} /></button>
        </div>
        
        <div className="cc-mono mb-3 px-2 text-[9px] uppercase tracking-[.18em] text-sidebar-foreground/45">Your workspace</div>
        
        <nav className="space-y-1" aria-label="Primary navigation">
          {nav.map((item) => {
            const isActive = item.exact ? location === item.href : location.startsWith(item.href);
            return (
              <Link 
                key={item.href} 
                href={item.href}
                data-testid={`link-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => setMobileNav(false)}
                className={`cc-focus flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium ${isActive ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
                {isActive && <span className="ml-auto size-1.5 rounded-full bg-sidebar-primary-foreground" />}
              </Link>
            );
          })}
        </nav>
        
        <div className="mt-auto rounded-2xl border border-sidebar-foreground/10 bg-sidebar-accent/60 p-4">
          <div className="mb-2 flex items-center gap-2 text-sidebar-primary">
            <Sparkles size={14} />
            <span className="cc-mono text-[9px] font-bold uppercase tracking-widest">A gentle nudge</span>
          </div>
          <p className="text-xs leading-5 text-sidebar-foreground/70">
            Review what changed before deciding what it means. Every phrase is a bridge.
          </p>
        </div>
        
        <div className="mt-5 flex items-center gap-3 border-t border-sidebar-foreground/10 px-2 pt-5">
          <span className="grid shrink-0 size-8 place-items-center rounded-full font-bold text-[11px] bg-sidebar-primary text-sidebar-primary-foreground">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p data-testid="text-user-name" className="truncate text-sm font-semibold">{viewer?.name || 'Loading...'}</p>
            <p data-testid="text-user-role" className="text-[11px] text-sidebar-foreground/50 truncate">{viewer?.actualRole || 'Role'}</p>
          </div>
          <Link href="/settings" data-testid="link-nav-settings" className="cc-focus rounded-lg p-2 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground" aria-label="Settings">
            <Settings2 size={16} />
          </Link>
        </div>
      </aside>
      
      {mobileNav && <button data-testid="button-close-nav-overlay" className="fixed inset-0 z-20 bg-primary/35 backdrop-blur-sm md:hidden" aria-label="Close navigation overlay" onClick={() => setMobileNav(false)} />}
      
      <main className="md:pl-[244px] flex flex-col min-h-screen">
        <header className="sticky top-0 z-10 flex h-[76px] items-center justify-between border-b border-card-border bg-background/90 px-5 backdrop-blur-xl md:px-10">
          <div className="flex items-center gap-3">
            <button data-testid="button-open-nav" className="cc-focus rounded-xl p-2 md:hidden text-foreground hover:bg-muted" aria-label="Open navigation" onClick={() => setMobileNav(true)}>
              <Menu size={21} />
            </button>
            <div className="hidden text-sm text-muted-foreground sm:block">
              Workspace <span className="mx-2">/</span> <strong className="text-foreground">ChildLed</strong>
            </div>
            <span className="cc-serif text-xl font-semibold sm:hidden">ChildLed</span>
          </div>
          
          <div className="flex items-center gap-2">
            <button className="cc-focus rounded-xl p-2.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Help">
              <CircleHelp size={18} />
            </button>
            <button className="cc-focus relative rounded-xl p-2.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Notifications">
              <Bell size={18} />
              <span className="absolute right-2 top-2 size-1.5 rounded-full bg-accent" />
            </button>
          </div>
        </header>
        
        <div className="flex-1 mx-auto w-full max-w-[1380px] px-5 py-8 md:px-10 md:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}