import {
  requireStoredFileAccess,
  storedFileAccessContext,
} from "@/lib/file-access";
import { fileAccessAction, recordFileAccess } from "@/lib/file-access-audit";
import {
  InvalidStorageRangeError,
  normalizeStorageKey,
  readStoredFile,
} from "@/lib/storage";
import { getCurrentSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const action = fileAccessAction(request.url);
  const rangeHeader = request.headers.get("range");
  const userAgent = request.headers.get("user-agent");
  let key: string;
  let context: Awaited<ReturnType<typeof storedFileAccessContext>>;

  try {
    const { key: segments } = await params;
    key = normalizeStorageKey(segments.join("/"));
    context = await storedFileAccessContext(key);
  } catch {
    return Response.json({ error: "File not found or unavailable." }, { status: 404 });
  }

  const session = await getCurrentSession();
  if (!session?.user) {
    await recordFileAccess({
      ...context,
      storageKey: key,
      action,
      outcome: "DENIED",
      rangeHeader,
      userAgent,
      denialReason: "Authentication required",
    });
    return Response.json({ error: "File not found or unavailable." }, { status: 404 });
  }

  try {
    await requireStoredFileAccess(session.user.id, key, context);
  } catch {
    await recordFileAccess({
      ...context,
      userId: session.user.id,
      userName: session.user.name,
      storageKey: key,
      action,
      outcome: "DENIED",
      rangeHeader,
      userAgent,
      denialReason: "Project membership required",
    });
    return Response.json({ error: "File not found or unavailable." }, { status: 404 });
  }

  try {
    const file = await readStoredFile(key, request.headers.get("range"));
    const filename = context.fileName;
    const headers = new Headers({
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
      "Content-Disposition": `${action === "DOWNLOAD" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Content-Length": String(file.contentLength),
      "Content-Type": file.contentType,
      "X-Content-Type-Options": "nosniff",
    });
    if (file.contentRange) headers.set("Content-Range", file.contentRange);
    await recordFileAccess({
      ...context,
      userId: session.user.id,
      userName: session.user.name,
      storageKey: key,
      action,
      outcome: "ALLOWED",
      rangeHeader,
      userAgent,
    });
    const body = new ArrayBuffer(file.bytes.byteLength);
    new Uint8Array(body).set(file.bytes);
    return new Response(body, {
      status: file.contentRange ? 206 : 200,
      headers,
    });
  } catch (error) {
    if (error instanceof InvalidStorageRangeError) {
      return new Response(null, {
        status: 416,
        headers: error.totalLength
          ? { "Content-Range": `bytes */${error.totalLength}` }
          : undefined,
      });
    }
    return Response.json({ error: "File not found or unavailable." }, { status: 404 });
  }
}
