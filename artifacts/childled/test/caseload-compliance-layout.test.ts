import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("shows one service directly and expands only multi-service students", async () => {
  const appSource = await readFile(
    new URL("../src/App.tsx", import.meta.url),
    "utf8",
  );
  const pageStart = appSource.indexOf("function CaseloadOverviewPage(");
  const pageEnd = appSource.indexOf(
    "\nconst childProfileIncomplete",
    pageStart,
  );
  const pageSource = appSource.slice(pageStart, pageEnd);
  const desktopStudentStart = pageSource.indexOf(
    "data-testid={`overview-student-${student.childId}`}",
  );
  const desktopStudentEnd = pageSource.indexOf(
    "{expanded && student.serviceRequirements.length",
    desktopStudentStart,
  );
  const desktopStudentRow = pageSource.slice(
    desktopStudentStart,
    desktopStudentEnd,
  );
  const mobileStudentStart = pageSource.indexOf(
    "data-testid={`overview-student-mobile-${student.childId}`}",
  );
  const mobileStudentEnd = pageSource.indexOf(
    "{expanded ? (",
    mobileStudentStart,
  );
  const mobileStudentRow = pageSource.slice(
    mobileStudentStart,
    mobileStudentEnd,
  );

  assert.match(pageSource, /const \[expandedStudents, setExpandedStudents\]/);
  assert.match(pageSource, /useState<Set<number>>\(\s*\(\) => new Set\(\)/);
  assert.equal(
    pageSource.match(
      /const hasMultipleServices\s*=\s*student\.serviceRequirements\.length > 1;/g,
    )?.length,
    2,
  );
  assert.equal(
    pageSource.match(
      /const expanded\s*=\s*!hasMultipleServices\s*\|\|\s*expandedStudents\.has\(student\.childId\);/g,
    )?.length,
    2,
  );
  assert.match(
    pageSource,
    /\{student\.serviceRequirements\.length !== 1 \? \(/,
  );
  assert.ok(/\{hasMultipleServices \? \([\s\S]*?<ChevronDown/.test(pageSource));
  assert.ok(/\) : \(\s*studentIdentity\s*\)\}/.test(pageSource));
  assert.match(
    pageSource,
    /\{expanded && student\.serviceRequirements\.length/,
  );
  assert.ok(/\{hasMultipleServices \? "pl-9" : ""\}/.test(pageSource));
  assert.match(
    pageSource,
    /\{hasMultipleServices \? \([\s\S]*?services[\s\S]*?\) : null\}/,
  );
  assert.match(desktopStudentRow, /colSpan=\{4\}/);
  assert.match(desktopStudentRow, /active\s+services/);
  assert.doesNotMatch(desktopStudentRow, /1 active service/);
  assert.doesNotMatch(
    desktopStudentRow,
    /statusBadge\(student\.serviceStatus\)/,
  );
  assert.doesNotMatch(
    desktopStudentRow,
    /total(?:Required|Completed|Missed|Remaining)/,
  );
  assert.doesNotMatch(
    mobileStudentRow,
    /statusBadge\(student\.serviceStatus\)/,
  );
  assert.match(pageSource, /statusBadge\(service\.status\)/);
  assert.match(
    pageSource,
    /serviceStatus === "on_track" \|\| serviceStatus === "complete"/,
  );
  assert.match(appSource, /label: "Behind on sessions"/);
  assert.match(appSource, /label: "Below expected pace"/);
  assert.match(pageSource, /service\.sessionsCompleted/);
  assert.match(pageSource, /sessionsAccountedFor\(service\)/);
  assert.match(pageSource, /sessionRequirementProgress\(service\)/);
  assert.match(pageSource, /accounted for/);
  assert.match(pageSource, /Delivered: \{service\.sessionsCompleted\}/);
  assert.match(pageSource, /service\.sessionsMissed/);
  assert.match(pageSource, /service\.sessionsRemaining/);
  assert.match(pageSource, /service\.outstandingMakeups/);
  assert.match(pageSource, /service\.minutesCompleted/);
  assert.match(pageSource, /service\.minutesRemaining/);
  assert.match(pageSource, /service\.lastSessionDate/);
  assert.match(pageSource, /Sessions: \{service\.sessionsRemaining\}/);
  assert.match(pageSource, /Minutes: \{service\.minutesRemaining\} min/);
  assert.match(pageSource, /Makeups: \{service\.outstandingMakeups\}/);
  assert.match(pageSource, /Sessions accounted for/);
  assert.match(pageSource, /Outstanding makeups/);
  assert.match(pageSource, /service\.customFrequencyDescription/);
  assert.match(pageSource, /onOpenProfile\(student\.childId\)/);
  assert.match(pageSource, /title="View student profile"/);
  assert.match(pageSource, /aria-label="View student profile"/);
  assert.match(pageSource, /<UserRound/);
  assert.doesNotMatch(pageSource, /onOpenCareTeam/);
  assert.match(appSource, /onOpenProfile=\{openChildWorkspace\}/);
  assert.match(appSource, /if \(section === "team"\)/);
  assert.match(pageSource, /Choose a service to log/);
  assert.match(pageSource, /table-fixed/);
  assert.doesNotMatch(pageSource, /overflow-x-auto/);
});

test("keeps Add Student above four balanced Quick Actions", async () => {
  const appSource = await readFile(
    new URL("../src/App.tsx", import.meta.url),
    "utf8",
  );
  const actionsStart = appSource.indexOf("function ClinicianQuickActions(");
  const actionsEnd = appSource.indexOf("\nfunction ", actionsStart + 1);
  const actionsSource = appSource.slice(actionsStart, actionsEnd);
  const overviewStart = appSource.indexOf("function CaseloadOverviewPage(");
  const overviewSource = appSource.slice(overviewStart);

  assert.ok(actionsStart >= 0);
  assert.ok(overviewStart >= 0);
  assert.doesNotMatch(
    actionsSource,
    /onAddStudent|button-overview-quick-add-student/,
  );
  assert.match(actionsSource, /grid-cols-2 gap-3 md:grid-cols-4/);
  for (const label of [
    "Record Session",
    "Track Manually",
    "Add Phrase",
    "Inbox",
  ]) {
    assert.match(actionsSource, new RegExp(`label: "${label}"`));
  }
  assert.match(overviewSource, /data-testid="button-overview-add-student"/);
  assert.match(overviewSource, /onClick=\{onAddStudent\}/);
});

test("caseload actions show distinct, accessible service and profile icons", async () => {
  const appSource = await readFile(
    new URL("../src/App.tsx", import.meta.url),
    "utf8",
  );
  const pageStart = appSource.indexOf("function CaseloadOverviewPage(");
  const pageEnd = appSource.indexOf("\nconst childProfileIncomplete", pageStart);
  const pageSource = appSource.slice(pageStart, pageEnd);
  const desktopTable = pageSource.slice(
    pageSource.indexOf('<div className="hidden lg:block">'),
    pageSource.indexOf('className="divide-y-[10px] divide-muted/80 lg:hidden"'),
  );

  assert.equal((desktopTable.match(/title="Add service"/g) ?? []).length, 2);
  assert.equal((desktopTable.match(/aria-label="Add service"/g) ?? []).length, 2);
  assert.equal(
    (desktopTable.match(/title="View student profile"/g) ?? []).length,
    2,
  );
  assert.equal(
    (desktopTable.match(/aria-label="View student profile"/g) ?? []).length,
    2,
  );
  assert.equal(
    (desktopTable.match(/data-testid=\{`button-add-service-\$\{student\.childId\}`\}/g) ?? [])
      .length,
    2,
  );
  assert.equal(
    (desktopTable.match(/data-testid=\{`button-view-student-profile-\$\{student\.childId\}`\}/g) ?? [])
      .length,
    2,
  );
  assert.equal((desktopTable.match(/<Plus\s+aria-hidden="true"/g) ?? []).length, 2);
  assert.equal((desktopTable.match(/<UserRound\s+aria-hidden="true"/g) ?? []).length, 2);
  assert.equal(
    (
      desktopTable.match(
        /className="size-9 min-h-9 shrink-0 bg-card !p-0 text-primary"/g,
      ) ?? []
    ).length,
    3,
  );
  assert.match(
    pageSource,
    /className="size-9 min-h-9 shrink-0 bg-card !p-0 text-destructive"/,
  );
  assert.equal((pageSource.match(/aria-label="Add service"/g) ?? []).length, 3);
  assert.match(pageSource, /className="!size-5 shrink-0 stroke-current"/);
  assert.match(desktopTable, /setEditingStudent\(\{\s*childId: student\.childId/);
  assert.match(desktopTable, /onOpenProfile\(student\.childId\)/);
  assert.doesNotMatch(desktopTable, /onOpenCareTeam/);
});
