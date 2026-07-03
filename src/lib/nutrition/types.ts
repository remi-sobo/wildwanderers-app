// A normalized food result, whatever provider it came from. Macros are for
// the stated serving. We cache these in food_items on log (see upsert_food_item).
export type FoodCandidate = {
  source: "usda" | "openfoodfacts";
  external_id: string;
  name: string;
  brand: string | null;
  serving: string; // human label, e.g. "100 g" or "1 serving (30 g)"
  calories: number | null;
  protein_g: number | null;
  carb_g: number | null;
  fat_g: number | null;
};
