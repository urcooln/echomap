import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("blocked Clerk sessions can retry or sign out before navigating", async () => {
  const appSource = await readFile(
    new URL("../src/App.tsx", import.meta.url),
    "utf8",
  );

  assert.match(appSource, /body\?\.code === "not_invited"/);
  assert.match(
    appSource,
    /const leaveBlockedSession = async[\s\S]*?await signOut\(\{ redirectUrl: target \}\)/,
  );
  assert.match(
    appSource,
    /onClick=\{\(\) => void leaveBlockedSession\("\/sign-in"\)\}/,
  );
  assert.match(
    appSource,
    /onClick=\{\(\) => void leaveBlockedSession\("\/"\)\}/,
  );
});

test("an authenticated Clerk invitee bypasses pending-token validation", async () => {
  const appSource = await readFile(
    new URL("../src/App.tsx", import.meta.url),
    "utf8",
  );
  const pageStart = appSource.indexOf("function SignUpPage()");
  const pageEnd = appSource.indexOf("\nconst rawClerkProxyUrl", pageStart);
  const pageSource = appSource.slice(pageStart, pageEnd);

  assert.notEqual(pageStart, -1);
  assert.notEqual(pageEnd, -1);
  assert.match(pageSource, /const \{ isLoaded, isSignedIn \} = useAuth\(\)/);
  assert.match(
    pageSource,
    /if \(!isLoaded \|\| !isSignedIn\) return;[\s\S]*?window\.location\.replace\(target\)/,
  );
  assert.match(
    pageSource,
    /if \(!isLoaded \|\| isSignedIn\) return;[\s\S]*?\/api\/invitations\/validate/,
  );
});

test("a signed Clerk invitation ticket reaches Clerk without a second token gate", async () => {
  const appSource = await readFile(
    new URL("../src/App.tsx", import.meta.url),
    "utf8",
  );
  const pageStart = appSource.indexOf("function SignUpPage()");
  const pageEnd = appSource.indexOf("\nconst rawClerkProxyUrl", pageStart);
  const pageSource = appSource.slice(pageStart, pageEnd);

  assert.match(pageSource, /searchParams\.get\("__clerk_ticket"\)/);
  assert.match(
    pageSource,
    /if \(clerkTicket\) \{[\s\S]*?setTokenStatus\("valid"\);[\s\S]*?return;/,
  );
  assert.match(
    pageSource,
    /signInSearch\.set\("__clerk_ticket", clerkTicket\)/,
  );
  assert.match(pageSource, /forceRedirectUrl=\{redirectTarget\}/);
});
