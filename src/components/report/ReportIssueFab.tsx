"use client";

// A standalone "Report an issue" floating button for the surfaces without the
// Coach FAB (the client shell). Same reporting flow and drawer as the coach
// entry, just its own amber button. The server actions are org-scoped and
// resolve the reporter server-side, so a client can only ever file for their
// own org.

import { useState } from "react";
import { Flag } from "lucide-react";
import { ReportIssueSheet } from "@/components/report/ReportIssueSheet";

export function ReportIssueFab() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Report an issue"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-amber text-[#23170c] shadow-[0_12px_30px_rgba(120,68,16,0.34)] transition-transform hover:-translate-y-0.5 hover:bg-amber-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber md:bottom-8 md:right-8"
      >
        <Flag size={20} strokeWidth={1.9} aria-hidden="true" />
      </button>
      <ReportIssueSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
