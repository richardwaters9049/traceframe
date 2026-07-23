ALTER TABLE "source_observations"
  DROP CONSTRAINT "source_observations_kind_check";

ALTER TABLE "source_observations"
  ADD CONSTRAINT "source_observations_kind_check"
  CHECK ("kind" IN ('ipv4', 'url', 'email', 'domain', 'sha256', 'user_agent'));
