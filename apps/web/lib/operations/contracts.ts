export type OperationalState = "available" | "degraded" | "unavailable";
export type OperationalServiceId = "web" | "database" | "worker" | "storage";

export type OperationalService = {
  id: OperationalServiceId;
  state: OperationalState;
  detail: string;
  lastSeenAt: string | null;
};

export type OperationsStatus = {
  status: "operational" | "degraded";
  checkedAt: string;
  services: OperationalService[];
  pipeline: {
    queued: number;
    processing: number;
    failed: number;
    disposalPending: number;
  };
};

const WORKER_AVAILABLE_MS = 30_000;
const WORKER_DEGRADED_MS = 120_000;

export function classifyWorkerHeartbeat(
  lastSeenAt: string | null,
  checkedAt: Date,
): OperationalState {
  if (!lastSeenAt) return "unavailable";
  const lastSeenTime = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(lastSeenTime)) return "unavailable";
  const age = Math.max(0, checkedAt.getTime() - lastSeenTime);
  if (age <= WORKER_AVAILABLE_MS) return "available";
  if (age <= WORKER_DEGRADED_MS) return "degraded";
  return "unavailable";
}
