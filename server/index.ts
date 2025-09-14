import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// IMPORTANT: Webhook route must be BEFORE express.json() to get raw body
// Quick reachability test (Render) - GET probe to confirm path exists
app.get("/api/webhooks/stripe", (_req, res) => res.status(405).send("POST only"));

app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
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

  // Render-specific event idempotency check using event ID in payment metadata
  const { storage } = await import('./storage');
  const eventIdKey = `event_${event.id}`;
  
  // Check if this event was already processed by looking for it in any payment metadata
  try {
    const existingPayments = await storage.getAllStripePayments?.() || [];
    const alreadyProcessed = existingPayments.some(payment => 
      payment.metadata && typeof payment.metadata === 'object' && 
      (payment.metadata as any)[eventIdKey] === true
    );
    
    if (alreadyProcessed) {
      console.log(`[STRIPE WEBHOOK] Event ${event.id} already processed - skipping`);
      return res.status(200).json({ received: true });
    }
  } catch (error) {
    console.log(`[STRIPE WEBHOOK] Could not check event idempotency, proceeding: ${error.message}`);
  }

  // Handle checkout.session.completed and payment_intent.succeeded events
  if (event.type === 'checkout.session.completed' || event.type === 'payment_intent.succeeded') {
    console.log(`[STRIPE WEBHOOK] Processing ${event.type} for event ${event.id}`);
    
    try {
      let userId: number = 0;
      let tokens: number = 0;
      let sessionId: string = '';
      
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        sessionId = session.id;
        
        // Get user ID from metadata or client reference
        userId = parseInt(session.metadata?.user_id || session.client_reference_id || '0');
        
        // RENDER FIX: Fetch line items to get price metadata for credits
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
          apiVersion: '2024-06-20'
        });
        
        try {
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { expand: ['data.price'] });
          
          if (lineItems.data.length > 0) {
            const lineItem = lineItems.data[0];
            const price = lineItem.price;
            
            // Get credits from price metadata (for live prices)
            if (price && price.metadata && price.metadata.credits) {
              tokens = parseInt(price.metadata.credits);
              console.log(`[STRIPE WEBHOOK] Got ${tokens} tokens from price metadata for price ${price.id}`);
            } else {
              // Fallback to session metadata for backwards compatibility
              tokens = parseInt(session.metadata?.tokens || '0');
              console.log(`[STRIPE WEBHOOK] Using fallback tokens from session metadata: ${tokens}`);
            }
          }
        } catch (lineItemError) {
          console.error(`[STRIPE WEBHOOK] Error fetching line items: ${lineItemError.message}`);
          // Fallback to session metadata
          tokens = parseInt(session.metadata?.tokens || '0');
        }
        
      } else if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        
        // Get user ID from payment intent metadata
        userId = parseInt(paymentIntent.metadata?.user_id || '0');
        tokens = parseInt(paymentIntent.metadata?.tokens || '0');
        sessionId = paymentIntent.metadata?.session_id || paymentIntent.id;
      }
      
      if (userId <= 0 || tokens <= 0) {
        console.error(`[STRIPE WEBHOOK] Invalid parameters: userId=${userId}, tokens=${tokens} for event ${event.id}`);
        return res.status(200).json({ received: true }); // Invalid data - don't retry
      }
      
      // Use atomic operation to check completion, credit tokens, and mark completed
      const result = await storage.completeStripePaymentAndCredit(sessionId, userId, tokens);
      
      if (result.alreadyCompleted) {
        console.log(`[STRIPE WEBHOOK] Payment ${sessionId} already completed - no action needed`);
        return res.status(200).json({ received: true });
      }
      
      // Mark this event as processed in the payment metadata
      try {
        const payment = await storage.getStripePaymentBySessionId(sessionId);
        if (payment) {
          const updatedMetadata = {
            ...(payment.metadata as any || {}),
            [eventIdKey]: true,
            lastProcessedEvent: event.id,
            lastProcessedAt: new Date().toISOString()
          };
          await storage.updateStripePaymentMetadata?.(sessionId, updatedMetadata);
        }
      } catch (metadataError) {
        console.log(`[STRIPE WEBHOOK] Could not update event metadata: ${metadataError.message}`);
      }
      
      console.log(`[STRIPE WEBHOOK] SUCCESS: Credited ${tokens} tokens to user ${userId}, new balance: ${result.newBalance} for event ${event.id}`);
      return res.status(200).json({ received: true });
      
    } catch (error) {
      console.error(`[STRIPE WEBHOOK] Error processing ${event.type} for event ${event.id}:`, error);
      
      // Differentiate between transient and permanent errors for Render
      if (error.message?.includes('connection') || 
          error.message?.includes('timeout') ||
          error.message?.includes('ECONNREFUSED') ||
          error.code === 'ENETUNREACH' ||
          error.message?.includes('database') ||
          error.message?.includes('pool')) {
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
