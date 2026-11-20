/** Liveness check for Railway. Touches nothing else, so it stays fast and cheap. */
export function GET() {
  return Response.json({ ok: true, service: "spiral-os" });
}
