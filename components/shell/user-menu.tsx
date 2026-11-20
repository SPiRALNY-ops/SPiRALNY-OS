import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getSession } from "@/lib/auth/session";
import { signOut } from "@/app/sign-in/actions";
import { ThemeToggle } from "./theme-toggle";

const ROLE_LABEL = { owner: "Owner", team: "Spiral NY team", opslabs: "OpsLabs" } as const;

/** Signed-in person, theme switch and sign-out. Reads the session: render inside <Suspense>. */
export async function UserMenu() {
  const session = await getSession();
  const user = session.status === "signed-in" ? session.user : null;
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user?.name ?? user?.email ?? "Not signed in"}</p>
        {user && <p className="truncate text-xs text-muted-foreground">{ROLE_LABEL[user.role]}</p>}
      </div>
      <ThemeToggle />
      {user && (
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="icon" aria-label="Sign out" title="Sign out">
            <LogOut className="size-4" />
          </Button>
        </form>
      )}
    </div>
  );
}

export function UserMenuSkeleton() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="size-8 rounded-md" />
    </div>
  );
}
