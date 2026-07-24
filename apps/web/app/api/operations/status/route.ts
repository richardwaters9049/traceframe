import { can } from "@/lib/auth/authorization";
import { getCurrentUser } from "@/lib/auth/session";
import { getRequestId, jsonResponse, requestLog } from "@/lib/http/security";
import {
  classifyWorkerHeartbeat,
  type OperationalService,
  type OperationsStatus,
} from "@/lib/operations/contracts";
import { getOperationsSnapshot } from "@/lib/operations/repository";
import { probeSourceStorage } from "@/lib/storage/minio";

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const user = await getCurrentUser();
    if (!user) {
      return jsonResponse(
        { error: "Authentication required." },
        401,
        requestId,
      );
    }
    if (!can(user, "cases:read")) {
      return jsonResponse({ error: "Access denied." }, 403, requestId);
    }

    const storageAvailable = await probeSourceStorage()
      .then(() => true)
      .catch((error) => {
        requestLog("warn", "operations.storage.unavailable", requestId, {
          error: error instanceof Error ? error.name : "unknown",
        });
        return false;
      });
    const snapshot = await getOperationsSnapshot();
    const checkedAt = new Date();
    const workerState = classifyWorkerHeartbeat(
      snapshot.workerLastSeenAt,
      checkedAt,
    );
    const services: OperationalService[] = [
      {
        id: "web",
        state: "available",
        detail: "Authenticated status request served",
        lastSeenAt: checkedAt.toISOString(),
      },
      {
        id: "database",
        state: "available",
        detail: "Operational query completed",
        lastSeenAt: checkedAt.toISOString(),
      },
      {
        id: "worker",
        state: workerState,
        detail:
          workerState === "available"
            ? "Background heartbeat is current"
            : workerState === "degraded"
              ? "Background heartbeat is delayed"
              : "No current background heartbeat",
        lastSeenAt: snapshot.workerLastSeenAt,
      },
      {
        id: "storage",
        state: storageAvailable ? "available" : "unavailable",
        detail: storageAvailable
          ? "Source-material bucket is reachable"
          : "Source-material bucket is unavailable",
        lastSeenAt: storageAvailable ? checkedAt.toISOString() : null,
      },
    ];
    const response: OperationsStatus = {
      status: services.every((service) => service.state === "available")
        ? "operational"
        : "degraded",
      checkedAt: checkedAt.toISOString(),
      services,
      pipeline: {
        queued: snapshot.queued,
        processing: snapshot.processing,
        failed: snapshot.failed,
        disposalPending: snapshot.disposalPending,
      },
    };

    return jsonResponse(response, 200, requestId, {
      "Cache-Control": "no-store",
    });
  } catch (error) {
    requestLog("error", "operations.status.error", requestId, {
      error: error instanceof Error ? error.name : "unknown",
    });
    return jsonResponse(
      { error: "Operational status could not be loaded." },
      503,
      requestId,
      { "Cache-Control": "no-store" },
    );
  }
}
