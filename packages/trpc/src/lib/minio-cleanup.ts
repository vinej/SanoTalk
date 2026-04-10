import * as Minio from "minio";

let _client: Minio.Client | null = null;
function getClient(): Minio.Client {
  if (!_client) {
    _client = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT!,
      port: parseInt(process.env.MINIO_PORT ?? "9000"),
      useSSL: process.env.MINIO_USE_SSL === "true",
      accessKey: process.env.MINIO_ACCESS_KEY!,
      secretKey: process.env.MINIO_SECRET_KEY!,
    });
  }
  return _client;
}

/** Best-effort deletion of MinIO objects. Logs failures but never throws. */
export async function deleteMinioObjects(
  objects: { storageKey: string; storageBucket: string }[]
): Promise<void> {
  try {
    const client = getClient();
    for (const obj of objects) {
      try {
        await client.removeObject(obj.storageBucket, obj.storageKey);
      } catch (err) {
        process.stderr.write(
          JSON.stringify({
            level: 40,
            time: Date.now(),
            msg: `[minio-cleanup] failed to remove ${obj.storageBucket}/${obj.storageKey}: ${err instanceof Error ? err.message : String(err)}`,
          }) + "\n"
        );
      }
    }
  } catch (err) {
    process.stderr.write(
      JSON.stringify({
        level: 50,
        time: Date.now(),
        msg: `[minio-cleanup] client init failed: ${err instanceof Error ? err.message : String(err)}`,
      }) + "\n"
    );
  }
}
