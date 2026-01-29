import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcryptjs';
import prisma from './prisma';

// ============================================================================
// GOOGLE OAUTH STRATEGY (for Customers)
// ============================================================================
passport.use(
  'google',
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error('No email found in Google profile'));
        }

        // Find or create customer
        let customer = await prisma.customer.findUnique({
          where: { email },
        });

        if (!customer) {
          // Create new customer with unique temporary values
          // Use email as temporary phone to ensure uniqueness until onboarding
          const tempPhone = email.replace(/[^0-9]/g, '').slice(0, 10).padEnd(10, '0');
          
          customer = await prisma.customer.create({
            data: {
              email,
              name: profile.displayName || email.split('@')[0],
              phone: tempPhone, // Temporary unique phone from email
              addressLine1: 'Onboarding Pending', // Will be updated during onboarding
              city: 'Pondicherry',
              pincode: '000000', // Will be updated during onboarding
              status: 'PENDING_APPROVAL',
            },
          });
        }

        // Return user object for session
        return done(null, {
          id: customer.id,
          email: customer.email,
          name: customer.name,
          role: 'customer' as const,
        });
      } catch (error) {
        return done(error as Error);
      }
    }
  )
);

// ============================================================================
// ADMIN LOGIN STRATEGY (email + password)
// ============================================================================
passport.use(
  'admin-local',
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
    },
    async (email, password, done) => {
      try {
        const admin = await prisma.admin.findUnique({
          where: { email },
        });

        if (!admin) {
          return done(null, false, { message: 'Invalid credentials' });
        }

        const isValid = await bcrypt.compare(password, admin.password);
        if (!isValid) {
          return done(null, false, { message: 'Invalid credentials' });
        }

        return done(null, {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: 'admin' as const,
        });
      } catch (error) {
        return done(error as Error);
      }
    }
  )
);

// ============================================================================
// DELIVERY LOGIN STRATEGY (phone + password)
// ============================================================================
passport.use(
  'delivery-local',
  new LocalStrategy(
    {
      usernameField: 'phone',
      passwordField: 'password',
    },
    async (phone, password, done) => {
      try {
        const delivery = await prisma.deliveryPerson.findUnique({
          where: { phone },
        });

        if (!delivery) {
          return done(null, false, { message: 'Invalid credentials' });
        }

        const isValid = await bcrypt.compare(password, delivery.password);
        if (!isValid) {
          return done(null, false, { message: 'Invalid credentials' });
        }

        return done(null, {
          id: delivery.id,
          phone: delivery.phone,
          name: delivery.name,
          role: 'delivery' as const,
        });
      } catch (error) {
        return done(error as Error);
      }
    }
  )
);

// ============================================================================
// SESSION SERIALIZATION
// ============================================================================
passport.serializeUser((user, done) => {
  done(null, { id: user.id, role: user.role });
});

passport.deserializeUser(async (sessionData: { id: string; role: string }, done) => {
  try {
    let user;
    
    if (sessionData.role === 'customer') {
      const customer = await prisma.customer.findUnique({
        where: { id: sessionData.id },
      });
      if (customer) {
        user = {
          id: customer.id,
          email: customer.email,
          name: customer.name,
          role: 'customer' as const,
        };
      }
    } else if (sessionData.role === 'admin') {
      const admin = await prisma.admin.findUnique({
        where: { id: sessionData.id },
      });
      if (admin) {
        user = {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: 'admin' as const,
        };
      }
    } else if (sessionData.role === 'delivery') {
      const delivery = await prisma.deliveryPerson.findUnique({
        where: { id: sessionData.id },
      });
      if (delivery) {
        user = {
          id: delivery.id,
          phone: delivery.phone,
          name: delivery.name,
          role: 'delivery' as const,
        };
      }
    }

    done(null, user || null);
  } catch (error) {
    done(error as Error);
  }
});

export default passport;
