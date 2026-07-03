import { LogOut } from "lucide-react";

// Posts to the sign-out route handler. Rendered inside both shells.
export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action="/auth/signout" method="post" className={className}>
      <button
        type="submit"
        className="flex items-center gap-2 text-[13px] font-medium text-bone/70 transition-colors hover:text-bone"
      >
        <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
        Sign out
      </button>
    </form>
  );
}
