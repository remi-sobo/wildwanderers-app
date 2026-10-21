import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import type { Role } from "@/lib/auth/get-profile";
import { OWNER_HQ_COOKIE, ownerHqActive, ownerHqMode, ownerHqOffered } from "./owner-hq-rule";

// Reads the owner HQ flag for this request. Cached per request so the
// shell, the landing redirect and the Business page agree.
export const getOwnerHq = cache(
  async (role: Role | undefined): Promise<{ active: boolean; offered: boolean }> => {
    const mode = ownerHqMode(process.env.OWNER_HQ);
    if (!ownerHqOffered(role, mode)) return { active: false, offered: false };
    const cookie = (await cookies()).get(OWNER_HQ_COOKIE)?.value;
    return { active: ownerHqActive(role, mode, cookie), offered: true };
  },
);
