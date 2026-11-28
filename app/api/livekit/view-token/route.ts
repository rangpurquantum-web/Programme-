import { AccessToken } from "livekit-server-sdk";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: "view-" + Math.random().toString(36).slice(2),
    ttl: "6h",
  });
  at.addGrant({
    room: "programflow-live",
    roomJoin: true,
    canPublish: false,
    canSubscribe: true,
  });
  return NextResponse.json({ token: await at.toJwt(), url: LIVEKIT_URL });
}
