import { Router } from "express";
import { chat, prose } from "../gpt";
import { db } from "../store/memoryStore";
import {
  ARTICLE_PROMPT,
  VIDEO_PROMPT,
  QUIZ_PROMPT,
  EXERCISE_PROMPT,
  QC_PROMPT,
  FIX_PROMPT,
  renderPrompt
} from "../prompts";

export const router = Router();

async function qcAndFix(type: string, content: any, program: any, session: any, sources: any[]) {
  const qc1 = await chat(QC_PROMPT, {
    artifact: { type, content },
    program,
    session,
    sources
  });

  if (!qc1.ok && qc1.patches && qc1.patches.length > 0) {
    const fixInput = `Artifact type: ${type}
Original content:
${typeof content === 'object' ? JSON.stringify(content, null, 2) : content}

Patches to apply:
${JSON.stringify(qc1.patches, null, 2)}`;

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
}

router.post("/:id/generate", async (req, res) => {
  try {
    const sessionRecord = db.sessions.get(req.params.id);
    if (!sessionRecord) {
      return res.status(404).json({ error: "Session not found" });
    }

    const program = Array.from(db.programs.values()).find((p: any) =>
      p.modules.some((m: any) => m.label === sessionRecord.session.moduleLabel)
    );

    if (!program) {
      return res.status(404).json({ error: "Program not found for session" });
    }

    const sources = { sources: [] }; // In a real implementation, you'd retrieve stored sources

    const s = sessionRecord.session;

    const articleInput = {
      program,
      session: s,
      sources: sources.sources
    };
    const article = await prose(renderPrompt(ARTICLE_PROMPT, articleInput), articleInput);

    const videoInput = {
      program,
      session: s,
      videoMin: program.constraints.length.videoSeconds[0],
      videoMax: program.constraints.length.videoSeconds[1]
    };
    const script = await prose(renderPrompt(VIDEO_PROMPT, videoInput), videoInput);

    const quizInput = {
      program,
      session: s
    };
    const quiz = await chat(renderPrompt(QUIZ_PROMPT, quizInput), quizInput);

    const exerciseInput = {
      program,
      session: s
    };
    const exercise = await chat(renderPrompt(EXERCISE_PROMPT, exerciseInput), exerciseInput);

    const { content: article2, score: as } = await qcAndFix("article", article, program, s, sources.sources);
    const { content: script2, score: ss } = await qcAndFix("video", script, program, s, sources.sources);
    const { content: quiz2, score: qs } = await qcAndFix("quiz", quiz, program, s, sources.sources);
    const { content: ex2, score: es } = await qcAndFix("exercise", exercise, program, s, sources.sources);

    const updatedRecord = {
      ...sessionRecord,
      article: article2,
      script: script2,
      quiz: quiz2,
      exercise: ex2,
      qcScore: Math.round((as + ss + qs + es) / 4)
    };

    db.sessions.set(req.params.id, updatedRecord);

    res.json(updatedRecord);
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ error: e.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const session = db.sessions.get(req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json(session);
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ error: e.message });
  }
});