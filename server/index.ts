import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// IMPORTANT: Webhook route must be BEFORE express.json() to get raw body
app.post("/api/webhook/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;
  
  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('[STRIPE WEBHOOK] STRIPE_WEBHOOK_SECRET environment variable is required');
      return res.status(500).json({ error: 'Webhook not configured' });
    }
    
    // Import Stripe properly for ESM
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20'
    });
    
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    console.log(`[STRIPE WEBHOOK] Verified event: ${event.type} for ${event.id}`);
  } catch (err) {
    console.error("[STRIPE WEBHOOK] Signature verification failed:", err.message);
    return res.status(400).send("Bad signature");
  }

  // Handle the event with resilient, idempotent crediting
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log(`[STRIPE WEBHOOK] Processing checkout.session.completed for session ${session.id}`);
    
    try {
      // Use consistent metadata keys - prefer user_id, fallback to client_reference_id
      const userId = parseInt(session.metadata?.user_id || session.client_reference_id || '0');
      const tokens = parseInt(session.metadata?.tokens || '0');
      
      if (userId <= 0 || tokens <= 0) {
        console.error(`[STRIPE WEBHOOK] Invalid parameters: userId=${userId}, tokens=${tokens} for session ${session.id}`);
        return res.status(200).json({ received: true }); // Invalid data - don't retry
      }
      
      // Import after app is defined to avoid circular dependency
      const { storage } = await import('./storage');
      
      // Use atomic operation to check completion, credit tokens, and mark completed
      const result = await storage.completeStripePaymentAndCredit(session.id, userId, tokens);
      
      if (result.alreadyCompleted) {
        console.log(`[STRIPE WEBHOOK] Payment ${session.id} already completed - no action needed`);
        return res.status(200).json({ received: true });
      }
      
      console.log(`[STRIPE WEBHOOK] SUCCESS: Credited ${tokens} tokens to user ${userId}, new balance: ${result.newBalance}`);
      return res.status(200).json({ received: true });
      
    } catch (error) {
      console.error(`[STRIPE WEBHOOK] Error processing payment for session ${session.id}:`, error);
      
      // Differentiate between transient and permanent errors
      if (error.message?.includes('connection') || 
          error.message?.includes('timeout') ||
          error.message?.includes('ECONNREFUSED') ||
          error.code === 'ENETUNREACH') {
        console.error(`[STRIPE WEBHOOK] Transient error - returning 500 for Stripe retry`);
        return res.status(500).json({ error: 'Temporary error, please retry' });
      } else {
        console.error(`[STRIPE WEBHOOK] Permanent error - returning 200 to prevent retry`);
        return res.status(200).json({ received: true });
      }
    }
  } else {
    console.log(`[STRIPE WEBHOOK] Ignoring event type: ${event.type}`);
  }
  
  return res.sendStatus(200);
});

// Now safe to add JSON parsing for other routes
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // serve on port 5000 in development, or PORT environment variable in production
  // this serves both the API and the client.
  const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;
  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();
