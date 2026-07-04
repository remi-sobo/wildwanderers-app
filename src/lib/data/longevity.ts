import { createClient } from "@/lib/supabase/server";
import {
  assembleLongevity,
  PILLAR_ORDER,
  PILLAR_LABEL,
  type CatalogRow,
  type Longevity,
  type PillarKey,
  type ResultRow,
} from "@/lib/data/wellness";

// A client's longevity profile for the coach. RLS scopes the results read to
// the coach's org (staff_manage_results). Body composition shows only if the
// client themselves opted in, so the coach respects that private toggle.
export async function getClientLongevity(clientId: string): Promise<Longevity> {
  const supabase = await createClient();
  const [{ data: bodyConsent }, { data: catalog }, { data: results }] = await Promise.all([
    supabase
      .from("consents")
      .select("id")
      .eq("client_id", clientId)
      .eq("kind", "body_composition")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("assessments")
      .select("id, name, slug, pillar, unit, higher_is_better, how_to, is_body_composition")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("assessment_results")
      .select("assessment_id, value, value_text, band, taken_on")
      .eq("client_id", clientId)
      .eq("subject", "client")
      .order("taken_on", { ascending: true }),
  ]);

  // hasConsent is not needed for the coach panel; pass true so it never gates.
  return assembleLongevity(
    (catalog ?? []) as CatalogRow[],
    (results ?? []) as ResultRow[],
    true,
    Boolean(bodyConsent),
  );
}

export type CatalogTest = {
  id: string;
  name: string;
  slug: string;
  pillar: PillarKey;
  unit: string;
  higherIsBetter: boolean;
  howTo: string | null;
  bandImproving: number | null;
  bandHealthy: number | null;
  boysExperienceName: string | null;
  isBodyComposition: boolean;
  isActive: boolean;
};

export type CatalogGroup = { pillar: PillarKey; label: string; tests: CatalogTest[] };

// The full assessment catalog for the staff editor: every test, active or not,
// with its editable bands. Staff-only by RLS (staff_manage_assessments).
export async function getAssessmentCatalog(): Promise<CatalogGroup[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assessments")
    .select(
      "id, name, slug, pillar, unit, higher_is_better, how_to, band_improving, band_healthy, boys_experience_name, is_body_composition, is_active",
    )
    .order("name", { ascending: true });

  const tests: CatalogTest[] = (data ?? []).map((a) => ({
    id: a.id as string,
    name: a.name as string,
    slug: a.slug as string,
    pillar: a.pillar as PillarKey,
    unit: a.unit as string,
    higherIsBetter: a.higher_is_better as boolean,
    howTo: (a.how_to as string | null) ?? null,
    bandImproving: (a.band_improving as number | null) ?? null,
    bandHealthy: (a.band_healthy as number | null) ?? null,
    boysExperienceName: (a.boys_experience_name as string | null) ?? null,
    isBodyComposition: a.is_body_composition as boolean,
    isActive: a.is_active as boolean,
  }));

  return PILLAR_ORDER.map((p) => ({
    pillar: p,
    label: PILLAR_LABEL[p],
    tests: tests.filter((t) => t.pillar === p),
  })).filter((g) => g.tests.length > 0);
}
