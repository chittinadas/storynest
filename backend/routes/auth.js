const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../database/database');

// Validate registration inputs
const validateRegistration = (username, email, password) => {
  const errors = [];
  
  if (!username || username.trim().length < 3) {
    errors.push('Username must be at least 3 characters');
  }
  
  if (!email || !email.includes('@') || !email.includes('.')) {
    errors.push('Valid email is required');
  }
  
  if (!password || password.length < 6) {
    errors.push('Password must be at least 6 characters');
  }
  
  return errors;
};

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    const validationErrors = validateRegistration(username, email, password);
    if (validationErrors.length > 0) {
      return res.status(400).json({ error: validationErrors[0] });
    }

    // Check if user exists
    const existingUser = await db.findUserByUsername(username.trim());
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Create user
    const user = await db.createUser(username.trim(), email.trim(), password);
    
    // Set session
    req.session.userId = user.id;
    req.session.username = user.username;
    
    // Save session
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ error: 'Registration failed' });
      }
      
      res.status(201).json({
        message: 'Registration successful',
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      });
    });
    
  } catch (err) {
    console.error('Registration error:', err.message);
    
    // Handle specific errors
    if (err.message.includes('Email already exists')) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    if (err.message.includes('Username already exists')) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await db.findUserByUsername(username.trim());
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Set session
    req.session.userId = user.id;
    req.session.username = user.username;
    
    // Save session
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ error: 'Login failed' });
      }
      
      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          profile_picture: user.profile_picture
        }
      });
    });
    
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    
    res.clearCookie('connect.sid');
    res.json({ message: 'Logout successful' });
  });
});

// Check session endpoint
router.get('/session', (req, res) => {
  if (req.session.userId) {
    res.json({
      loggedIn: true,
      user: {
        id: req.session.userId,
        username: req.session.username
      }
    });
  } else {
    res.json({ loggedIn: false });
  }
});

module.exports = router;