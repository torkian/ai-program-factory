import { z } from "zod";

export const ProgramSpec = z.object({
  offerType: z.enum(["HR", "Sales"]),
  language: z.string().default("en"),
  client: z.object({
    name: z.string(),
    industry: z.string(),
    products: z.array(z.string()).default([]),
    personas: z.array(z.object({
      role: z.string(),
      pains: z.array(z.string())
    })).default([]),
    objections: z.array(z.string()).default([]),
    terminology: z.array(z.string()).default([])
  }),
  constraints: z.object({
    styleGuide: z.string().default("engaging, clear, practical"),
    readingLevel: z.string().default("Grade 8–10"),
    length: z.object({
      articleWords: z.tuple([z.number().default(800), z.number().default(1200)]),
      videoSeconds: z.tuple([z.number().default(120), z.number().default(240)])
    })
  }),
  salesTemplate: z.array(z.object({
    label: z.string(),
    title: z.string(),
    goals: z.array(z.string())
  })).optional()
});

export type ProgramSpec = z.infer<typeof ProgramSpec>;