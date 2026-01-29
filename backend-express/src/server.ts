import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import passport from './config/passport';
import authRoutes from './routes/auth';
import customerRoutes from './routes/customer';
import deliveryRoutes from './routes/delivery';
import adminRoutes from './routes/admin';

const app = express();
const PORT = process.env.PORT || 4000;

// ============================================================================
// MIDDLEWARE
// ============================================================================

// CORS - Allow frontend to make requests
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true, // Important: allows cookies/sessions
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS in production
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    },
  })
);

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// ============================================================================
// ROUTES
// ============================================================================

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Maa Ilay Express Backend is running',
    environment: process.env.NODE_ENV || 'development',
  });
});

// Auth routes
app.use('/api/auth', authRoutes);

// Customer routes
app.use('/api/customer', customerRoutes);

// Delivery person routes
app.use('/api/delivery', deliveryRoutes);

// Admin routes
app.use('/api/admin', adminRoutes);

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║    🥛 Maa Ilay Express Backend                   ║
║                                                   ║
║    ✅ Server running on port ${PORT}              ║
║    ✅ Environment: ${process.env.NODE_ENV || 'development'}                    ║
║    ✅ Database connected                          ║
║    ✅ Google OAuth configured                     ║
║                                                   ║
║    🌐 http://localhost:${PORT}                    ║
║    📚 API: http://localhost:${PORT}/api           ║
║    ❤️  Health: http://localhost:${PORT}/health    ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
  `);
});

export default app;
