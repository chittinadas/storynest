const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/database');

// Configure multer for profile pictures
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const folder = 'uploads/images/';
    const fullPath = path.join(__dirname, '..', folder);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
    cb(null, folder);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'profile-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for profile pictures
  },
  fileFilter: function (req, file, cb) {
    // Allow only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Get user profile
router.get('/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    const user = await db.findUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get user's post count
    db.db.get('SELECT COUNT(*) as post_count FROM posts WHERE author_id = ?', 
      [userId], (err, row) => {
        if (err) {
          console.error('Error getting post count:', err);
          user.post_count = 0;
        } else {
          user.post_count = row.post_count;
        }
        res.json(user);
      });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update user profile
router.put('/profile', requireAuth, upload.single('profile_picture'), async (req, res) => {
  try {
    const { bio } = req.body;
    const userId = req.session.userId;
    
    let updateFields = [];
    let updateValues = [];
    
    if (bio !== undefined) {
      updateFields.push('bio = ?');
      updateValues.push(bio.trim());
    }
    
    if (req.file) {
      const profilePictureUrl = `/uploads/images/${req.file.filename}`;
      updateFields.push('profile_picture = ?');
      updateValues.push(profilePictureUrl);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    updateValues.push(userId);
    
    const query = `UPDATE users SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    
    db.db.run(query, updateValues, function(err) {
      if (err) {
        console.error('Update profile error:', err);
        return res.status(500).json({ error: 'Failed to update profile' });
      }
      
      res.json({ 
        message: 'Profile updated successfully',
        profile_picture: req.file ? `/uploads/images/${req.file.filename}` : undefined,
        bio: bio
      });
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get current user
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await db.findUserById(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get post count
    const postCount = await db.getUserPostCount(req.session.userId);
    user.post_count = postCount;
    
    res.json(user);
  } catch (err) {
    console.error('Get current user error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;