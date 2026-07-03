import "server-only";
import type { FoodCandidate } from "@/lib/nutrition/types";

// The nutrition providers, both free (decision 1): USDA FoodData Central for
// whole and generic foods, Open Food Facts for branded and barcode items. We
// never build a food database; results are cached in food_items on log.

const round = (n: number | null | undefined): number | null =>
  n == null || !Number.isFinite(n) ? null : Math.round(n * 10) / 10;

// ── USDA FoodData Central ────────────────────────────────────
// Nutrients come per 100 g for Foundation/SR foods; branded items carry a
// serving. We label what we return so a client sees the basis.
// In the foods/search response each nutrient carries both a numeric
// nutrientId (Energy kcal = 1008) and a string nutrientNumber (Energy = "208").
// We match on nutrientId, which is stable across food types.
type FdcNutrient = {
  nutrientId?: number;
  nutrientName?: string;
  nutrientNumber?: string;
  unitName?: string;
  value?: number;
};
type FdcFood = {
  fdcId?: number;
  description?: string;
  brandOwner?: string;
  brandName?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients?: FdcNutrient[];
};

function fdcNutrient(nutrients: FdcNutrient[] | undefined, ids: number[]): number | null {
  const hit = (nutrients ?? []).find((n) => n.nutrientId != null && ids.includes(n.nutrientId));
  return hit?.value ?? null;
}

// Nutrient ids: Energy kcal (1008, with Atwater fallbacks), Protein (1003),
// Carbohydrate by difference (1005), Total lipid/fat (1004).
const N_ENERGY = [1008, 2047, 2048];
const N_PROTEIN = [1003];
const N_CARB = [1005];
const N_FAT = [1004];

async function searchUsda(query: string, signal: AbortSignal): Promise<FoodCandidate[]> {
  const key = process.env.FDC_API_KEY || "DEMO_KEY";
  const url =
    `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(key)}` +
    `&query=${encodeURIComponent(query)}&pageSize=8` +
    `&dataType=${encodeURIComponent("Foundation,SR Legacy,Branded")}`;

  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const json = (await res.json()) as { foods?: FdcFood[] };

  return (json.foods ?? [])
    .map((f): FoodCandidate | null => {
      if (!f.fdcId || !f.description) return null;
      const serving =
        f.servingSize && f.servingSizeUnit
          ? `${f.servingSize} ${f.servingSizeUnit}`
          : "100 g";
      // Foundation/SR values are per 100 g; scale to the serving if given.
      const scale =
        f.servingSize && f.servingSizeUnit ? f.servingSize / 100 : 1;
      const cal = fdcNutrient(f.foodNutrients, N_ENERGY);
      const pro = fdcNutrient(f.foodNutrients, N_PROTEIN);
      const carb = fdcNutrient(f.foodNutrients, N_CARB);
      const fat = fdcNutrient(f.foodNutrients, N_FAT);
      return {
        source: "usda",
        external_id: String(f.fdcId),
        name: f.description,
        brand: f.brandName || f.brandOwner || null,
        serving,
        calories: round(cal != null ? cal * scale : null),
        protein_g: round(pro != null ? pro * scale : null),
        carb_g: round(carb != null ? carb * scale : null),
        fat_g: round(fat != null ? fat * scale : null),
      };
    })
    .filter((x): x is FoodCandidate => x !== null);
}

// ── Open Food Facts ──────────────────────────────────────────
// Keyless. Nutriments are per 100 g/ml; we label "100 g" for clarity.
type OffProduct = {
  code?: string;
  product_name?: string;
  brands?: string;
  serving_size?: string;
  nutriments?: Record<string, number>;
};

async function searchOpenFoodFacts(query: string, signal: AbortSignal): Promise<FoodCandidate[]> {
  const url =
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}` +
    `&search_simple=1&action=process&json=1&page_size=8` +
    `&fields=code,product_name,brands,serving_size,nutriments`;

  const res = await fetch(url, {
    signal,
    headers: { "User-Agent": "WildWanderers/1.0 (app.wildwanderers.life)" },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { products?: OffProduct[] };

  return (json.products ?? [])
    .map((p): FoodCandidate | null => {
      if (!p.code || !p.product_name) return null;
      const n = p.nutriments ?? {};
      const cal = n["energy-kcal_100g"];
      return {
        source: "openfoodfacts",
        external_id: p.code,
        name: p.product_name,
        brand: p.brands || null,
        serving: "100 g",
        calories: round(cal),
        protein_g: round(n["proteins_100g"]),
        carb_g: round(n["carbohydrates_100g"]),
        fat_g: round(n["fat_100g"]),
      };
    })
    .filter((x): x is FoodCandidate => x !== null);
}

// Search both providers, USDA first, and merge. Each provider is best-effort:
// if one is slow or down, the other still returns. A 6s cap keeps the UI snappy.
export async function searchNutrition(query: string): Promise<FoodCandidate[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const [usda, off] = await Promise.allSettled([
      searchUsda(q, controller.signal),
      searchOpenFoodFacts(q, controller.signal),
    ]);
    const a = usda.status === "fulfilled" ? usda.value : [];
    const b = off.status === "fulfilled" ? off.value : [];
    // USDA first (generic foods lead), then branded from OFF, deduped by name.
    const seen = new Set<string>();
    const merged: FoodCandidate[] = [];
    for (const c of [...a, ...b]) {
      const key = `${c.name.toLowerCase()}|${(c.brand ?? "").toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(c);
    }
    return merged.slice(0, 12);
  } finally {
    clearTimeout(timer);
  }
}
