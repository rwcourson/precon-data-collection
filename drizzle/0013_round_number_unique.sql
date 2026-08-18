-- Renumber any duplicate (job_id, round_number) rows past the job's current max
-- (keeping the oldest row's number) so the unique index can be created safely.
WITH ranked AS (
  SELECT id, job_id,
         row_number() OVER (PARTITION BY job_id, round_number ORDER BY id) AS rn
  FROM estimate_rounds
),
maxes AS (
  SELECT job_id, max(round_number) AS max_round
  FROM estimate_rounds
  GROUP BY job_id
),
dups AS (
  SELECT r.id, r.job_id,
         row_number() OVER (PARTITION BY r.job_id ORDER BY r.id) AS seq
  FROM ranked r
  WHERE r.rn > 1
)
UPDATE estimate_rounds e
SET round_number = m.max_round + d.seq
FROM dups d
JOIN maxes m ON m.job_id = d.job_id
WHERE e.id = d.id;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS estimate_rounds_job_round_number_unique ON estimate_rounds (job_id, round_number);
