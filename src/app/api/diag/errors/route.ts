import { NextResponse } from "next/server";
import { recentServerErrors } from "@/instrumentation";

/** TEMPORARY. Reads the in-memory server-error buffer. Remove before finalising. */
export async function GET() {
  return NextResponse.json({ errors: recentServerErrors() });
}
