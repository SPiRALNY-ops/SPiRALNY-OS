import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { signOut } from "@/app/sign-in/actions";
import { ThemeToggle } from "./theme-toggle";

const ROLE_LABEL = { owner: "Owner", team: "Spiral NY team", opslabs: "OpsLabs" } as const;
const ICON_BUTTON = "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground";

function initials(name: string): string {
  const parts = name.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Signed-in person, theme switch and sign-out, styled for the charcoal sidebar. Render inside <Suspense>. */
export async function UserMenu() {
  const session = await getSession();
  const user = session.status === "signed-in" ? session.user : null;
  const name = user?.name ?? user?.email ?? "Not signed in";
  // The second line says who this is: the role, or the email when the name already says the role.
  const detail = user ? (user.name && user.name !== ROLE_LABEL[user.role] ? ROLE_LABEL[user.role] : user.email) : null;
  return (
    <div className="flex items-center gap-2.5">
      {/* Charcoal on orange is 4.7:1, so the initials stay readable. */}
      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-[#252526]">
        {initials(name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-sidebar-foreground">{name}</p>
        {detail && (
          <p className="truncate text-xs text-sidebar-muted" title={detail}>
            {detail}
          </p>
        )}
      </div>
      <ThemeToggle className={ICON_BUTTON} />
      {user && (
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="icon" aria-label="Sign out" title="Sign out" className={ICON_BUTTON}>
            <LogOut className="size-4" />
          </Button>
        </form>
      )}
    </div>
  );
}

export function UserMenuSkeleton() {
  return (
    <div className="flex items-center gap-2.5" aria-hidden>
      <span className="size-8 rounded-full bg-sidebar-accent" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-28 rounded bg-sidebar-accent" />
        <div className="h-3 w-16 rounded bg-sidebar-accent" />
      </div>
    </div>
  );
}
