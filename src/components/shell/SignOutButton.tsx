import { LogOut } from "lucide-react";

// Posts to the sign-out route handler. Label hides on the collapsed rail.
export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action="/auth/signout" method="post" className={className}>
      <button
        type="submit"
        className="flex w-full items-center justify-center gap-2 rounded-lg py-1.5 text-[13px] font-medium text-bone/70 transition-colors hover:bg-bone/[0.06] hover:text-bone md:justify-start md:px-2"
        aria-label="Sign out"
      >
        <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
        <span className="hidden md:inline">Sign out</span>
      </button>
    </form>
  );
}
