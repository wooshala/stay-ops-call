-- Add android_agent to calls source_type check constraint.
-- Server upload route already handles android_agent (dedup, call_upload_jobs tracking).
ALTER TABLE calls DROP CONSTRAINT IF EXISTS calls_source_type_check;
ALTER TABLE calls ADD CONSTRAINT calls_source_type_check
  CHECK (source_type IN ('internal', 'external', 'smartcall', 'android_agent'));
