import { Router } from "express";
import { chat, prose } from "../gpt";
import { db, id } from "../store/memoryStore";

const router = Router();

router.get("/", (req, res) => {
  res.json({ message: "Programs API ready", version: "1.0.0" });
});

// Simple test endpoint
router.post("/test", async (req, res) => {
  try {
    console.log("Testing OpenAI connection...");
    const result = await chat("You are a helpful assistant. Return JSON with a test message.", { test: "hello" });
    console.log("OpenAI test successful:", result);
    res.json({ success: true, result });
  } catch (error: any) {
    console.error("OpenAI test failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data || error.stack
    });
  }
});

router.post("/", async (req, res) => {
  try {
    console.log("=== Starting Program Generation ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    // Step 1: Test basic OpenAI connection first
    console.log("Testing OpenAI connection...");
    await chat("You are a test assistant. Return JSON with status: ok", {});
    console.log("OpenAI connection OK");

    // Step 2: Generate a simple mock program for now
    const programId = id();
    const mockProgram = {
      id: programId,
      client: req.body.client || { name: "Test Corp", industry: "Tech" },
      offerType: req.body.offerType || "Sales",
      status: "generated"
    };

    const mockSessions = [
      {
        id: id(),
        session: {
          moduleLabel: "A",
          label: "a1",
          title: "Introduction to Sales Process",
          brief: "Basic overview of the sales methodology"
        },
        article: "# Introduction to Sales Process\n\nThis is a sample article about sales processes...",
        script: "Welcome to our sales training. Today we'll cover the fundamentals...",
        quiz: { questions: [{ id: "Q1", type: "mcq", stem: "What is the first step in sales?", choices: ["Listen", "Pitch", "Close", "Follow up"], answer: "Listen", rationale: "Listening helps understand customer needs" }] },
        exercise: { exercise: { roleplay: "discovery call", objective: "practice listening skills" } },
        qcScore: 85
      }
    ];

    // Store in database
    db.programs.set(programId, mockProgram);
    mockSessions.forEach(session => {
      db.sessions.set(session.id, session);
    });

    const manifest = {
      programId,
      client: mockProgram.client.name,
      offerType: mockProgram.offerType,
      modules: [{ label: "A", title: "Sales Fundamentals" }],
      sessions: [{
        key: "A-a1",
        title: "Introduction to Sales Process",
        qcScore: 85
      }]
    };

    console.log("=== Program Generation Complete (Mock) ===");
    res.json({ id: programId, manifest, sessions: mockSessions });

  } catch (error: any) {
    console.error("=== Program Generation Failed ===");
    console.error("Error:", error);
    res.status(500).json({
      error: "Program generation failed",
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export { router };