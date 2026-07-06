// The fixed category set for the Trailhead Library. New categories are a
// migration (the post_category enum), never free text. The enum values are the
// database tokens; the labels are what a human reads. Keep the two in lockstep.

export const POST_CATEGORIES = [
  { value: "podcasts", label: "Podcasts" },
  { value: "fitness_updates", label: "Fitness updates" },
  { value: "assessment_breakdowns", label: "Assessment breakdowns" },
  { value: "child_development_and_play", label: "Child development and play" },
  { value: "camping_and_the_outdoors", label: "Camping and the outdoors" },
  { value: "research_and_field_notes", label: "Research and field notes" },
] as const;

export type PostCategory = (typeof POST_CATEGORIES)[number]["value"];

const LABEL = new Map<string, string>(POST_CATEGORIES.map((c) => [c.value, c.label]));

// A category's human label, falling back to the raw token so an unknown value
// never renders blank.
export function categoryLabel(value: string): string {
  return LABEL.get(value) ?? value;
}

export function isPostCategory(value: string): value is PostCategory {
  return LABEL.has(value);
}

export const POST_AUDIENCES = [
  { value: "public", label: "Public", hint: "Anyone, on the site and in the app" },
  { value: "members", label: "Members", hint: "Signed-in clients and families only" },
] as const;

export type PostAudience = (typeof POST_AUDIENCES)[number]["value"];
