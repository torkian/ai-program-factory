import { Router } from "express";
import { chat, prose } from "../gpt";
import { db, id } from "../store/memoryStore";
import {
  BRIEF_PROMPT,
  ARC_PROMPT,
  SOURCING_PROMPT,
  ARTICLE_PROMPT,
  VIDEO_PROMPT,
  QUIZ_PROMPT,
  EXERCISE_PROMPT,
  QC_PROMPT,
  FIX_PROMPT,
  PACK_PROMPT,
  renderPrompt
} from "../prompts";

const router = Router();

// Store active progress streams
const progressStreams = new Map<string, any>();

async function qcAndFix(type: string, content: any, program: any, session: any, sources: any[]) {
  try {
    const qc1 = await chat(QC_PROMPT, {
      artifact: { type, content },
      program,
      session,
      sources
    });

    if (!qc1.ok && qc1.patches && qc1.patches.length > 0) {
      console.log(`  Applying QC fixes to ${type}...`);
      const fixInput = {
        artifact: { type, content },
        patches: qc1.patches
      };

      const fixed = type === 'article' || type === 'video'
        ? await prose(FIX_PROMPT, fixInput)
        : await chat(FIX_PROMPT, fixInput);

      const qc2 = await chat(QC_PROMPT, {
        artifact: { type, content: fixed },
        program,
        session,
        sources
      });

      return { content: fixed, score: qc2.score };
    }

    return { content, score: qc1.score };
  } catch (error) {
    console.error(`  QC error for ${type}:`, error);
    return { content, score: 50 }; // Default score on error
  }
}

router.get("/", (req, res) => {
  res.json({ message: "Programs API ready", version: "1.0.0" });
});

// Progress stream endpoint
router.get("/progress/:jobId", (req, res) => {
  const jobId = req.params.jobId;

  // Set headers for Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Store the response stream
  progressStreams.set(jobId, res);

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Progress stream connected' })}\n\n`);

  // Clean up when client disconnects
  req.on('close', () => {
    progressStreams.delete(jobId);
  });
});

function sendProgress(jobId: string, data: any) {
  const stream = progressStreams.get(jobId);
  if (stream) {
    stream.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

async function processProgram(jobId: string, requestBody: any) {
  try {
    sendProgress(jobId, {
      type: 'step',
      step: 1,
      name: 'Brief Normalizer',
      status: 'starting',
      message: '📋 Analyzing and normalizing your program brief...'
    });

    // Step 1: Brief Normalization Agent
    console.log("\n📋 Step 1: Brief Normalizer...");
    const normalized = await chat(BRIEF_PROMPT, requestBody);
    console.log(`✅ Normalized program for: ${normalized.program.client.name}`);

    sendProgress(jobId, {
      type: 'step',
      step: 1,
      name: 'Brief Normalizer',
      status: 'completed',
      message: `✅ Normalized program for: ${normalized.program.client.name}`,
      data: { clientName: normalized.program.client.name }
    });

    if (normalized.notes?.length) {
      console.log(`📝 Notes: ${normalized.notes.join(', ')}`);
    }
    if (normalized.warnings?.length) {
      console.log(`⚠️  Warnings: ${normalized.warnings.join(', ')}`);
    }

    const programId = id();
    db.programs.set(programId, { id: programId, ...normalized.program });

    // Step 2: ARC & Matrix Agent
    sendProgress(jobId, {
      type: 'step',
      step: 2,
      name: 'ARC & Matrix Agent',
      status: 'starting',
      message: '🏗️ Creating modular structure and session outline...'
    });

    console.log("\n🏗️  Step 2: ARC & Matrix Agent...");
    const matrixInput = {
      program: normalized.program,
      salesTemplate: requestBody.salesTemplate
    };
    const matrix = await chat(ARC_PROMPT, matrixInput);
    console.log(`✅ Generated ${matrix.modules.length} modules with ${matrix.sessions.length} sessions`);
    matrix.modules.forEach((m: any) => {
      console.log(`  📚 ${m.label}: ${m.title}`);
    });

    sendProgress(jobId, {
      type: 'step',
      step: 2,
      name: 'ARC & Matrix Agent',
      status: 'completed',
      message: `✅ Generated ${matrix.modules.length} modules with ${matrix.sessions.length} sessions`,
      data: {
        moduleCount: matrix.modules.length,
        sessionCount: matrix.sessions.length,
        modules: matrix.modules.map((m: any) => ({ label: m.label, title: m.title }))
      }
    });

    // Step 3: Sourcing Agent
    console.log("\n📚 Step 3: Sourcing Agent...");
    const sourcingInput = {
      program: normalized.program,
      modules: matrix.modules,
      sessions: matrix.sessions,
      sourcingHints: matrix.sourcingHints
    };
    const sources = await chat(SOURCING_PROMPT, sourcingInput);
    console.log(`✅ Created sourcing plan with ${sources.sources.length} sources`);

    // Step 4-8: Content Generation Pipeline
    console.log("\n🎯 Step 4-8: Content Generation Pipeline...");
    const results: any[] = [];

    for (let i = 0; i < matrix.sessions.length; i++) {
      const s = matrix.sessions[i];
      console.log(`\n📝 Processing session ${i + 1}/${matrix.sessions.length}: ${s.title}`);

      try {
        // Step 4: Article Agent
        console.log("  📝 Generating article...");
        const articleInput = {
          program: normalized.program,
          session: s,
          sources: sources.sources
        };
        const article = await prose(renderPrompt(ARTICLE_PROMPT, articleInput), articleInput);

        // Step 5: Video Script Agent
        console.log("  🎥 Generating video script...");
        const videoInput = {
          program: normalized.program,
          session: s,
          videoMin: normalized.program.constraints.length.videoSeconds[0],
          videoMax: normalized.program.constraints.length.videoSeconds[1]
        };
        const script = await prose(renderPrompt(VIDEO_PROMPT, videoInput), videoInput);

        // Step 6: Quiz Agent
        console.log("  ❓ Generating quiz...");
        const quizInput = {
          program: normalized.program,
          session: s
        };
        const quiz = await chat(renderPrompt(QUIZ_PROMPT, quizInput), quizInput);

        // Step 7: Exercise Agent
        console.log("  💬 Generating exercise...");
        const exerciseInput = {
          program: normalized.program,
          session: s,
          primaryPersona: normalized.program.client.personas[0]?.role || "client",
          firstPain: normalized.program.client.personas[0]?.pains[0] || "business challenge",
          oneObjection: normalized.program.client.objections[0] || "budget concerns"
        };
        const exercise = await chat(renderPrompt(EXERCISE_PROMPT, exerciseInput), exerciseInput);

        // Step 8: QC Agent + Fix Agent
        console.log("  ✅ Running QC and fixes...");
        const { content: article2, score: as } = await qcAndFix("article", article, normalized.program, s, sources.sources);
        const { content: script2, score: ss } = await qcAndFix("video", script, normalized.program, s, sources.sources);
        const { content: quiz2, score: qs } = await qcAndFix("quiz", quiz, normalized.program, s, sources.sources);
        const { content: ex2, score: es } = await qcAndFix("exercise", exercise, normalized.program, s, sources.sources);

        const sessionId = id();
        const record = {
          id: sessionId,
          session: s,
          article: article2,
          script: script2,
          quiz: quiz2,
          exercise: ex2,
          qcScore: Math.round((as + ss + qs + es) / 4)
        };
        db.sessions.set(sessionId, record);
        results.push(record);

        console.log(`  ✅ Completed ${s.title} (QC Score: ${record.qcScore}/100)`);
      } catch (sessionError) {
        console.error(`  ❌ Error processing session ${s.title}:`, sessionError);
        // Create minimal record for failed sessions
        const sessionId = id();
        const record = {
          id: sessionId,
          session: s,
          article: `# ${s.title}\n\nError generating content: ${(sessionError as Error).message}`,
          script: `Error generating video script: ${(sessionError as Error).message}`,
          quiz: { questions: [] },
          exercise: { exercise: {} },
          qcScore: 0,
          error: (sessionError as Error).message
        };
        db.sessions.set(sessionId, record);
        results.push(record);
      }
    }

    // Step 9: Packager Agent
    console.log("\n📦 Step 9: Packager Agent...");
    const manifestInput = {
      id: programId,
      program: normalized.program,
      modules: matrix.modules,
      sessions: results.map(r => ({
        key: `${r.session.moduleLabel}-${r.session.label}`,
        title: r.session.title,
        qcScore: r.qcScore,
        articlePath: `articles/${r.session.moduleLabel}-${r.session.label}.md`,
        videoScriptPath: `scripts/${r.session.moduleLabel}-${r.session.label}.txt`,
        quizPath: `quizzes/${r.session.moduleLabel}-${r.session.label}.json`,
        exercisePath: `exercises/${r.session.moduleLabel}-${r.session.label}.json`
      }))
    };
    const manifest = await chat(renderPrompt(PACK_PROMPT, manifestInput), manifestInput);

    // Update program in storage
    db.programs.set(programId, {
      ...db.programs.get(programId),
      modules: manifest.modules
    });

    const avgQcScore = Math.round(results.reduce((acc, r) => acc + r.qcScore, 0) / results.length);
    console.log("\n🎉 === Program Generation Complete ===");
    console.log(`📋 Program ID: ${programId}`);
    console.log(`🎯 Average QC Score: ${avgQcScore}/100`);
    console.log(`📚 Generated ${results.length} complete training sessions`);

    // Send final progress update with completion data
    sendProgress(jobId, {
      type: 'complete',
      programId,
      manifest,
      sessions: results,
      summary: {
        totalSessions: results.length,
        averageQcScore: avgQcScore,
        completedSessions: results.filter(r => !r.error).length,
        failedSessions: results.filter(r => r.error).length
      }
    });
  } catch (error: any) {
    console.error("\n❌ === Program Generation Failed ===");
    console.error("Error:", error.message);
    sendProgress(jobId, {
      type: 'error',
      error: "Program generation failed",
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

router.post("/", async (req, res) => {
  const jobId = id(); // Generate unique job ID for progress tracking

  try {
    console.log("\n=== 🏭 AI Program Factory - Starting Generation ===");
    console.log("Request:", JSON.stringify(req.body, null, 2));

    // Send job ID immediately so client can connect to progress stream
    res.json({ jobId, status: 'started', message: 'Generation started - connect to progress stream' });

    // Continue processing in background
    processProgram(jobId, req.body);

  } catch (error: any) {
    console.error("\n❌ === Program Generation Failed ===");
    console.error("Error:", error.message);
    sendProgress(jobId, {
      type: 'error',
      error: error.message,
      step: 'initialization'
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const program = db.programs.get(req.params.id);
    if (!program) {
      return res.status(404).json({ error: "Program not found" });
    }

    const sessions = Array.from(db.sessions.values()).filter((s: any) =>
      s.session && program.modules?.some((m: any) =>
        s.session.moduleLabel === m.label
      )
    );

    res.json({ program, sessions });
  } catch (error: any) {
    console.error("Error fetching program:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/:id/rerun-qc", async (req, res) => {
  try {
    const program = db.programs.get(req.params.id);
    if (!program) {
      return res.status(404).json({ error: "Program not found" });
    }

    const sessions = Array.from(db.sessions.values()).filter((s: any) =>
      s.session && program.modules?.some((m: any) =>
        s.session.moduleLabel === m.label
      )
    );

    const sources = { sources: [] }; // In production, retrieve stored sources

    console.log(`🔄 Re-running QC for ${sessions.length} sessions...`);

    for (const session of sessions) {
      console.log(`  ✅ QC checking ${session.session.title}...`);
      const { content: article2, score: as } = await qcAndFix("article", session.article, program, session.session, sources.sources);
      const { content: script2, score: ss } = await qcAndFix("video", session.script, program, session.session, sources.sources);
      const { content: quiz2, score: qs } = await qcAndFix("quiz", session.quiz, program, session.session, sources.sources);
      const { content: ex2, score: es } = await qcAndFix("exercise", session.exercise, program, session.session, sources.sources);

      session.article = article2;
      session.script = script2;
      session.quiz = quiz2;
      session.exercise = ex2;
      session.qcScore = Math.round((as + ss + qs + es) / 4);

      db.sessions.set(session.id, session);
    }

    console.log("✅ QC rerun completed");
    res.json({ message: "QC rerun completed", sessions });
  } catch (error: any) {
    console.error("QC rerun error:", error);
    res.status(500).json({ error: error.message });
  }
});

export { router };