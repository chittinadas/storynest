const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const fs = require('fs');

class Database {
  constructor() {
    // Create database directory if it doesn't exist
    const dbDir = path.join(__dirname);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    const dbPath = path.join(__dirname, 'storynest.db');
    console.log('Database path:', dbPath);
    
    this.db = new sqlite3.Database(
      dbPath,
      sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
      (err) => {
        if (err) {
          console.error('Error opening database:', err.message);
        } else {
          console.log('✅ Connected to SQLite database');
          this.initializeTables();
        }
      }
    );
    
    // Enable foreign keys
    this.db.run('PRAGMA foreign_keys = ON');
    this.db.run('PRAGMA journal_mode = WAL');
    
    // Handle database errors
    this.db.on('error', (err) => {
      console.error('Database error:', err);
    });
  }

  initializeTables() {
    console.log('Initializing database tables...');
    
    const queries = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        bio TEXT DEFAULT '',
        profile_picture TEXT DEFAULT 'https://i.postimg.cc/MHz2HFfj/icons8-user-default-64.png',
        join_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Posts table
      `CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        post_type VARCHAR(20) NOT NULL,
        media_url TEXT DEFAULT NULL,
        media_type VARCHAR(50) DEFAULT NULL,
        category VARCHAR(50) NOT NULL,
        author_id INTEGER NOT NULL,
        likes_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      
      // Post likes table
      `CREATE TABLE IF NOT EXISTS post_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, user_id),
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      
      // Comments table
      `CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        image_url TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`
    ];

    // Run queries sequentially with error handling
    const runQuery = (index) => {
      if (index >= queries.length) {
        console.log('✅ All database tables initialized');
        this.createIndexes();
        return;
      }
      
      this.db.run(queries[index], (err) => {
        if (err) {
          console.error(`❌ Error creating table ${index + 1}:`, err.message);
        } else {
          console.log(`✅ Table ${index + 1} created/verified`);
        }
        runQuery(index + 1);
      });
    };
    
    runQuery(0);
  }

  createIndexes() {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id)',
      'CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category)',
      'CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id)',
      'CREATE INDEX IF NOT EXISTS idx_likes_post ON post_likes(post_id)',
      'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)'
    ];

    indexes.forEach((query, index) => {
      this.db.run(query, (err) => {
        if (err) {
          console.error(`❌ Error creating index ${index + 1}:`, err.message);
        }
      });
    });
    
    console.log('✅ Database indexes created');
  }

  // ========== USER METHODS ==========

  async createUser(username, email, password) {
    const passwordHash = await bcrypt.hash(password, 10);
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
        [username, email, passwordHash],
        function(err) {
          if (err) {
            // Handle unique constraint errors
            if (err.message && err.message.includes('UNIQUE constraint failed')) {
              if (err.message.includes('username')) {
                return reject(new Error('Username already exists'));
              } else if (err.message.includes('email')) {
                return reject(new Error('Email already exists'));
              }
            }
            return reject(err);
          } else {
            resolve({ 
              id: this.lastID, 
              username: username,
              email: email,
              profile_picture: 'https://i.postimg.cc/MHz2HFfj/icons8-user-default-64.png'
            });
          }
        }
      );
    });
  }

  async findUserByUsername(username) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM users WHERE username = ?',
        [username],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  async findUserByEmail(email) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM users WHERE email = ?',
        [email],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  async findUserById(id) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT id, username, email, bio, profile_picture, join_date FROM users WHERE id = ?',
        [id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  async updateUserProfile(userId, updates) {
    return new Promise((resolve, reject) => {
      const fields = [];
      const values = [];
      
      if (updates.bio !== undefined) {
        fields.push('bio = ?');
        values.push(updates.bio);
      }
      
      if (updates.profile_picture !== undefined) {
        fields.push('profile_picture = ?');
        values.push(updates.profile_picture);
      }
      
      if (fields.length === 0) {
        resolve(false);
        return;
      }
      
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(userId);
      
      const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
      
      this.db.run(query, values, function(err) {
        if (err) reject(err);
        else resolve(this.changes > 0);
      });
    });
  }

  // ========== POST METHODS ==========

  async createPost(postData) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO posts (title, content, post_type, media_url, media_type, category, author_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          postData.title,
          postData.content,
          postData.post_type || 'text',
          postData.media_url || null,
          postData.media_type || null,
          postData.category,
          postData.author_id
        ],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  async getPosts(limit = 20, offset = 0, category = null) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT p.*, u.username, u.profile_picture,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count
        FROM posts p
        JOIN users u ON p.author_id = u.id
      `;
      
      const params = [];
      if (category && category !== 'all') {
        query += ' WHERE p.category = ?';
        params.push(category);
      }
      
      query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);
      
      this.db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async getPostById(id) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT p.*, u.username, u.profile_picture,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count
         FROM posts p 
         JOIN users u ON p.author_id = u.id 
         WHERE p.id = ?`,
        [id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  async getUserPosts(userId, limit = 20, offset = 0) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT p.*, u.username, u.profile_picture,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count
        FROM posts p
        JOIN users u ON p.author_id = u.id
        WHERE p.author_id = ?
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
      `;
      
      this.db.all(query, [userId, limit, offset], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async getUserPostCount(userId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT COUNT(*) as count FROM posts WHERE author_id = ?',
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count || 0);
        }
      );
    });
  }

  async searchPosts(query, limit = 50) {
    return new Promise((resolve, reject) => {
      const searchQuery = `%${query}%`;
      const sql = `
        SELECT p.*, u.username, u.profile_picture,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count
        FROM posts p 
        JOIN users u ON p.author_id = u.id 
        WHERE p.title LIKE ? OR p.content LIKE ? 
        ORDER BY p.created_at DESC 
        LIMIT ?
      `;
      
      this.db.all(sql, [searchQuery, searchQuery, limit], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // ========== LIKE METHODS ==========

  async toggleLike(postId, userId) {
    return new Promise((resolve, reject) => {
      const self = this; // Store reference to 'this'
      
      // Start transaction
      self.db.run('BEGIN TRANSACTION', (beginErr) => {
        if (beginErr) {
          reject(beginErr);
          return;
        }
        
        // Check if like exists
        self.db.get(
          'SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?',
          [postId, userId],
          (err, existing) => {
            if (err) {
              self.db.run('ROLLBACK', () => reject(err));
              return;
            }
            
            if (existing) {
              // Unlike - delete the like
              self.db.run(
                'DELETE FROM post_likes WHERE id = ?',
                [existing.id],
                (deleteErr) => {
                  if (deleteErr) {
                    self.db.run('ROLLBACK', () => reject(deleteErr));
                    return;
                  }
                  
                  // Update likes count
                  self.db.run(
                    'UPDATE posts SET likes_count = likes_count - 1 WHERE id = ?',
                    [postId],
                    (updateErr) => {
                      if (updateErr) {
                        self.db.run('ROLLBACK', () => reject(updateErr));
                      } else {
                        self.db.run('COMMIT', (commitErr) => {
                          if (commitErr) {
                            reject(commitErr);
                          } else {
                            resolve({ liked: false });
                          }
                        });
                      }
                    }
                  );
                }
              );
            } else {
              // Like - add new like
              self.db.run(
                'INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)',
                [postId, userId],
                function(insertErr) {
                  if (insertErr) {
                    self.db.run('ROLLBACK', () => reject(insertErr));
                    return;
                  }
                  
                  // Update likes count
                  self.db.run(
                    'UPDATE posts SET likes_count = likes_count + 1 WHERE id = ?',
                    [postId],
                    (updateErr) => {
                      if (updateErr) {
                        self.db.run('ROLLBACK', () => reject(updateErr));
                      } else {
                        self.db.run('COMMIT', (commitErr) => {
                          if (commitErr) {
                            reject(commitErr);
                          } else {
                            resolve({ liked: true });
                          }
                        });
                      }
                    }
                  );
                }
              );
            }
          }
        );
      });
    });
  }

  async hasUserLikedPost(postId, userId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?',
        [postId, userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(!!row);
        }
      );
    });
  }

  // ========== COMMENT METHODS ==========

  async createComment(commentData) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO comments (post_id, user_id, content, image_url) VALUES (?, ?, ?, ?)',
        [commentData.post_id, commentData.user_id, commentData.content, commentData.image_url || null],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  async getCommentsByPostId(postId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT c.*, u.username, u.profile_picture 
         FROM comments c 
         JOIN users u ON c.user_id = u.id 
         WHERE c.post_id = ? 
         ORDER BY c.created_at ASC`,
        [postId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  async deleteComment(commentId, userId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM comments WHERE id = ? AND user_id = ?',
        [commentId, userId],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes > 0);
        }
      );
    });
  }

  async getCommentCount(postId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT COUNT(*) as count FROM comments WHERE post_id = ?',
        [postId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count || 0);
        }
      );
    });
  }

  // ========== STATISTICS METHODS ==========

  async getTotalPosts() {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT COUNT(*) as count FROM posts',
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count || 0);
        }
      );
    });
  }

  async getTotalUsers() {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT COUNT(*) as count FROM users',
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count || 0);
        }
      );
    });
  }

  async getPopularCategories(limit = 5) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT category, COUNT(*) as count FROM posts GROUP BY category ORDER BY count DESC LIMIT ?',
        [limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  // ========== CLEANUP METHODS ==========

  async cleanupOrphanedData() {
    return new Promise((resolve, reject) => {
      const queries = [
        'DELETE FROM post_likes WHERE post_id NOT IN (SELECT id FROM posts)',
        'DELETE FROM comments WHERE post_id NOT IN (SELECT id FROM posts)',
        'DELETE FROM comments WHERE user_id NOT IN (SELECT id FROM users)',
        'DELETE FROM post_likes WHERE user_id NOT IN (SELECT id FROM users)'
      ];

      const runQuery = (index) => {
        if (index >= queries.length) {
          resolve(true);
          return;
        }

        this.db.run(queries[index], (err) => {
          if (err) {
            console.error(`Cleanup query ${index + 1} failed:`, err.message);
          }
          runQuery(index + 1);
        });
      };

      runQuery(0);
    });
  }

  // ========== DATABASE MAINTENANCE ==========

  async backupDatabase(backupPath) {
    return new Promise((resolve, reject) => {
      // Use sqlite3's backup API by passing the destination file path.
      // This avoids opening a second Database instance manually.
      this.db.backup(backupPath, (err) => {
        if (err) return reject(err);
        resolve(true);
      });
    });
  }

  async vacuumDatabase() {
    return new Promise((resolve, reject) => {
      this.db.run('VACUUM', (err) => {
        if (err) reject(err);
        else resolve(true);
      });
    });
  }

  // Test database connection
  async testConnection() {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT 1 as test', (err, row) => {
        if (err) reject(err);
        else resolve(!!row);
      });
    });
  }

  // Close database connection
  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else {
          console.log('✅ Database connection closed');
          resolve(true);
        }
      });
    });
  }
}

// Create and export database instance
const database = new Database();

// Handle process termination
process.on('SIGINT', async () => {
  console.log('Shutting down database...');
  await database.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Terminating database...');
  await database.close();
  process.exit(0);
});

module.exports = database;