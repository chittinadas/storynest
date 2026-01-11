const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/database');

// Configure multer for file uploads (multiple files)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let folder = 'uploads/';
    if (file.mimetype.startsWith('image/')) {
      folder += 'images/';
    } else if (file.mimetype.startsWith('video/')) {
      folder += 'videos/';
    }
    
    // Create full path
    const fullPath = path.join(__dirname, '..', folder);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
    
    cb(null, folder);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = file.fieldname + '-' + uniqueSuffix + ext;
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit per file
    files: 10 // Maximum 10 files
  },
  fileFilter: function (req, file, cb) {
    // Allow only images and videos
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
      'video/mp4', 'video/webm', 'video/ogg'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed!'), false);
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

// Create post with multiple media
router.post('/', requireAuth, upload.array('media', 10), async (req, res) => {
  try {
    console.log('Creating post with files:', req.files?.length || 0);
    
    const { title, content, category, post_type } = req.body;
    
    // Validation
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    if (!category || category.trim().length === 0) {
      return res.status(400).json({ error: 'Category is required' });
    }

    let mediaUrls = [];
    let mediaTypes = [];
    
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        const mediaUrl = `/uploads/${file.mimetype.startsWith('image/') ? 'images/' : 'videos/'}${file.filename}`;
        mediaUrls.push(mediaUrl);
        mediaTypes.push(file.mimetype);
      });
    }

    // Store first media URL for backward compatibility
    const firstMediaUrl = mediaUrls.length > 0 ? mediaUrls[0] : null;
    const firstMediaType = mediaTypes.length > 0 ? mediaTypes[0] : null;
    
    // Store all media as JSON string
    const allMedia = mediaUrls.map((url, index) => ({
      url: url,
      type: mediaTypes[index],
      filename: path.basename(url)
    }));

    const postData = {
      title: title.trim(),
      content: content.trim(),
      post_type: post_type || (mediaUrls.length > 0 ? 'mixed' : 'text'),
      media_url: firstMediaUrl,
      media_type: firstMediaType,
      all_media: JSON.stringify(allMedia),
      category: category,
      author_id: req.session.userId
    };

    console.log('Post data:', { ...postData, all_media: allMedia });

    const postId = await db.createPost(postData);
    
    res.status(201).json({
      message: 'Post created successfully',
      postId,
      mediaUrls,
      mediaCount: mediaUrls.length,
      allMedia: allMedia
    });
  } catch (err) {
    console.error('Create post error:', err.message);
    
    // Clean up uploaded files if there was an error
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        const filePath = path.join(__dirname, '..', file.path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    }
    
    res.status(500).json({ error: 'Failed to create post: ' + err.message });
  }
});

// Get all posts
router.get('/', async (req, res) => {
  try {
    const { limit = 20, offset = 0, category } = req.query;
    const posts = await db.getPosts(parseInt(limit), parseInt(offset), category);
    
    // Parse all_media JSON for each post
    posts.forEach(post => {
      if (post.all_media) {
        try {
          post.all_media = JSON.parse(post.all_media);
        } catch (e) {
          console.error('Error parsing all_media:', e);
          post.all_media = [];
        }
      } else {
        post.all_media = [];
      }
    });
    
    res.json(posts);
  } catch (err) {
    console.error('Get posts error:', err);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Get single post
router.get('/:id', async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    if (isNaN(postId)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }
    
    const post = await db.getPostById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Parse all_media JSON if exists
    if (post.all_media) {
      try {
        post.all_media = JSON.parse(post.all_media);
      } catch (e) {
        console.error('Error parsing all_media:', e);
        post.all_media = [];
      }
    } else {
      post.all_media = [];
    }
    
    res.json(post);
  } catch (err) {
    console.error('Get post error:', err);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// Like/Unlike post
router.post('/:id/like', requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    if (isNaN(postId)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }
    
    const result = await db.toggleLike(postId, req.session.userId);
    res.json(result);
  } catch (err) {
    console.error('Like error:', err);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// Get post comments
router.get('/:id/comments', async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
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

// Search posts
router.get('/search/:query', async (req, res) => {
  try {
    const query = req.params.query;
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const posts = await db.searchPosts(query.trim());
    
    // Parse all_media JSON for each post
    posts.forEach(post => {
      if (post.all_media) {
        try {
          post.all_media = JSON.parse(post.all_media);
        } catch (e) {
          console.error('Error parsing all_media:', e);
          post.all_media = [];
        }
      } else {
        post.all_media = [];
      }
    });
    
    res.json(posts);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;