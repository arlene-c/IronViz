import { NextResponse } from "next/server";
import { MongoClient } from "mongodb";

// Your MongoDB connection string (update this with your actual URI later!)
const MONGODB_URI = process.env.MONGODB_URI;

export async function POST(req: Request) {
  try {
    const { idea } = await req.json();

    if (!idea) {
      return NextResponse.json({ error: "Idea is required" }, { status: 400 });
    }

    // --- 1. OPTIONAL: Log to MongoDB (Will silently fail if DB isn't connected yet) ---
    try {
      const client = new MongoClient(MONGODB_URI);
      await client.connect();
      const db = client.db("grantscope");
      await db.collection("researcher_submissions").insertOne({
        idea: idea,
        submittedAt: new Date(),
      });
      await client.close();
    } catch (mongoError) {
      console.warn("MongoDB not connected yet, skipping log...");
    }

    // --- 2. Forward to Teammate's Python API ---
    // 🚨 IMPORTANT: Change this URL to your teammate's IP address or Ngrok URL!
    const pythonApiUrl = "http://172.26.94.150:8000/api/analyze-idea"; 
    
    const response = await fetch(pythonApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea: idea }),
    });

    if (!response.ok) {
      throw new Error("Python backend failed");
    }

    const data = await response.json();

    // --- 3. Send the result back to your frontend ---
    return NextResponse.json({ 
      predictedAmount: data.amount, 
      topFunder: data.funder 
    });

  } catch (error) {
    console.error("Prediction error:", error);
    return NextResponse.json({ error: "Failed to process prediction" }, { status: 500 });
  }
}