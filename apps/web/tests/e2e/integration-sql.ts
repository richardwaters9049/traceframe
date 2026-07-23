import { execFile } from "node:child_process";

export async function executeIntegrationSql(sql: string) {
  await new Promise<void>((resolve, reject) => {
    execFile(
      "docker",
      [
        "compose", "exec", "-T", "db",
        "psql", "-U", "traceframe", "-d", "traceframe", "-v", "ON_ERROR_STOP=1", "-c", sql,
      ],
      { cwd: "../.." },
      (error, _stdout, stderr) => {
        if (error) reject(new Error(stderr || error.message));
        else resolve();
      },
    );
  });
}
