import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String((body as { email?: string }).email ?? "")
    .trim()
    .toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Sign in not available to save email" },
      { status: 503 }
    );
  }

  const { data } = await supabase.auth.getUser();
  const authUser = data.user;
  if (!authUser) {
    return NextResponse.json(
      { ok: true, saved: "client_only", verified: false },
      { status: 200 }
    );
  }

  await prisma.user.update({
    where: { id: authUser.id },
    data: { email },
  });

  return NextResponse.json({
    ok: true,
    saved: "profile",
    verified: authUser.email === email,
    email,
  });
}
