import { Router } from 'express';
import passport, { invalidateUserCache } from '../config/passport';
import prisma from '../config/prisma';

const router = Router();

// ============================================================================
// CUSTOMER - GOOGLE OAUTH
// ============================================================================

// Initiate Google OAuth
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
}));

// Google OAuth callback — on failure send user to frontend login page
const failureRedirectUrl = (process.env.FRONTEND_URL || 'http://localhost:5173') + '/customer/login';

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: failureRedirectUrl }),
  async (req, res) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    
    // Check if customer needs onboarding (missing required fields)
    if (req.user && req.user.role === 'customer') {
      const customer = await prisma.customer.findUnique({
        where: { id: req.user.id },
      });
      
      // If phone or address needs update (onboarding not completed), redirect to onboarding
      if (!customer?.phone || !customer?.addressLine1 || 
          customer.phone.length !== 10 || 
          customer.addressLine1 === 'Onboarding Pending' ||
          customer.pincode === '000000') {
        return res.redirect(`${frontendUrl}/customer/onboarding`);
      }
    }
    
    // Otherwise, go to dashboard
    res.redirect(`${frontendUrl}/customer/dashboard`);
  }
);

// ============================================================================
// ADMIN - EMAIL/PASSWORD LOGIN
// ============================================================================

router.post('/admin/login',
  passport.authenticate('admin-local'),
  (req, res) => {
    // Regenerate session after login to prevent session fixation attacks
    const user = req.user;
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration failed:', err);
        return res.status(500).json({ error: 'Login failed' });
      }
      // Re-establish user on new session
      req.logIn(user!, (loginErr) => {
        if (loginErr) {
          console.error('Re-login after session regeneration failed:', loginErr);
          return res.status(500).json({ error: 'Login failed' });
        }
        res.json({ success: true, user: req.user });
      });
    });
  }
);

// ============================================================================
// DELIVERY - PHONE/PASSWORD LOGIN
// ============================================================================

router.post('/delivery/login',
  passport.authenticate('delivery-local'),
  (req, res) => {
    // Regenerate session after login to prevent session fixation attacks
    const user = req.user;
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration failed:', err);
        return res.status(500).json({ error: 'Login failed' });
      }
      req.logIn(user!, (loginErr) => {
        if (loginErr) {
          console.error('Re-login after session regeneration failed:', loginErr);
          return res.status(500).json({ error: 'Login failed' });
        }
        res.json({ success: true, user: req.user });
      });
    });
  }
);

// ============================================================================
// LOGOUT (All roles)
// ============================================================================

router.post('/logout', (req, res) => {
  // Invalidate user cache before destroying session
  if (req.user) {
    invalidateUserCache(req.user.id, req.user.role);
  }
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true });
  });
});

// ============================================================================
// GET CURRENT USER SESSION
// ============================================================================

router.get('/session', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      authenticated: true,
      user: req.user,
    });
  } else {
    res.json({
      authenticated: false,
      user: null,
    });
  }
});

export default router;
