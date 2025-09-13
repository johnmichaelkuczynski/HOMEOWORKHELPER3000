import { pgTable, text, serial, integer, boolean, timestamp, varchar, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// Users table for authentication and token tracking (with proper user isolation)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 255 }).unique().notNull(),
  password: text("password").notNull(),
  tokenBalance: integer("token_balance").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Token usage tracking
export const tokenUsage = pgTable("token_usage", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  sessionId: text("session_id"), // for anonymous users
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  remainingBalance: integer("remaining_balance"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Daily usage tracking for free users
export const dailyUsage = pgTable("daily_usage", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD format
  totalTokens: integer("total_tokens").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Assignments table with proper user isolation (CASCADE DELETE for security)
export const assignments = pgTable("assignments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  sessionId: text("session_id"), // for anonymous users
  inputText: text("input_text"),
  inputType: text("input_type").notNull(), // 'text', 'image', 'pdf', 'doc'
  fileName: text("file_name"),
  extractedText: text("extracted_text"),
  llmProvider: text("llm_provider").notNull(), // 'anthropic', 'openai', 'perplexity'
  llmResponse: text("llm_response"),
  graphData: text("graph_data").array(), // JSON strings containing graph configuration and data
  graphImages: text("graph_images").array(), // base64 encoded graph images
  processingTime: integer("processing_time"), // in milliseconds
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAssignmentSchema = createInsertSchema(assignments).omit({
  id: true,
  createdAt: true,
});

export type InsertAssignment = z.infer<typeof insertAssignmentSchema>;
export type Assignment = typeof assignments.$inferSelect;

// API request/response types
export const processAssignmentSchema = z.object({
  inputText: z.string().optional(),
  inputType: z.enum(['text', 'image', 'pdf', 'doc']),
  fileName: z.string().optional(),
  llmProvider: z.enum(['anthropic', 'openai', 'azure', 'perplexity', 'deepseek']),
  fileData: z.string().optional(), // base64 encoded file data
  sessionId: z.string().optional(), // for anonymous users
});

export type ProcessAssignmentRequest = z.infer<typeof processAssignmentSchema>;

export const processAssignmentResponseSchema = z.object({
  id: z.number(),
  extractedText: z.string().optional(),
  llmResponse: z.string(),
  graphData: z.array(z.string()).optional(),
  graphImages: z.array(z.string()).optional(),
  processingTime: z.number(),
  success: z.boolean(),
  isPreview: z.boolean().optional(), // Flag for freemium preview mode
});

export type ProcessAssignmentResponse = z.infer<typeof processAssignmentResponseSchema>;

export const emailSolutionSchema = z.object({
  email: z.string().email(),
  extractedText: z.string().optional(),
  llmResponse: z.string().optional(),
  provider: z.string().optional(),
  title: z.string().optional(),
  content: z.string().optional(),
});

export type EmailSolutionRequest = z.infer<typeof emailSolutionSchema>;

export const assignmentListSchema = z.object({
  id: z.number(),
  extractedText: z.string().nullable(),
  llmProvider: z.string(),
  processingTime: z.number(),
  createdAt: z.string(),
  fileName: z.string().nullable(),
});

export type AssignmentListItem = z.infer<typeof assignmentListSchema>;

// User authentication schemas
export const registerSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
});

export const loginSchema = z.object({
  username: z.string(),
  password: z.string().optional(),
});

export const userResponseSchema = z.object({
  id: z.number(),
  username: z.string(),
  tokenBalance: z.number(),
});

export type RegisterRequest = z.infer<typeof registerSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;

// GPT BYPASS / Humanization schemas
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filename: text("filename").notNull(),
  content: text("content").notNull(),
  wordCount: integer("word_count").notNull(),
  aiScore: integer("ai_score"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const rewriteJobs = pgTable("rewrite_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  inputText: text("input_text").notNull(),
  styleText: text("style_text"),
  contentMixText: text("content_mix_text"),
  customInstructions: text("custom_instructions"),
  selectedPresets: jsonb("selected_presets").$type<string[]>(),
  provider: text("provider").notNull(),
  chunks: jsonb("chunks").$type<TextChunk[]>(),
  selectedChunkIds: jsonb("selected_chunk_ids").$type<string[]>(),
  mixingMode: text("mixing_mode").$type<'style' | 'content' | 'both'>(),
  outputText: text("output_text"),
  inputAiScore: integer("input_ai_score"),
  outputAiScore: integer("output_ai_score"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
});

export const insertRewriteJobSchema = createInsertSchema(rewriteJobs).omit({
  id: true,
  createdAt: true,
});

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertRewriteJob = z.infer<typeof insertRewriteJobSchema>;
export type RewriteJob = typeof rewriteJobs.$inferSelect;

// GPT BYPASS API request/response types
export const rewriteRequestSchema = z.object({
  inputText: z.string(),
  styleText: z.string().optional(),
  contentMixText: z.string().optional(),
  customInstructions: z.string().optional(),
  selectedPresets: z.array(z.string()).optional(),
  provider: z.enum(['openai', 'anthropic', 'deepseek', 'perplexity']),
  selectedChunkIds: z.array(z.string()).optional(),
  mixingMode: z.enum(['style_only', 'content_mix', 'hybrid']).optional(),
});

export const rewriteResponseSchema = z.object({
  rewrittenText: z.string(),
  inputAiScore: z.number(),
  outputAiScore: z.number(),
  jobId: z.string(),
});

export type RewriteRequest = z.infer<typeof rewriteRequestSchema>;
export type RewriteResponse = z.infer<typeof rewriteResponseSchema>;

// Payment schemas
export const purchaseCreditsSchema = z.object({
  amount: z.enum(['1', '10', '100', '1000']),
});

export type PurchaseCreditsRequest = z.infer<typeof purchaseCreditsSchema>;

// Token usage tracking
export const tokenCheckSchema = z.object({
  inputText: z.string(),
  sessionId: z.string().optional(),
});

export const tokenUsageResponseSchema = z.object({
  canProcess: z.boolean(),
  inputTokens: z.number(),
  estimatedOutputTokens: z.number(),
  remainingBalance: z.number().optional(),
  dailyUsage: z.number().optional(),
  dailyLimit: z.number().optional(),
  message: z.string().optional(),
});

export type TokenCheckRequest = z.infer<typeof tokenCheckSchema>;
export type TokenUsageResponse = z.infer<typeof tokenUsageResponseSchema>;

// Insert schemas for new tables
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertTokenUsageSchema = createInsertSchema(tokenUsage).omit({
  id: true,
  createdAt: true,
});

export const insertDailyUsageSchema = createInsertSchema(dailyUsage).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertTokenUsage = z.infer<typeof insertTokenUsageSchema>;
export type InsertDailyUsage = z.infer<typeof insertDailyUsageSchema>;
export type User = typeof users.$inferSelect;
export type TokenUsage = typeof tokenUsage.$inferSelect;
export type DailyUsage = typeof dailyUsage.$inferSelect;

// GPT BYPASS interfaces
export interface TextChunk {
  id: string;
  content: string;
  startWord: number;
  endWord: number;
  aiScore?: number;
}

export interface InstructionPreset {
  id: string;
  name: string;
  description: string;
  category: string;
  instruction: string;
}

export interface WritingSample {
  id: string;
  name: string;
  preview: string;
  content: string;
  category: string;
}

export interface AIProviderConfig {
  provider: 'openai' | 'anthropic' | 'deepseek' | 'perplexity';
  model?: string;
}

export interface RewriteRequest {
  inputText: string;
  styleText?: string;
  contentMixText?: string;
  customInstructions?: string;
  selectedPresets?: string[];
  provider: string;
  selectedChunkIds?: string[];
  mixingMode?: 'style' | 'content' | 'both';
}

export interface RewriteResponse {
  rewrittenText: string;
  inputAiScore: number;
  outputAiScore: number;
  jobId: string;
}
