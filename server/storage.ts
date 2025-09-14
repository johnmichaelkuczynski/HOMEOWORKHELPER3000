import { assignments, users, tokenUsage, dailyUsage, documents, rewriteJobs, stripePayments, stripeEvents, type Assignment, type InsertAssignment, type User, type InsertUser, type TokenUsage, type InsertTokenUsage, type DailyUsage, type InsertDailyUsage, type Document, type InsertDocument, type RewriteJob, type InsertRewriteJob, type StripePayment, type InsertStripePayment, type StripeEvent, type InsertStripeEvent } from "@shared/schema";
import { db } from "./db";
import { eq, isNull, and, sum } from "drizzle-orm";

export interface IStorage {
  // Assignment methods with user isolation
  createAssignment(assignment: InsertAssignment): Promise<Assignment>;
  getAssignment(id: number, userId?: number): Promise<Assignment | undefined>;
  getAllAssignments(userId?: number): Promise<Assignment[]>;
  deleteAssignment(id: number, userId?: number): Promise<void>;
  cleanupEmptyAssignments(): Promise<void>;
  
  // User management methods
  createUser(user: InsertUser): Promise<User>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  updateUserTokenBalance(userId: number, balance: number): Promise<void>;
  
  // Token usage methods
  createTokenUsage(usage: InsertTokenUsage): Promise<TokenUsage>;
  getDailyUsage(sessionId: string, date: string): Promise<DailyUsage | undefined>;
  createOrUpdateDailyUsage(sessionId: string, date: string, tokens: number): Promise<void>;
  getUserTokenBalance(userId: number): Promise<number>;
  
  // GPT BYPASS / Humanization methods
  createDocument(document: InsertDocument): Promise<Document>;
  getDocument(id: string): Promise<Document | undefined>;
  createRewriteJob(job: InsertRewriteJob): Promise<RewriteJob>;
  getRewriteJob(id: string): Promise<RewriteJob | undefined>;
  updateRewriteJob(id: string, updates: Partial<RewriteJob>): Promise<void>;
  getRewriteJobs(limit?: number): Promise<RewriteJob[]>;
  
  // Stripe payment methods
  createStripePayment(payment: InsertStripePayment): Promise<StripePayment>;
  getStripePaymentBySessionId(sessionId: string): Promise<StripePayment | undefined>;
  getAllStripePayments?(): Promise<StripePayment[]>;
  updateStripePaymentStatus(sessionId: string, status: string): Promise<void>;
  updateStripePaymentMetadata?(sessionId: string, metadata: any): Promise<void>;
  completeStripePaymentAndCredit(sessionId: string, userId: number, tokens: number): Promise<{ alreadyCompleted: boolean; newBalance?: number }>;
  
  // Stripe event idempotency methods
  createStripeEvent(event: InsertStripeEvent): Promise<StripeEvent>;
  isEventProcessed(eventId: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async createAssignment(insertAssignment: InsertAssignment): Promise<Assignment> {
    const [assignment] = await db
      .insert(assignments)
      .values(insertAssignment)
      .returning();
    return assignment;
  }

  async getAssignment(id: number, userId?: number): Promise<Assignment | undefined> {
    const conditions = [eq(assignments.id, id)];
    
    // SECURITY: Always enforce user isolation for authenticated users
    if (userId) {
      conditions.push(eq(assignments.userId, userId));
    }
    
    const [assignment] = await db.select().from(assignments).where(and(...conditions));
    return assignment || undefined;
  }

  async getAllAssignments(userId?: number): Promise<Assignment[]> {
    const conditions = [];
    
    // SECURITY: Always enforce user isolation for authenticated users
    if (userId) {
      conditions.push(eq(assignments.userId, userId));
    } else {
      // For anonymous users, only show assignments without a userId
      conditions.push(isNull(assignments.userId));
    }
    
    return await db.select().from(assignments).where(and(...conditions)).orderBy(assignments.createdAt);
  }

  async deleteAssignment(id: number, userId?: number): Promise<void> {
    const conditions = [eq(assignments.id, id)];
    
    // SECURITY: Always enforce user isolation for authenticated users
    if (userId) {
      conditions.push(eq(assignments.userId, userId));
    }
    
    await db.delete(assignments).where(and(...conditions));
  }

  async cleanupEmptyAssignments(): Promise<void> {
    // Empty assignments already cleaned via SQL
    return;
  }

  // User management methods
  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async updateUserTokenBalance(userId: number, balance: number): Promise<void> {
    await db
      .update(users)
      .set({ tokenBalance: balance })
      .where(eq(users.id, userId));
  }

  // Token usage methods
  async createTokenUsage(insertUsage: InsertTokenUsage): Promise<TokenUsage> {
    const [usage] = await db
      .insert(tokenUsage)
      .values(insertUsage)
      .returning();
    return usage;
  }

  async getDailyUsage(sessionId: string, date: string): Promise<DailyUsage | undefined> {
    const [usage] = await db
      .select()
      .from(dailyUsage)
      .where(and(eq(dailyUsage.sessionId, sessionId), eq(dailyUsage.date, date)));
    return usage || undefined;
  }

  async createOrUpdateDailyUsage(sessionId: string, date: string, tokens: number): Promise<void> {
    const existing = await this.getDailyUsage(sessionId, date);
    
    if (existing) {
      await db
        .update(dailyUsage)
        .set({ totalTokens: (existing.totalTokens || 0) + tokens })
        .where(eq(dailyUsage.id, existing.id));
    } else {
      await db
        .insert(dailyUsage)
        .values({ sessionId, date, totalTokens: tokens });
    }
  }

  async getUserTokenBalance(userId: number): Promise<number> {
    const user = await this.getUserById(userId);
    return user?.tokenBalance || 0;
  }

  // GPT BYPASS / Humanization methods
  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const [document] = await db
      .insert(documents)
      .values(insertDocument)
      .returning();
    return document;
  }

  async getDocument(id: number): Promise<Document | undefined> {
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id));
    return document || undefined;
  }

  async createRewriteJob(insertJob: InsertRewriteJob): Promise<RewriteJob> {
    const [job] = await db
      .insert(rewriteJobs)
      .values(insertJob)
      .returning();
    return job;
  }

  async getRewriteJob(id: string): Promise<RewriteJob | undefined> {
    const [job] = await db
      .select()
      .from(rewriteJobs)
      .where(eq(rewriteJobs.id, id));
    return job || undefined;
  }

  async updateRewriteJob(id: string, updates: Partial<RewriteJob>): Promise<void> {
    await db
      .update(rewriteJobs)
      .set(updates)
      .where(eq(rewriteJobs.id, id));
  }

  async getRewriteJobs(limit: number = 20): Promise<RewriteJob[]> {
    return await db
      .select()
      .from(rewriteJobs)
      .orderBy(rewriteJobs.createdAt)
      .limit(limit);
  }
  
  // Stripe payment methods
  async createStripePayment(insertPayment: InsertStripePayment): Promise<StripePayment> {
    const [payment] = await db
      .insert(stripePayments)
      .values(insertPayment)
      .returning();
    return payment;
  }

  async getStripePaymentBySessionId(sessionId: string): Promise<StripePayment | undefined> {
    const [payment] = await db
      .select()
      .from(stripePayments)
      .where(eq(stripePayments.stripeSessionId, sessionId));
    return payment || undefined;
  }

  async updateStripePaymentStatus(sessionId: string, status: string): Promise<void> {
    await db
      .update(stripePayments)
      .set({ 
        status,
        updatedAt: new Date(),
        completedAt: status === 'completed' ? new Date() : undefined
      })
      .where(eq(stripePayments.stripeSessionId, sessionId));
  }
  
  async completeStripePaymentAndCredit(sessionId: string, userId: number, tokens: number): Promise<{ alreadyCompleted: boolean; newBalance?: number }> {
    // Use a transaction with proper concurrency control
    return await db.transaction(async (tx) => {
      let paymentId: number | null = null;
      let updatedRows = 0;
      
      // First, try to atomically claim the payment by updating status from non-completed to completed
      const existingPayments = await tx
        .select()
        .from(stripePayments)
        .where(eq(stripePayments.stripeSessionId, sessionId));
      
      if (existingPayments.length > 0) {
        const existingPayment = existingPayments[0];
        
        if (existingPayment.status === 'completed') {
          // Already completed - safe to return early
          return { alreadyCompleted: true };
        }
        
        // Conditionally update to completed ONLY if current status is not completed
        const result = await tx
          .update(stripePayments)
          .set({ 
            status: 'completed',
            updatedAt: new Date(),
            completedAt: new Date()
          })
          .where(and(
            eq(stripePayments.stripeSessionId, sessionId),
            eq(stripePayments.status, existingPayment.status) // Only update if status hasn't changed
          ))
          .returning({ id: stripePayments.id });
        
        updatedRows = result.length;
        if (updatedRows > 0) {
          paymentId = result[0].id;
        }
      } else {
        // No existing payment - try to insert as completed with conflict handling
        try {
          const result = await tx
            .insert(stripePayments)
            .values({
              userId,
              stripeSessionId: sessionId,
              amount: 30, // Default amount
              tokens,
              status: 'completed',
              completedAt: new Date(),
              metadata: { webhookCreated: true }
            })
            .returning({ id: stripePayments.id });
          
          paymentId = result[0].id;
          updatedRows = 1;
        } catch (error) {
          // If unique constraint violation, another webhook won the race
          if (error.message?.includes('unique') || error.code === '23505') {
            return { alreadyCompleted: true };
          }
          throw error;
        }
      }
      
      // Only credit tokens if we successfully claimed the payment (updated or inserted)
      if (updatedRows === 0) {
        return { alreadyCompleted: true };
      }
      
      // Get current user balance and credit tokens
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, userId));
      
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }
      
      const newBalance = (user.tokenBalance || 0) + tokens;
      
      await tx
        .update(users)
        .set({ tokenBalance: newBalance })
        .where(eq(users.id, userId));
      
      return { alreadyCompleted: false, newBalance };
    });
  }
  
  async createStripeEvent(insertEvent: InsertStripeEvent): Promise<StripeEvent> {
    const [event] = await db
      .insert(stripeEvents)
      .values(insertEvent)
      .returning();
    return event;
  }
  
  async getAllStripePayments(): Promise<StripePayment[]> {
    return await db
      .select()
      .from(stripePayments)
      .orderBy(stripePayments.createdAt);
  }
  
  async updateStripePaymentMetadata(sessionId: string, metadata: any): Promise<void> {
    await db
      .update(stripePayments)
      .set({ 
        metadata,
        updatedAt: new Date()
      })
      .where(eq(stripePayments.stripeSessionId, sessionId));
  }
  
  async isEventProcessed(eventId: string): Promise<boolean> {
    const [event] = await db
      .select()
      .from(stripeEvents)
      .where(eq(stripeEvents.eventId, eventId));
    return !!event;
  }
}

export class MemStorage implements IStorage {
  private assignments: Map<number, Assignment>;
  private currentId: number;
  private storageFile: string;

  constructor() {
    this.storageFile = './assignments.json';
    this.assignments = new Map();
    this.currentId = 1;
    this.loadFromFile();
  }

  private loadFromFile() {
    try {
      const fs = require('fs');
      if (fs.existsSync(this.storageFile)) {
        const data = JSON.parse(fs.readFileSync(this.storageFile, 'utf8'));
        this.currentId = data.currentId || 1;
        if (data.assignments) {
          for (const [id, assignment] of Object.entries(data.assignments)) {
            this.assignments.set(Number(id), {
              ...assignment as Assignment,
              createdAt: new Date((assignment as any).createdAt)
            });
          }
        }
      }
    } catch (error) {
      console.log('No existing assignments file found, starting fresh');
    }
  }

  private saveToFile() {
    try {
      import('fs').then(fs => {
        const data = {
          currentId: this.currentId,
          assignments: Object.fromEntries(this.assignments)
        };
        fs.writeFileSync(this.storageFile, JSON.stringify(data, null, 2));
      });
    } catch (error) {
      console.error('Failed to save assignments:', error);
    }
  }

  async createAssignment(insertAssignment: InsertAssignment): Promise<Assignment> {
    const id = this.currentId++;
    const assignment: Assignment = {
      id,
      userId: insertAssignment.userId || null,
      sessionId: insertAssignment.sessionId || null,
      inputText: insertAssignment.inputText || null,
      inputType: insertAssignment.inputType,
      fileName: insertAssignment.fileName || null,
      extractedText: insertAssignment.extractedText || null,
      llmProvider: insertAssignment.llmProvider,
      llmResponse: insertAssignment.llmResponse || null,
      graphData: insertAssignment.graphData || null,
      graphImages: insertAssignment.graphImages || null,
      processingTime: insertAssignment.processingTime || null,
      inputTokens: insertAssignment.inputTokens || null,
      outputTokens: insertAssignment.outputTokens || null,
      createdAt: new Date(),
    };
    this.assignments.set(id, assignment);
    this.saveToFile(); // Save immediately after creating
    console.log(`Saved assignment ${id} to storage. Total assignments: ${this.assignments.size}`);
    return assignment;
  }

  async getAssignment(id: number): Promise<Assignment | undefined> {
    return this.assignments.get(id);
  }

  async getAllAssignments(): Promise<Assignment[]> {
    return Array.from(this.assignments.values()).sort((a, b) => 
      (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  }

  async deleteAssignment(id: number): Promise<void> {
    this.assignments.delete(id);
    this.saveToFile();
  }

  async cleanupEmptyAssignments(): Promise<void> {
    const toDelete: number[] = [];
    this.assignments.forEach((assignment, id) => {
      if (!assignment.fileName) {
        toDelete.push(id);
      }
    });
    toDelete.forEach(id => this.assignments.delete(id));
    this.saveToFile();
  }

  // Stub implementations for user/token methods (MemStorage doesn't support users)
  async createUser(): Promise<User> { throw new Error("MemStorage does not support users"); }
  async getUserByUsername(): Promise<User | undefined> { return undefined; }
  async getUserById(): Promise<User | undefined> { return undefined; }
  async updateUserTokenBalance(): Promise<void> { throw new Error("MemStorage does not support users"); }
  async createTokenUsage(): Promise<TokenUsage> { throw new Error("MemStorage does not support tokens"); }
  async getDailyUsage(): Promise<DailyUsage | undefined> { return undefined; }
  async createOrUpdateDailyUsage(): Promise<void> { throw new Error("MemStorage does not support daily usage"); }
  async getUserTokenBalance(): Promise<number> { return 0; }
  
  // Stub implementations for GPT BYPASS methods (MemStorage doesn't support these)
  async createDocument(): Promise<Document> { throw new Error("MemStorage does not support documents"); }
  async getDocument(): Promise<Document | undefined> { return undefined; }
  async createRewriteJob(): Promise<RewriteJob> { throw new Error("MemStorage does not support rewrite jobs"); }
  async getRewriteJob(): Promise<RewriteJob | undefined> { return undefined; }
  async updateRewriteJob(): Promise<void> { throw new Error("MemStorage does not support rewrite jobs"); }
  async getRewriteJobs(): Promise<RewriteJob[]> { return []; }
  
  // Stripe payment methods (not implemented for MemStorage)
  async createStripePayment(payment: InsertStripePayment): Promise<StripePayment> {
    throw new Error("Stripe payments not supported in MemStorage");
  }

  async getStripePaymentBySessionId(sessionId: string): Promise<StripePayment | undefined> {
    return undefined;
  }

  async updateStripePaymentStatus(sessionId: string, status: string): Promise<void> {
    // No-op for MemStorage
  }
  
  async completeStripePaymentAndCredit(sessionId: string, userId: number, tokens: number): Promise<{ alreadyCompleted: boolean; newBalance?: number }> {
    throw new Error("Stripe payments not supported in MemStorage");
  }
  
  async createStripeEvent(event: InsertStripeEvent): Promise<StripeEvent> {
    throw new Error("Stripe events not supported in MemStorage");
  }
  
  async getAllStripePayments(): Promise<StripePayment[]> {
    return [];
  }
  
  async updateStripePaymentMetadata(sessionId: string, metadata: any): Promise<void> {
    // No-op for MemStorage
  }
  
  async isEventProcessed(eventId: string): Promise<boolean> {
    return false;
  }
}

export const storage = new DatabaseStorage();
