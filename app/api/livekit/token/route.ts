import { AccessToken } from "livekit-server-sdk";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { passcode, identity } = await req.json();
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, CAMERA_PASSCODE } =
    process.env;

  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !CAMERA_PASSCODE) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }
  if (passcode !== CAMERA_PASSCODE) {
    return NextResponse.json({ error: "ভুল কোড" }, { status: 401 });
  }

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: identity || `cam-${Date.now()}`,
    ttl: "2h",
  });
  at.addGrant({
    room: "programflow-live",
    roomJoin: true,
    canPublish: true,
    canUpdateOwnMetadata: true,
    canSubscribe: false,
  });

  return NextResponse.json({ token: await at.toJwt(), url: LIVEKIT_URL });
}