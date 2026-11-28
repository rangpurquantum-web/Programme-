import { AccessToken } from "livekit-server-sdk";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { passcode, cam } = await req.json();
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, CAMERA_PASSCODE } =
    process.env;

  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !CAMERA_PASSCODE) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }
  if (passcode !== CAMERA_PASSCODE) {
    return NextResponse.json({ error: "ভুল কোড" }, { status: 401 });
  }

  const n = [1, 2, 3].includes(Number(cam)) ? Number(cam) : 1;

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: "cam" + n,
    ttl: "2h",
  });
  at.addGrant({
    room: "programflow-live",
    roomJoin: true,
    canPublish: true,
    canSubscribe: false,
    canUpdateOwnMetadata: true,
  });

  return NextResponse.json({ token: await at.toJwt(), url: LIVEKIT_URL });
}
