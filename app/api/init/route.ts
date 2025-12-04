import { NextResponse } from "next/server";
import { initializeDatabase } from "@/app/lib/db";

export async function POST() {
  try {
    await initializeDatabase();
    return NextResponse.json({ success: true, message: "Database initialized" });
  } catch (error) {
    console.error("Database init error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to initialize database" },
      { status: 500 }
    );
  }
}
