const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/database');

// Configure multer for comment images
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
    cb(null, 'comment-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for comment images
  },
  fileFilter: function (req, file, cb) {
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

// Create comment
router.post('/', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const { post_id, content } = req.body;
    
    if (!post_id || !content) {
      return res.status(400).json({ error: 'Post ID and content are required' });
    }
    
    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/images/${req.file.filename}`;
    }
    
    const commentData = {
      post_id: parseInt(post_id),
      user_id: req.session.userId,
      content: content.trim(),
      image_url: imageUrl
    };
    
    const commentId = await db.createComment(commentData);
    
    res.status(201).json({
      message: 'Comment added successfully',
      commentId,
      imageUrl
    });
  } catch (err) {
    console.error('Create comment error:', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Get comments for a post
router.get('/post/:postId', async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    if (isNaN(postId)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }
    
    const comments = await db.getCommentsByPostId(postId);
    res.json(comments);
  } catch (err) {
    console.error('Get comments error:', err);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Delete comment
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const commentId = parseInt(req.params.id);
    if (isNaN(commentId)) {
      return res.status(400).json({ error: 'Invalid comment ID' });
    }
    
    // First check if comment exists and belongs to user
    db.db.get(
      'SELECT * FROM comments WHERE id = ? AND user_id = ?',
      [commentId, req.session.userId],
      (err, comment) => {
        if (err) {
          console.error('Delete comment error:', err);
          return res.status(500).json({ error: 'Failed to delete comment' });
        }
        
        if (!comment) {
          return res.status(404).json({ error: 'Comment not found or unauthorized' });
        }
        
        // Delete comment
        db.db.run('DELETE FROM comments WHERE id = ?', [commentId], (err) => {
          if (err) {
            console.error('Delete comment error:', err);
            return res.status(500).json({ error: 'Failed to delete comment' });
          }
          
          res.json({ message: 'Comment deleted successfully' });
        });
      }
    );
  } catch (err) {
    console.error('Delete comment error:', err);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

module.exports = router;