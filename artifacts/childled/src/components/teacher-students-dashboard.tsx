import { type ReactNode, type ButtonHTMLAttributes, useState, useMemo, type ElementType } from 'react';
import { Search, UserRound, ArrowRight, BookOpen } from 'lucide-react';

export interface DashboardStudent {
  id: number;
  name: string;
  school: string;
  grade: string;
  communicationStyle: string;
  gestaltCount?: number;
  strengths?: string[];
  sensoryPreferences?: string[];
  specialInterests?: string[];
  regulationNotes?: string;
}

interface TeacherStudentsDashboardProps {
  children: DashboardStudent[];
  loading?: boolean;
  onOpenStudent: (id: number) => void;
}

// Internal UI Components matching App.tsx conventions
function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'quiet' | 'outline' | 'warm'; 'data-testid'?: string }) {
  const styles = {
    primary: 'bg-primary text-primary-foreground shadow-[0_10px_20px_-14px_hsl(var(--brand-forest-950)/.9)] hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-md focus-ring',
    quiet: 'bg-transparent text-muted-foreground hover:bg-secondary hover:text-primary focus-ring',
    outline: 'border border-primary/20 bg-card text-primary shadow-sm hover:border-primary/45 hover:bg-secondary/70 focus-ring',
    warm: 'gold-action text-accent-foreground hover:-translate-y-0.5 hover:brightness-[1.03] hover:shadow-md focus-ring',
  };
  return (
    <button 
      {...props} 
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function SectionHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <p className="mono mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</p>}
        <h1 data-testid={`heading-${title.toLowerCase().replaceAll(' ', '-')}`} className="serif text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{title}</h1>
        {description && <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="w-full shrink-0 md:w-auto">{action}</div>}
    </div>
  );
}

function EmptyState({ icon: Icon, title, body, action }: { icon: ElementType; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="brand-card rounded-2xl border border-dashed border-border bg-card/75 px-6 py-12 text-center">
      <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
        <Icon size={22} />
      </div>
      <h3 className="serif text-xl font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function LoadingBlocks() {
  return (
    <div className="space-y-4" aria-label="Loading content" data-testid="status-loading">
      <div className="skeleton h-28 rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="skeleton h-64 rounded-3xl" />
        <div className="skeleton h-64 rounded-3xl" />
        <div className="skeleton hidden h-64 rounded-3xl lg:block" />
      </div>
    </div>
  );
}

function StudentCard({ student, onOpen }: { student: DashboardStudent; onOpen: () => void }) {
  return (
    <article 
      className="group flex flex-col justify-between overflow-hidden rounded-3xl border border-border bg-card soft-shadow transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"
      data-testid={`student-card-${student.id}`}
    >
      <div className="p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary/10 text-xl font-bold text-primary ring-1 ring-primary/20">
              {student.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="serif text-2xl font-semibold text-foreground">{student.name}</h3>
              <p className="mt-0.5 text-xs font-medium text-muted-foreground">{student.grade} • {student.school}</p>
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <p className="mono mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Communication</p>
            <p className="line-clamp-2 text-sm leading-relaxed text-foreground/80">{student.communicationStyle || 'No notes available.'}</p>
          </div>

          {(student.specialInterests && student.specialInterests.length > 0) && (
            <div>
               <p className="mono mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Interests</p>
               <div className="flex flex-wrap gap-1.5">
                 {student.specialInterests.slice(0, 3).map((interest, i) => (
                   <span key={i} className="rounded-md bg-secondary/70 px-2 py-1 text-[11px] font-medium text-secondary-foreground">{interest}</span>
                 ))}
                 {student.specialInterests.length > 3 && (
                   <span className="rounded-md bg-secondary/40 px-2 py-1 text-[11px] font-medium text-muted-foreground">+{student.specialInterests.length - 3}</span>
                 )}
               </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto border-t border-border/50 bg-secondary/10 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <BookOpen size={14} className="text-primary/70" />
            <span>{student.gestaltCount ?? 0} phrases</span>
          </div>
          <Button variant="outline" onClick={onOpen} className="bg-card px-3 py-2 text-xs hover:bg-primary/5">
            Open Profile <ArrowRight size={14} />
          </Button>
        </div>
      </div>
    </article>
  );
}

export function TeacherStudentsDashboard({
  children = [],
  loading = false,
  onOpenStudent,
}: TeacherStudentsDashboardProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return children;
    const lower = search.toLowerCase();
    return children.filter(c => 
      c.name.toLowerCase().includes(lower) || 
      c.school.toLowerCase().includes(lower) ||
      c.grade.toLowerCase().includes(lower) ||
      (c.communicationStyle && c.communicationStyle.toLowerCase().includes(lower))
    );
  }, [children, search]);

  return (
    <div className="animate-rise space-y-8">
      <SectionHeading
        eyebrow="Classroom Portal"
        title="My students"
        description="Access communication profiles, phrase dictionaries, and shared observations for your assigned students."
        action={
          <div className="relative w-full md:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search students..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="focus-ring w-full rounded-xl border border-border bg-card py-2.5 pl-9 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground"
            />
          </div>
        }
      />

      {loading ? (
        <LoadingBlocks />
      ) : children.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="No students assigned yet"
          body="When a clinician or administrator assigns students to your classroom, their communication profiles will appear here."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matches found"
          body={`We couldn't find any students matching "${search}".`}
          action={
            <Button variant="outline" onClick={() => setSearch('')}>
              Clear search
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((student) => (
            <StudentCard 
              key={student.id} 
              student={student} 
              onOpen={() => onOpenStudent(student.id)} 
            />
          ))}
        </div>
      )}
    </div>
  );
}
