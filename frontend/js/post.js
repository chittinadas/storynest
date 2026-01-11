class PostDetailManager {
  constructor() {
    this.apiBase = '/api/posts';
    this.commentsApi = '/api/comments';
    this.postId = this.getPostIdFromURL();
    this.currentUser = null;
    this.init();
  }

  getPostIdFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
  }

  async init() {
    if (!this.postId) {
      this.showError('No post specified');
      return;
    }
    
    await this.loadPost();
    await this.loadComments();
    this.setupEventListeners();
    
    // Check session to get current user
    await this.checkCurrentUser();
  }

  async checkCurrentUser() {
    try {
      const response = await fetch('/api/auth/session');
      const data = await response.json();
      if (data.loggedIn) {
        this.currentUser = data.user;
      }
    } catch (error) {
      console.error('Failed to check session:', error);
    }
  }

  async loadPost() {
    try {
      const response = await fetch(`${this.apiBase}/${this.postId}`);
      if (!response.ok) {
        throw new Error('Post not found');
      }
      
      const post = await response.json();
      this.displayPost(post);
    } catch (error) {
      console.error('Failed to load post:', error);
      this.showError('Failed to load post. It may have been deleted.');
    }
  }

  displayPost(post) {
    document.getElementById('postTitle').textContent = post.title;
    document.getElementById('postContent').textContent = post.content;
    document.getElementById('postAuthor').textContent = post.username;
    document.getElementById('postCategory').textContent = post.category;
    document.getElementById('postAvatar').src = post.profile_picture;
    document.getElementById('likeCount').textContent = post.likes_count;
    
    // Format date
    const postDate = new Date(post.created_at);
    const formattedDate = postDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    document.getElementById('postDate').textContent = formattedDate;
    
    // Display media if exists
    const mediaContainer = document.getElementById('postMediaContainer');
    if (post.media_url) {
      if (post.media_type?.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = post.media_url;
        img.alt = 'Post image';
        img.className = 'post-full-media';
        mediaContainer.appendChild(img);
      } else if (post.media_type?.startsWith('video/')) {
        const video = document.createElement('video');
        video.src = post.media_url;
        video.controls = true;
        video.className = 'post-full-media';
        mediaContainer.appendChild(video);
      }
    }
    
    // Check if user has liked this post
    this.checkLikeStatus();
  }

  async checkLikeStatus() {
    try {
      if (!this.currentUser) return;
      
      // In a real app, you'd have an API endpoint to check like status
      // For now, we'll just show the like button
      const likeBtn = document.getElementById('likeBtn');
      likeBtn.disabled = false;
    } catch (error) {
      console.error('Failed to check like status:', error);
    }
  }

  async loadComments() {
    try {
      const response = await fetch(`${this.commentsApi}/post/${this.postId}`);
      if (!response.ok) {
        throw new Error('Failed to load comments');
      }
      
      const comments = await response.json();
      this.displayComments(comments);
      document.getElementById('commentCount').textContent = comments.length;
    } catch (error) {
      console.error('Failed to load comments:', error);
      document.getElementById('commentsList').innerHTML = 
        '<div class="error">Failed to load comments.</div>';
    }
  }

  displayComments(comments) {
    const container = document.getElementById('commentsList');
    
    if (comments.length === 0) {
      container.innerHTML = '<div class="no-comments">No comments yet. Be the first to comment!</div>';
      return;
    }
    
    container.innerHTML = comments.map(comment => `
      <div class="comment" data-comment-id="${comment.id}">
        <div class="comment-header">
          <img src="${comment.profile_picture}" alt="${comment.username}" class="comment-avatar">
          <div>
            <strong>${this.escapeHtml(comment.username)}</strong>
            <div class="comment-meta">
              ${new Date(comment.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
              ${comment.user_id === this.currentUser?.id ? 
                `<button class="delete-comment-btn" onclick="postDetail.deleteComment(${comment.id})">Delete</button>` : 
                ''}
            </div>
          </div>
        </div>
        
        <div class="comment-content">${this.escapeHtml(comment.content)}</div>
        
        ${comment.image_url ? 
          `<img src="${comment.image_url}" alt="Comment image" class="comment-image">` : 
          ''}
      </div>
    `).join('');
  }

  async deleteComment(commentId) {
    if (!confirm('Are you sure you want to delete this comment?')) {
      return;
    }
    
    try {
      const response = await fetch(`${this.commentsApi}/${commentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete comment');
      }
      
      // Remove comment from DOM
      const commentElement = document.querySelector(`[data-comment-id="${commentId}"]`);
      if (commentElement) {
        commentElement.remove();
      }
      
      // Update comment count
      const commentCount = parseInt(document.getElementById('commentCount').textContent);
      document.getElementById('commentCount').textContent = commentCount - 1;
      
    } catch (error) {
      console.error('Failed to delete comment:', error);
      alert('Failed to delete comment. Please try again.');
    }
  }

  setupEventListeners() {
    // Like button
    const likeBtn = document.getElementById('likeBtn');
    likeBtn.addEventListener('click', () => this.toggleLike());
    
    // Comment form
    const commentForm = document.getElementById('commentForm');
    commentForm.addEventListener('submit', (e) => this.submitComment(e));
    
    // Comment image preview
    const commentImageInput = document.getElementById('commentImage');
    commentImageInput.addEventListener('change', (e) => this.previewCommentImage(e));
  }

  async toggleLike() {
    try {
      const response = await fetch(`${this.apiBase}/${this.postId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/login.html';
          return;
        }
        throw new Error('Failed to toggle like');
      }
      
      const result = await response.json();
      const likeCountElement = document.getElementById('likeCount');
      const likeBtn = document.getElementById('likeBtn');
      
      let currentLikes = parseInt(likeCountElement.textContent);
      
      if (result.liked) {
        likeCountElement.textContent = currentLikes + 1;
        likeBtn.classList.add('liked');
      } else {
        likeCountElement.textContent = currentLikes - 1;
        likeBtn.classList.remove('liked');
      }
      
    } catch (error) {
      console.error('Like error:', error);
      if (error.message.includes('401')) {
        window.location.href = '/login.html';
      } else {
        alert('Failed to like post. Please try again.');
      }
    }
  }

  async submitComment(e) {
    e.preventDefault();
    
    const commentText = document.getElementById('commentText').value;
    const commentImage = document.getElementById('commentImage').files[0];
    
    if (!commentText.trim()) {
      alert('Please enter a comment');
      return;
    }
    
    // Check if user is logged in
    if (!this.currentUser) {
      window.location.href = '/login.html';
      return;
    }
    
    const formData = new FormData();
    formData.append('post_id', this.postId);
    formData.append('content', commentText);
    
    if (commentImage) {
      formData.append('image', commentImage);
    }
    
    try {
      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Posting...';
      
      const response = await fetch(this.commentsApi, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/login.html';
          return;
        }
        throw new Error('Failed to post comment');
      }
      
      // Clear form
      document.getElementById('commentText').value = '';
      document.getElementById('commentImage').value = '';
      document.getElementById('commentImagePreview').innerHTML = '';
      
      // Reload comments
      await this.loadComments();
      
      submitBtn.disabled = false;
      submitBtn.textContent = 'Post Comment';
      
    } catch (error) {
      console.error('Comment error:', error);
      alert('Failed to post comment. Please try again.');
      
      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Post Comment';
    }
  }

  previewCommentImage(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const preview = document.getElementById('commentImagePreview');
    preview.innerHTML = '';
    
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.src = e.target.result;
        img.style.maxWidth = '150px';
        img.style.maxHeight = '150px';
        img.style.borderRadius = '4px';
        preview.appendChild(img);
      };
      reader.readAsDataURL(file);
    }
  }

  showError(message) {
    const main = document.querySelector('.main-container');
    main.innerHTML = `
      <div class="auth-container">
        <h2>Error</h2>
        <p>${message}</p>
        <a href="/" class="btn btn-primary">Back to Home</a>
      </div>
    `;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Global instance for delete button onclick
let postDetail;

// Initialize post detail manager when page loads
if (document.getElementById('postTitle')) {
  postDetail = new PostDetailManager();
}