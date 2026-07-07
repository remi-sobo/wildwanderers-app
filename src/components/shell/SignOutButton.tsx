import { LogOut } from "lucide-react";

// Posts to the sign-out route handler. `tall` gives it a full touch-height
// row for the mobile More sheet; the desktop rail keeps the compact form.
export function SignOutButton({ className, tall = false }: { className?: string; tall?: boolean }) {
  return (
    <form action="/auth/signout" method="post" className={className}>
      <button
        type="submit"
        className={`flex w-full items-center gap-2 rounded-lg px-2 text-left font-medium text-bone/70 transition-colors hover:bg-bone/[0.06] hover:text-bone ${
          tall ? "min-h-[48px] py-3 text-[14px]" : "py-1.5 text-[13px]"
        }`}
      >
        <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
        <span>Sign out</span>
      </button>
    </form>
  );
}
