"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-profile";
import { getMyClient } from "@/lib/data/training";
import { auditLog } from "@/lib/audit/log";
import { searchNutrition } from "@/lib/nutrition/providers";
import type { FoodCandidate } from "@/lib/nutrition/types";

export type FoodSearchResult = { candidates: FoodCandidate[]; error: string | null };

// Search the nutrition providers (USDA + Open Food Facts). Server-only so the
// API keys and hosts never touch the browser.
export async function searchFoods(query: string): Promise<FoodSearchResult> {
  const session = await getSessionProfile();
  if (!session?.profile) return { candidates: [], error: "You are signed out." };
  try {
    const candidates = await searchNutrition(query);
    return { candidates, error: null };
  } catch {
    return { candidates: [], error: "Search is unavailable right now. Try again." };
  }
}

export type LogFoodInput = {
  candidate: FoodCandidate;
  meal: "breakfast" | "lunch" | "dinner" | "snack";
  quantity: string; // servings multiplier, default "1"
};

export type ActionResult = { error: string | null };

// Cache the chosen food in food_items (through the upsert_food_item chokepoint
// so a client needs no table grant), then log it against the client. Macros
// scale by the servings quantity.
export async function logFood(input: LogFoodInput): Promise<ActionResult> {
  const session = await getSessionProfile();
  const client = await getMyClient();
  if (!session?.profile || !client) return { error: "You are signed out." };

  const c = input.candidate;
  const qty = Math.max(0.1, Number(input.quantity) || 1);
  const supabase = await createClient();

  // Cache the food item (definer RPC; org-scoped to the caller).
  const { data: foodItemId, error: cacheErr } = await supabase.rpc("upsert_food_item", {
    p_source: c.source,
    p_external_id: c.external_id,
    p_name: c.name,
    p_brand: c.brand,
    p_serving: c.serving,
    p_calories: c.calories,
    p_protein_g: c.protein_g,
    p_carb_g: c.carb_g,
    p_fat_g: c.fat_g,
  });
  if (cacheErr) return { error: "That did not save. Try again." };

  const scale = (v: number | null) => (v == null ? null : Number((v * qty).toFixed(1)));
  const { error } = await supabase.from("food_logs").insert({
    org_id: session.profile.org_id,
    client_id: client.id,
    meal: input.meal,
    food_item_id: (foodItemId as string) ?? null,
    description: c.name,
    quantity: qty,
    calories: scale(c.calories),
    protein_g: scale(c.protein_g),
    carb_g: scale(c.carb_g),
    fat_g: scale(c.fat_g),
  });
  if (error) return { error: "That did not save. Try again." };

  await auditLog({
    actorId: session.userId,
    orgId: session.profile.org_id,
    action: "food.create",
    entityTable: "food_logs",
    entityId: client.id,
    metadata: { meal: input.meal, source: c.source },
  });

  revalidatePath("/log");
  return { error: null };
}

// Remove a food log entry (the client's own). RLS enforces ownership.
export async function deleteFoodLog(id: string): Promise<ActionResult> {
  const client = await getMyClient();
  if (!client) return { error: "You are signed out." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("food_logs")
    .delete()
    .eq("id", id)
    .eq("client_id", client.id);
  if (error) return { error: "That did not save. Try again." };
  revalidatePath("/log");
  return { error: null };
}
