class PostManager {
  constructor() {
    this.apiBase = '/api/posts';
    this.currentCategory = 'all';
    this.currentPage = 0;
    this.postsPerPage = 10;
    this.isLoading = false;
    this.hasMorePosts = true;
    this.zoomModal = null;
    
    if (document.getElementById('feed')) {
      this.init();
    }
  }

  async init() {
    await this.loadPosts();
    this.setupEventListeners();
    this.setupInfiniteScroll();
    this.setupCommentPanels();
    this.createZoomModal();
  }

  async loadPosts(loadMore = false) {
    if (this.isLoading) return;
    
    this.isLoading = true;
    
    if (!loadMore) {
      this.currentPage = 0;
      const feed = document.getElementById('feed');
      if (feed) {
        feed.innerHTML = '<div class="spinner"></div>';
      }
    }
    
    try {
      const params = new URLSearchParams({
        limit: this.postsPerPage,
        offset: this.currentPage * this.postsPerPage
      });
      
      if (this.currentCategory !== 'all') {
        params.append('category', this.currentCategory);
      }
      
      const response = await fetch(`${this.apiBase}?${params}`);
      const posts = await response.json();
      
      if (!Array.isArray(posts)) {
        throw new Error('Invalid response format');
      }
      
      this.hasMorePosts = posts.length === this.postsPerPage;
      
      if (loadMore) {
        this.renderPosts(posts, true);
      } else {
        this.renderPosts(posts);
      }
      
      this.currentPage++;
    } catch (error) {
      console.error('Failed to load posts:', error);
      const feed = document.getElementById('feed');
      if (feed) {
        feed.innerHTML = '<div class="error">Failed to load posts. Please try again.</div>';
      }
    } finally {
      this.isLoading = false;
    }
  }

  renderPosts(posts, append = false) {
    const feed = document.getElementById('feed');
    if (!feed) return;
    
    if (!append) {
      feed.innerHTML = '';
    }
    
    if (posts.length === 0 && !append) {
      feed.innerHTML = '<div class="no-posts">No posts found. Be the first to post!</div>';
      return;
    }
    
    posts.forEach(post => {
      const postElement = this.createPostElement(post);
      feed.appendChild(postElement);
    });
  }

  createPostElement(post) {
    const div = document.createElement('div');
    div.className = 'post-card';
    div.dataset.postId = post.id;
    
    // Format date
    const postDate = new Date(post.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Media HTML - support multiple media
    let mediaHtml = '';
    let mediaData = [];
    
    // Check for multiple media
    if (post.all_media && post.all_media.length > 0) {
      mediaData = post.all_media;
    } else if (post.media_url) {
      // Single media for backward compatibility
      mediaData = [{
        url: post.media_url,
        type: post.media_type
      }];
    }
    
    if (mediaData.length > 0) {
      if (mediaData.length === 1) {
        // Single media
        const media = mediaData[0];
        if (media.type?.startsWith('image/')) {
          mediaHtml = `
            <div class="post-media-single">
              <img src="${media.url}" alt="Post image" class="post-media zoomable" 
                   data-post-id="${post.id}" data-index="0" loading="lazy">
              <div class="media-controls">
                <button class="zoom-btn" data-action="zoom-in" data-img="${media.url}" title="Zoom in">
                  <span>🔍</span>
                </button>
              </div>
            </div>
          `;
        } else if (media.type?.startsWith('video/')) {
          mediaHtml = `
            <div class="post-media-single">
              <video controls class="post-media" preload="metadata">
                <source src="${media.url}" type="${media.type}">
                Your browser does not support the video tag.
              </video>
            </div>
          `;
        }
      } else {
        // Multiple media - create gallery
        const firstMedia = mediaData[0];
        const isImage = firstMedia.type?.startsWith('image/');
        
        mediaHtml = `
          <div class="media-gallery" data-post-id="${post.id}">
            <div class="gallery-main">
              ${isImage ? 
                `<img src="${firstMedia.url}" alt="Gallery image 1" 
                     class="gallery-main-img zoomable" data-post-id="${post.id}" data-index="0" loading="lazy">` :
                `<video controls class="gallery-main-video">
                  <source src="${firstMedia.url}" type="${firstMedia.type}">
                  Your browser does not support the video tag.
                </video>`
              }
              <div class="media-controls">
                ${isImage ? 
                  `<button class="zoom-btn" data-action="zoom-in" data-img="${firstMedia.url}" title="Zoom in">
                    <span>🔍</span>
                  </button>` : ''
                }
                <button class="gallery-prev" data-post-id="${post.id}" title="Previous">⬅️</button>
                <span class="gallery-counter">1 / ${mediaData.length}</span>
                <button class="gallery-next" data-post-id="${post.id}" title="Next">➡️</button>
              </div>
            </div>
            <div class="gallery-thumbnails">
              ${mediaData.map((media, index) => `
                <div class="thumbnail ${index === 0 ? 'active' : ''}" 
                     data-index="${index}" data-post-id="${post.id}" title="Image ${index + 1}">
                  ${media.type?.startsWith('image/') ? 
                    `<img src="${media.url}" alt="Thumbnail ${index + 1}" loading="lazy">` : 
                    `<div class="video-thumbnail">🎥</div>`}
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
    }
    
    div.innerHTML = `
      <div class="post-header">
        <img src="${post.profile_picture}" alt="${post.username}" class="avatar" loading="lazy">
        <div>
          <strong>${post.username}</strong>
          <div class="post-meta">Posted in ${post.category} • ${postDate}</div>
        </div>
      </div>
      
      <h3 class="post-title">${this.escapeHtml(post.title)}</h3>
      
      <div class="post-content">${this.escapeHtml(post.content)}</div>
      
      ${mediaHtml}
      
      <div class="post-actions">
        <button class="like-btn" data-post-id="${post.id}" title="Like">
          <span class="like-icon">❤️</span>
          <span class="like-count">${post.likes_count}</span> Likes
        </button>
        <button class="comment-toggle-btn" data-post-id="${post.id}" title="Comments">
          <span class="comment-icon">💬</span>
          <span class="comment-count">${post.comment_count || 0}</span> Comments
        </button>
        <button class="share-btn" data-post-id="${post.id}" data-post-title="${this.escapeHtml(post.title)}" title="Share">
          <span class="share-icon">↗️</span> Share
        </button>
      </div>
      
      <!-- Comments Panel (hidden by default) -->
      <div class="comments-panel" id="comments-panel-${post.id}" style="display: none;">
        <div class="comments-loading">Loading comments...</div>
      </div>
    `;
    
    // Add event listeners
    const likeBtn = div.querySelector('.like-btn');
    likeBtn.addEventListener('click', () => this.toggleLike(post.id, likeBtn));
    
    const commentToggleBtn = div.querySelector('.comment-toggle-btn');
    commentToggleBtn.addEventListener('click', () => this.toggleCommentsPanel(post.id));
    
    const shareBtn = div.querySelector('.share-btn');
    shareBtn.addEventListener('click', () => this.sharePost(post.id, post.title));
    
    // Setup gallery functionality for multiple images
    if (mediaData.length > 1) {
      this.setupGallery(post.id, mediaData);
    }
    
    // Setup zoom functionality for single images
    const zoomBtn = div.querySelector('.zoom-btn');
    if (zoomBtn) {
      zoomBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const imgSrc = zoomBtn.dataset.img;
        this.openZoomModal(imgSrc);
      });
    }
    
    // Setup zoom on image click
    const zoomableImg = div.querySelector('.zoomable');
    if (zoomableImg) {
      zoomableImg.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openZoomModal(zoomableImg.src);
      });
    }
    
    return div;
  }

  setupGallery(postId, mediaData) {
    const gallery = document.querySelector(`.media-gallery[data-post-id="${postId}"]`);
    if (!gallery) return;
    
    const thumbnails = gallery.querySelectorAll('.thumbnail');
    const mainImg = gallery.querySelector('.gallery-main-img, .gallery-main-video');
    const prevBtn = gallery.querySelector('.gallery-prev');
    const nextBtn = gallery.querySelector('.gallery-next');
    const counter = gallery.querySelector('.gallery-counter');
    const zoomBtn = gallery.querySelector('.zoom-btn');
    
    let currentIndex = 0;
    
    const updateGallery = (index) => {
      if (index < 0 || index >= mediaData.length) return;
      
      currentIndex = index;
      const media = mediaData[index];
      const isImage = media.type?.startsWith('image/');
      
      // Update main media
      if (isImage) {
        if (mainImg.tagName === 'IMG') {
          mainImg.src = media.url;
          mainImg.dataset.index = index;
        } else {
          // Replace video with image
          const newImg = document.createElement('img');
          newImg.src = media.url;
          newImg.className = 'gallery-main-img zoomable';
          newImg.dataset.postId = postId;
          newImg.dataset.index = index;
          newImg.alt = `Gallery image ${index + 1}`;
          newImg.loading = 'lazy';
          mainImg.parentNode.replaceChild(newImg, mainImg);
          
          // Update zoom button
          if (zoomBtn) {
            zoomBtn.dataset.img = media.url;
            zoomBtn.style.display = 'flex';
          }
        }
      } else {
        // Replace image with video
        const newVideo = document.createElement('video');
        newVideo.controls = true;
        newVideo.className = 'gallery-main-video';
        newVideo.innerHTML = `<source src="${media.url}" type="${media.type}">`;
        mainImg.parentNode.replaceChild(newVideo, mainImg);
        
        // Hide zoom button for videos
        if (zoomBtn) {
          zoomBtn.style.display = 'none';
        }
      }
      
      // Update thumbnails
      thumbnails.forEach((thumb, i) => {
        thumb.classList.toggle('active', i === index);
      });
      
      // Update counter
      if (counter) {
        counter.textContent = `${index + 1} / ${mediaData.length}`;
      }
    };
    
    // Event listeners
    prevBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const newIndex = (currentIndex - 1 + mediaData.length) % mediaData.length;
      updateGallery(newIndex);
    });
    
    nextBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const newIndex = (currentIndex + 1) % mediaData.length;
      updateGallery(newIndex);
    });
    
    thumbnails.forEach(thumb => {
      thumb.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(thumb.dataset.index);
        updateGallery(index);
      });
    });
    
    // Keyboard navigation
    gallery.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const newIndex = (currentIndex - 1 + mediaData.length) % mediaData.length;
        updateGallery(newIndex);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const newIndex = (currentIndex + 1) % mediaData.length;
        updateGallery(newIndex);
      }
    });
    
    // Set tabindex for accessibility
    gallery.setAttribute('tabindex', '0');
  }

  createZoomModal() {
    if (this.zoomModal) return;
    
    this.zoomModal = document.createElement('div');
    this.zoomModal.id = 'zoom-modal';
    this.zoomModal.className = 'zoom-modal';
    this.zoomModal.style.display = 'none';
    
    this.zoomModal.innerHTML = `
      <div class="zoom-modal-content">
        <span class="zoom-close" title="Close (Esc)">&times;</span>
        <div class="zoom-controls">
          <button class="zoom-control zoom-in" title="Zoom in (+)">+</button>
          <button class="zoom-control zoom-out" title="Zoom out (-)">-</button>
          <button class="zoom-control reset-zoom" title="Reset zoom (0)">⟲</button>
          <button class="zoom-control fullscreen" title="Fullscreen (F)">⤢</button>
          <button class="zoom-control rotate-left" title="Rotate left (R)">↶</button>
          <button class="zoom-control rotate-right" title="Rotate right (L)">↷</button>
        </div>
        <div class="zoom-image-container">
          <img src="" alt="Zoomed image" class="zoomed-image">
        </div>
      </div>
    `;
    
    document.body.appendChild(this.zoomModal);
    
    // Initialize zoom state
    this.zoomState = {
      scale: 1,
      rotation: 0,
      panX: 0,
      panY: 0,
      isPanning: false,
      startX: 0,
      startY: 0
    };
    
    this.setupZoomControls();
  }

  setupZoomControls() {
    const zoomedImg = this.zoomModal.querySelector('.zoomed-image');
    const closeBtn = this.zoomModal.querySelector('.zoom-close');
    const zoomInBtn = this.zoomModal.querySelector('.zoom-in');
    const zoomOutBtn = this.zoomModal.querySelector('.zoom-out');
    const resetBtn = this.zoomModal.querySelector('.reset-zoom');
    const fullscreenBtn = this.zoomModal.querySelector('.fullscreen');
    const rotateLeftBtn = this.zoomModal.querySelector('.rotate-left');
    const rotateRightBtn = this.zoomModal.querySelector('.rotate-right');
    
    // Close modal
    closeBtn.addEventListener('click', () => this.closeZoomModal());
    
    this.zoomModal.addEventListener('click', (e) => {
      if (e.target === this.zoomModal) {
        this.closeZoomModal();
      }
    });
    
    // Zoom controls
    zoomInBtn.addEventListener('click', () => this.zoomImage(0.2));
    zoomOutBtn.addEventListener('click', () => this.zoomImage(-0.2));
    resetBtn.addEventListener('click', () => this.resetZoom());
    fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
    rotateLeftBtn.addEventListener('click', () => this.rotateImage(-90));
    rotateRightBtn.addEventListener('click', () => this.rotateImage(90));
    
    // Mouse wheel zoom
    this.zoomModal.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      this.zoomImage(delta);
    });
    
    // Panning with mouse drag
    zoomedImg.addEventListener('mousedown', (e) => {
      this.zoomState.isPanning = true;
      this.zoomState.startX = e.clientX - this.zoomState.panX;
      this.zoomState.startY = e.clientY - this.zoomState.panY;
      zoomedImg.style.cursor = 'grabbing';
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!this.zoomState.isPanning) return;
      
      this.zoomState.panX = e.clientX - this.zoomState.startX;
      this.zoomState.panY = e.clientY - this.zoomState.startY;
      this.updateImageTransform();
    });
    
    document.addEventListener('mouseup', () => {
      this.zoomState.isPanning = false;
      zoomedImg.style.cursor = 'grab';
    });
    
    // Touch events for mobile
    let touchStartDistance = 0;
    let touchStartScale = 1;
    
    zoomedImg.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        // Single touch for panning
        this.zoomState.isPanning = true;
        this.zoomState.startX = e.touches[0].clientX - this.zoomState.panX;
        this.zoomState.startY = e.touches[0].clientY - this.zoomState.panY;
      } else if (e.touches.length === 2) {
        // Two touches for pinch zoom
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        touchStartDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        touchStartScale = this.zoomState.scale;
        e.preventDefault();
      }
    });
    
    zoomedImg.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && this.zoomState.isPanning) {
        // Panning
        this.zoomState.panX = e.touches[0].clientX - this.zoomState.startX;
        this.zoomState.panY = e.touches[0].clientY - this.zoomState.startY;
        this.updateImageTransform();
      } else if (e.touches.length === 2) {
        // Pinch zoom
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        
        if (touchStartDistance > 0) {
          const scaleChange = (currentDistance / touchStartDistance) - 1;
          this.zoomState.scale = Math.max(0.1, touchStartScale + scaleChange);
          this.updateImageTransform();
        }
        e.preventDefault();
      }
    });
    
    zoomedImg.addEventListener('touchend', () => {
      this.zoomState.isPanning = false;
      touchStartDistance = 0;
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (this.zoomModal.style.display !== 'block') return;
      
      switch(e.key) {
        case 'Escape':
          this.closeZoomModal();
          break;
        case '+':
        case '=':
          this.zoomImage(0.2);
          break;
        case '-':
        case '_':
          this.zoomImage(-0.2);
          break;
        case '0':
          this.resetZoom();
          break;
        case 'f':
        case 'F':
          this.toggleFullscreen();
          break;
        case 'r':
        case 'R':
          this.rotateImage(-90);
          break;
        case 'l':
        case 'L':
          this.rotateImage(90);
          break;
        case 'ArrowLeft':
          this.rotateImage(-90);
          break;
        case 'ArrowRight':
          this.rotateImage(90);
          break;
      }
    });
  }

  zoomImage(delta) {
    this.zoomState.scale = Math.max(0.1, this.zoomState.scale + delta);
    this.updateImageTransform();
  }

  rotateImage(degrees) {
    this.zoomState.rotation += degrees;
    this.updateImageTransform();
  }

  resetZoom() {
    this.zoomState = {
      scale: 1,
      rotation: 0,
      panX: 0,
      panY: 0,
      isPanning: false,
      startX: 0,
      startY: 0
    };
    this.updateImageTransform();
  }

  updateImageTransform() {
    const zoomedImg = this.zoomModal.querySelector('.zoomed-image');
    if (!zoomedImg) return;
    
    const transform = `
      translate(${this.zoomState.panX}px, ${this.zoomState.panY}px)
      scale(${this.zoomState.scale})
      rotate(${this.zoomState.rotation}deg)
    `;
    
    zoomedImg.style.transform = transform;
    zoomedImg.style.cursor = this.zoomState.scale > 1 ? 'grab' : 'default';
  }

  openZoomModal(imageSrc) {
    if (!this.zoomModal) {
      this.createZoomModal();
    }
    
    const zoomedImg = this.zoomModal.querySelector('.zoomed-image');
    zoomedImg.src = imageSrc;
    zoomedImg.style.cursor = 'grab';
    
    // Reset zoom state
    this.resetZoom();
    
    // Show modal
    this.zoomModal.style.display = 'block';
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  }

  closeZoomModal() {
    if (this.zoomModal) {
      this.zoomModal.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      this.zoomModal.requestFullscreen().catch(err => {
        console.log(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  }

  async toggleCommentsPanel(postId) {
    const panel = document.getElementById(`comments-panel-${postId}`);
    const toggleBtn = document.querySelector(`.comment-toggle-btn[data-post-id="${postId}"]`);
    
    if (!panel || !toggleBtn) return;
    
    if (panel.style.display === 'none') {
      // Close other comment panels
      document.querySelectorAll('.comments-panel').forEach(p => {
        if (p.id !== `comments-panel-${postId}`) {
          p.style.display = 'none';
        }
      });
      
      document.querySelectorAll('.comment-toggle-btn').forEach(btn => {
        if (btn.dataset.postId !== postId) {
          btn.classList.remove('active');
        }
      });
      
      // Show and load comments
      panel.style.display = 'block';
      toggleBtn.classList.add('active');
      
      // Load comments if not already loaded
      if (panel.querySelector('.comments-loading')) {
        await this.loadComments(postId, panel);
      }
    } else {
      // Hide comments
      panel.style.display = 'none';
      toggleBtn.classList.remove('active');
    }
  }

  async loadComments(postId, container) {
    try {
      const response = await fetch(`${this.apiBase}/${postId}/comments`);
      if (!response.ok) throw new Error('Failed to load comments');
      
      const comments = await response.json();
      this.renderComments(comments, container, postId);
    } catch (error) {
      console.error('Failed to load comments:', error);
      container.innerHTML = '<div class="error">Failed to load comments</div>';
    }
  }

  renderComments(comments, container, postId) {
    if (comments.length === 0) {
      container.innerHTML = `
        <div class="no-comments">No comments yet. Be the first to comment!</div>
        <div class="add-comment-form">
          <textarea class="comment-input" placeholder="Add a comment..." rows="3"></textarea>
          <div class="comment-form-actions">
            <button class="submit-comment-btn" data-post-id="${postId}">Post Comment</button>
          </div>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="comments-list">
          ${comments.map(comment => `
            <div class="comment" data-comment-id="${comment.id}">
              <div class="comment-header">
                <img src="${comment.profile_picture}" alt="${comment.username}" class="comment-avatar">
                <div class="comment-user-info">
                  <strong>${this.escapeHtml(comment.username)}</strong>
                  <div class="comment-meta">
                    ${new Date(comment.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
                ${comment.user_id === (window.auth?.currentUser?.id || localStorage.getItem('userId')) ? 
                  `<button class="delete-comment-btn" data-comment-id="${comment.id}" title="Delete comment">×</button>` : 
                  ''}
              </div>
              <div class="comment-content">${this.escapeHtml(comment.content)}</div>
              ${comment.image_url ? 
                `<img src="${comment.image_url}" alt="Comment image" class="comment-image" loading="lazy">` : 
                ''}
            </div>
          `).join('')}
        </div>
        <div class="add-comment-form">
          <textarea class="comment-input" placeholder="Add a comment..." rows="3"></textarea>
          <div class="comment-form-actions">
            <button class="submit-comment-btn" data-post-id="${postId}">Post Comment</button>
          </div>
        </div>
      `;
    }
    
    // Add event listener for submitting comments
    const submitBtn = container.querySelector('.submit-comment-btn');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => this.submitComment(postId, container));
    }
    
    // Add enter key to submit comment
    const textarea = container.querySelector('.comment-input');
    if (textarea) {
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.submitComment(postId, container);
        }
      });
    }
    
    // Add event listeners for delete buttons
    container.querySelectorAll('.delete-comment-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteComment(btn.dataset.commentId, postId, container);
      });
    });
  }

  async submitComment(postId, container) {
    const textarea = container.querySelector('.comment-input');
    const content = textarea.value.trim();
    
    if (!content) {
      alert('Please enter a comment');
      return;
    }
    
    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          post_id: postId,
          content: content
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to post comment');
      }
      
      // Clear input and reload comments
      textarea.value = '';
      await this.loadComments(postId, container);
      
      // Update comment count
      const commentCountEl = document.querySelector(`.comment-toggle-btn[data-post-id="${postId}"] .comment-count`);
      if (commentCountEl) {
        const currentCount = parseInt(commentCountEl.textContent) || 0;
        commentCountEl.textContent = currentCount + 1;
      }
    } catch (error) {
      console.error('Failed to submit comment:', error);
      alert('Failed to post comment: ' + error.message);
    }
  }

  async deleteComment(commentId, postId, container) {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    
    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete comment');
      }
      
      // Reload comments
      await this.loadComments(postId, container);
      
      // Update comment count
      const commentCountEl = document.querySelector(`.comment-toggle-btn[data-post-id="${postId}"] .comment-count`);
      if (commentCountEl) {
        const currentCount = parseInt(commentCountEl.textContent) || 0;
        commentCountEl.textContent = Math.max(0, currentCount - 1);
      }
    } catch (error) {
      console.error('Failed to delete comment:', error);
      alert('Failed to delete comment: ' + error.message);
    }
  }

  async toggleLike(postId, button) {
    try {
      const response = await fetch(`${this.apiBase}/${postId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      const result = await response.json();
      
      if (response.ok) {
        const likeCountSpan = button.querySelector('.like-count');
        const likeIcon = button.querySelector('.like-icon');
        const currentLikes = parseInt(likeCountSpan.textContent);
        
        if (result.liked) {
          button.classList.add('liked');
          likeIcon.textContent = '❤️';
          likeCountSpan.textContent = currentLikes + 1;
          
          // Add animation
          button.style.transform = 'scale(1.1)';
          setTimeout(() => {
            button.style.transform = 'scale(1)';
          }, 200);
        } else {
          button.classList.remove('liked');
          likeIcon.textContent = '🤍';
          likeCountSpan.textContent = currentLikes - 1;
        }
      } else {
        if (response.status === 401) {
          window.location.href = '/login.html';
        }
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
      alert('Failed to like post. Please try again.');
    }
  }

  sharePost(postId, title) {
    const url = `${window.location.origin}/post.html?id=${postId}`;
    const text = `Check out this post: "${title}" on StoryNest`;
    
    if (navigator.share) {
      navigator.share({
        title: title,
        text: text,
        url: url
      }).catch(err => {
        console.log('Error sharing:', err);
        this.copyToClipboard(url);
      });
    } else {
      this.copyToClipboard(url);
    }
  }

  copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      // Show success message
      const notification = document.createElement('div');
      notification.className = 'notification';
      notification.textContent = 'Link copied to clipboard!';
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 1rem;
        border-radius: 4px;
        z-index: 1000;
        animation: slideIn 0.3s ease;
      `;
      
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.remove();
      }, 3000);
    }).catch(err => {
      console.error('Failed to copy:', err);
      alert('Failed to copy link. Please copy manually:\n\n' + text);
    });
  }

  setupCommentPanels() {
    // Close comment panels when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.comments-panel') && 
          !e.target.closest('.comment-toggle-btn')) {
        document.querySelectorAll('.comments-panel').forEach(panel => {
          panel.style.display = 'none';
        });
        document.querySelectorAll('.comment-toggle-btn').forEach(btn => {
          btn.classList.remove('active');
        });
      }
    });
  }

  setupEventListeners() {
    // Category filters
    document.querySelectorAll('.category-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentCategory = e.target.dataset.category;
        this.loadPosts();
      });
    });
    
    // Search
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          if (e.target.value.trim()) {
            this.searchPosts(e.target.value.trim());
          } else {
            this.loadPosts();
          }
        }, 500);
      });
      
      // Allow pressing Enter to search
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          if (searchInput.value.trim()) {
            this.searchPosts(searchInput.value.trim());
          }
        }
      });
    }
  }

  async searchPosts(query) {
    try {
      const response = await fetch(`${this.apiBase}/search/${encodeURIComponent(query)}`);
      const posts = await response.json();
      this.renderPosts(posts);
    } catch (error) {
      console.error('Search failed:', error);
      const feed = document.getElementById('feed');
      if (feed) {
        feed.innerHTML = '<div class="error">Search failed. Please try again.</div>';
      }
    }
  }

  setupInfiniteScroll() {
    window.addEventListener('scroll', () => {
      if (this.isLoading || !this.hasMorePosts) return;
      
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      
      if (scrollTop + clientHeight >= scrollHeight - 100) {
        this.loadPosts(true);
      }
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize post manager on feed page
if (document.getElementById('feed')) {
  const postManager = new PostManager();
}