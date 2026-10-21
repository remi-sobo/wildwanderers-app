"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getSessionProfile } from "@/lib/auth/get-profile";
import { OWNER_HQ_COOKIE, ownerHqMode, ownerHqOffered } from "./owner-hq-rule";

// The owner's own layout choice, kept in a cookie on this device. Only
// the owner, and only on a deployment that offers the new layout.
export async function setOwnerHqLayout(on: boolean): Promise<{ error: string | null }> {
  const session = await getSessionProfile();
  if (!session?.profile) return { error: "You are signed out." };
  if (!ownerHqOffered(session.profile.role, ownerHqMode(process.env.OWNER_HQ))) {
    return { error: "The new layout is not available here yet." };
  }
  (await cookies()).set(OWNER_HQ_COOKIE, on ? "1" : "0", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
  return { error: null };
}
