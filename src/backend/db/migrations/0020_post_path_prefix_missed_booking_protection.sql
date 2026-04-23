-- Rename marketing hub cluster: /phone-booking-recovery → /missed-booking-protection
UPDATE "Post"
SET "pathPrefix" = 'missed-booking-protection'
WHERE "pathPrefix" = 'phone-booking-recovery';
