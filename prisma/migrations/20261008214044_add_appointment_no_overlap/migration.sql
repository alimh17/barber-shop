CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Appointment"
ADD CONSTRAINT "appointment_no_overlap"
EXCLUDE USING gist (
  "barberId" gist_text_ops WITH =,
  tsrange("startAt", "endAt", '[)') WITH &&
)
WHERE ("status" IN ('PENDING', 'CONFIRMED'));