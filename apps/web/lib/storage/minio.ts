import "server-only";

import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";

let client: S3Client | null = null;
let bucketReady: Promise<void> | null = null;

function bucketName() {
  return process.env.MINIO_BUCKET ?? "case-source-material";
}

function endpointUrl() {
  const endpoint = process.env.MINIO_ENDPOINT ?? "http://minio:9000";
  return /^https?:\/\//i.test(endpoint) ? endpoint : `http://${endpoint}`;
}

function getClient() {
  if (client) return client;
  client = new S3Client({
    endpoint: endpointUrl(),
    region: process.env.MINIO_REGION ?? "us-east-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY ?? "traceframe",
      secretAccessKey: process.env.MINIO_SECRET_KEY ?? "local-development-only",
    },
  });
  return client;
}

async function ensureBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      try {
        await getClient().send(new HeadBucketCommand({ Bucket: bucketName() }));
      } catch (error) {
        if (!(error instanceof S3ServiceException) || error.$metadata.httpStatusCode !== 404) throw error;
        await getClient().send(new CreateBucketCommand({ Bucket: bucketName() }));
      }
    })().catch((error) => {
      bucketReady = null;
      throw error;
    });
  }
  await bucketReady;
}

export async function putSourceObject(objectKey: string, body: Uint8Array, mediaType: string) {
  await ensureBucket();
  await getClient().send(new PutObjectCommand({
    Bucket: bucketName(),
    Key: objectKey,
    Body: body,
    ContentLength: body.byteLength,
    ContentType: mediaType,
  }));
}

export async function deleteSourceObject(objectKey: string) {
  await getClient().send(new DeleteObjectCommand({ Bucket: bucketName(), Key: objectKey }));
}

export async function probeSourceStorage() {
  await getClient().send(
    new HeadBucketCommand({ Bucket: bucketName() }),
    { abortSignal: AbortSignal.timeout(3_000) },
  );
}
