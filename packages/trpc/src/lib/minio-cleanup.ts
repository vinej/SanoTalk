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

/** Best-effort deletion of every object under a prefix (e.g. "avatars/userId-"). */
export async function deleteMinioPrefix(bucket: string, prefix: string): Promise<void> {
  try {
    const client = getClient();
    const keys: string[] = [];
    await new Promise<void>((resolve, reject) => {
      const stream = client.listObjectsV2(bucket, prefix, true);
      stream.on("data", (obj) => { if (obj.name) keys.push(obj.name); });
      stream.on("end", () => resolve());
      stream.on("error", (err) => reject(err));
    });
    for (const key of keys) {
      try {
        await client.removeObject(bucket, key);
      } catch (err) {
        process.stderr.write(
          JSON.stringify({
            level: 40,
            time: Date.now(),
            msg: `[minio-cleanup] failed to remove ${bucket}/${key}: ${err instanceof Error ? err.message : String(err)}`,
          }) + "\n"
        );
      }
    }
  } catch (err) {
    process.stderr.write(
      JSON.stringify({
        level: 50,
        time: Date.now(),
        msg: `[minio-cleanup] prefix delete failed for ${bucket}/${prefix}: ${err instanceof Error ? err.message : String(err)}`,
      }) + "\n"
    );
  }
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
