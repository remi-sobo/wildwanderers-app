-- ============================================================
-- Wild Wanderers — Starter exercise library
--
-- A set of standard, editable reference movements for the Wild Wanderers
-- Fitness org, so plan-building has real exercises to pull from on day one.
-- These are common movements, not fabricated client data. Gabe edits and
-- adds his own on top. Idempotent (on conflict do nothing).
-- ============================================================

insert into exercise_library (org_id, title, kind, muscle_group, equipment, default_sets, default_reps, cues)
select o.id, v.title, v.kind::exercise_kind, v.muscle_group, v.equipment, v.default_sets, v.default_reps, v.cues
from (select id from organizations where slug = 'wild-wanderers-fitness') o
cross join (values
  ('Back Squat','strength','Quads and glutes','Barbell',4,'6-8','Brace, sit between the hips, drive through mid-foot.'),
  ('Front Squat','strength','Quads','Barbell',3,'6-8','Tall chest, elbows high, knees track over toes.'),
  ('Goblet Squat','strength','Quads and glutes','Dumbbell',3,'10-12','Hold close to the chest, sit tall, control the descent.'),
  ('Romanian Deadlift','strength','Hamstrings and glutes','Barbell',3,'8-10','Soft knees, push the hips back, feel the hamstrings.'),
  ('Conventional Deadlift','strength','Posterior chain','Barbell',4,'3-5','Flat back, bar over mid-foot, push the floor away.'),
  ('Walking Lunge','strength','Quads and glutes','Dumbbell',3,'10 each leg','Long step, back knee toward the floor, drive up tall.'),
  ('Bulgarian Split Squat','strength','Quads and glutes','Dumbbell',3,'8 each leg','Rear foot elevated, drop straight down, stay upright.'),
  ('Hip Thrust','strength','Glutes','Barbell',3,'10-12','Chin tucked, ribs down, squeeze hard at the top.'),
  ('Leg Press','strength','Quads and glutes','Machine',3,'10-12','Full range, knees track the toes, control the return.'),
  ('Step-Up','strength','Quads and glutes','Dumbbell',3,'10 each leg','Full foot on the box, drive through the heel.'),
  ('Standing Calf Raise','strength','Calves','Machine',3,'12-15','Full stretch at the bottom, pause at the top.'),
  ('Bench Press','strength','Chest and triceps','Barbell',4,'6-8','Set the shoulder blades, bar to lower chest, drive up.'),
  ('Incline Dumbbell Press','strength','Upper chest','Dumbbell',3,'8-10','Thirty-degree bench, control the stretch.'),
  ('Overhead Press','strength','Shoulders','Barbell',3,'6-8','Ribs down, press to lockout, head through at the top.'),
  ('Push-Up','strength','Chest and triceps','Bodyweight',3,'As many as possible','Straight line, elbows about 45 degrees, full range.'),
  ('Dip','strength','Chest and triceps','Bodyweight',3,'8-10','Lean forward for the chest, control the bottom.'),
  ('Pull-Up','strength','Back and biceps','Bodyweight',4,'As many as possible','Full hang, drive the elbows down, chin over the bar.'),
  ('Lat Pulldown','strength','Back','Machine',3,'10-12','Chest tall, pull to the collarbone, control the return.'),
  ('Bent-Over Row','strength','Back','Barbell',3,'8-10','Hinge with a flat back, pull to the belly, squeeze.'),
  ('Seated Cable Row','strength','Back','Cable',3,'10-12','Tall chest, pull to the ribs, no shrug.'),
  ('One-Arm Dumbbell Row','strength','Back','Dumbbell',3,'10 each arm','Flat back, drive the elbow to the hip.'),
  ('Face Pull','strength','Rear delts','Cable',3,'12-15','Pull to the eyes, thumbs back, slow return.'),
  ('Plank','strength','Core','Bodyweight',3,'45 seconds','Squeeze the glutes, ribs down, one straight line.'),
  ('Dead Bug','strength','Core','Bodyweight',3,'8 each side','Low back flat, opposite arm and leg, move slowly.'),
  ('Pallof Press','strength','Core','Cable',3,'10 each side','Resist the rotation, press straight out and back.'),
  ('Hanging Leg Raise','strength','Core','Bodyweight',3,'10-12','No swing, curl the pelvis up.'),
  ('Farmer Carry','strength','Full body and grip','Dumbbell',3,'40 meters','Tall posture, tight grip, walk under control.'),
  ('Rowing Intervals','cardio','Full body','Rower',6,'250 meters','Legs, then hips, then arms. Recover between efforts.'),
  ('Assault Bike Intervals','cardio','Full body','Machine',5,'30 seconds','Hard effort, full rest between rounds.'),
  ('Incline Treadmill Walk','cardio','Legs','Treadmill',1,'20 minutes','Steady incline, easy conversational pace.'),
  ('Easy Run','cardio','Legs','None',1,'20-30 minutes','Conversational pace, relaxed breathing.'),
  ('Jump Rope','cardio','Calves','Rope',5,'60 seconds','Light bounce, let the wrists turn the rope.'),
  ('Worlds Greatest Stretch','mobility','Hips and t-spine','Bodyweight',2,'5 each side','Lunge, rotate, reach tall through the top hand.'),
  ('Cat-Cow','mobility','Spine','Bodyweight',2,'8 reps','Move slowly, breathe with the movement.'),
  ('90-90 Hip Switch','mobility','Hips','Bodyweight',2,'8 each side','Tall spine, rotate from the hips.'),
  ('Arm Circles','warmup','Shoulders','Bodyweight',1,'20 reps','Small to large, both directions.'),
  ('Cooldown Walk','cooldown','Legs','None',1,'5-10 minutes','Easy pace, bring the heart rate back down.'),
  ('Foam Roll Quads','cooldown','Quads','Foam roller',1,'60 seconds each side','Slow passes, pause on the tender spots.')
) as v(title, kind, muscle_group, equipment, default_sets, default_reps, cues)
on conflict (org_id, title) do nothing;
