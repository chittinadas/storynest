class ProfileManager {
  constructor() {
    this.apiBase = '/api/users';
    this.currentUser = null;
    this.init();
  }

  async init() {
    console.log('ProfileManager initializing...');
    
    // Check authentication first
    const isAuthenticated = await this.checkAuth();
    if (!isAuthenticated) {
      return;
    }
    
    // Load profile data
    await this.loadProfile();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Load user's posts
    await this.loadUserPosts();
    
    console.log('ProfileManager initialized successfully');
  }

  async checkAuth() {
    console.log('Checking authentication...');
    
    // Method 1: Check if auth manager exists and user is logged in
    if (window.auth) {
      console.log('Auth manager found, checking login status...');
      if (window.auth.isLoggedIn && window.auth.isLoggedIn()) {
        this.currentUser = window.auth.getCurrentUser ? window.auth.getCurrentUser() : null;
        console.log('User authenticated via auth manager:', this.currentUser);
        return true;
      }
    }
    
    // Method 2: Check localStorage
    const storedUser = localStorage.getItem('user');
    const storedUserId = localStorage.getItem('userId');
    
    console.log('LocalStorage check - user:', storedUser ? 'found' : 'not found', 'userId:', storedUserId);
    
    if (storedUser && storedUserId) {
      try {
        this.currentUser = JSON.parse(storedUser);
        console.log('User loaded from localStorage:', this.currentUser);
        
        // Update auth manager if exists
        if (window.auth && window.auth.currentUser === null) {
          window.auth.currentUser = this.currentUser;
          if (window.auth.updateUIForLoggedInUser) {
            window.auth.updateUIForLoggedInUser();
          }
        }
        
        return true;
      } catch (error) {
        console.error('Error parsing user from localStorage:', error);
      }
    }
    
    // Method 3: Check session via API
    try {
      console.log('Checking session via API...');
      const response = await fetch('/api/auth/session', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const sessionData = await response.json();
        if (sessionData.loggedIn && sessionData.user) {
          this.currentUser = sessionData.user;
          console.log('User authenticated via session:', this.currentUser);
          
          // Store in localStorage
          localStorage.setItem('user', JSON.stringify(sessionData.user));
          localStorage.setItem('userId', sessionData.user.id);
          
          // Update auth manager
          if (window.auth) {
            window.auth.currentUser = sessionData.user;
            if (window.auth.updateUIForLoggedInUser) {
              window.auth.updateUIForLoggedInUser();
            }
          }
          
          return true;
        }
      }
    } catch (error) {
      console.error('Session check failed:', error);
    }
    
    // No authentication found
    console.log('No authentication found, redirecting to login...');
    this.showLoginPrompt();
    return false;
  }

  showLoginPrompt() {
    const profileHeader = document.querySelector('.profile-header');
    if (profileHeader) {
      profileHeader.innerHTML = `
        <div style="text-align: center; padding: 3rem;">
          <div style="font-size: 4rem; margin-bottom: 1rem;">🔒</div>
          <h2>Authentication Required</h2>
          <p style="margin: 1rem 0; color: var(--text-secondary);">
            Please login to view your profile
          </p>
          <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 2rem;">
            <a href="/login.html" class="btn btn-primary">
              Login
            </a>
            <a href="/register.html" class="btn btn-outline">
              Register
            </a>
          </div>
        </div>
      `;
    }
    
    // Clear posts container
    const postsContainer = document.getElementById('userPosts');
    if (postsContainer) {
      postsContainer.innerHTML = '';
    }
  }

  async loadProfile() {
    try {
      console.log('Loading profile from API...');
      
      // Get current user data
      const response = await fetch(`${this.apiBase}/me`, {
        method: 'GET',
        credentials: 'include', // Important for session cookies
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Profile API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Profile API error response:', errorText);
        
        if (response.status === 401) {
          // Unauthorized - clear storage and redirect
          localStorage.removeItem('user');
          localStorage.removeItem('userId');
          this.showLoginPrompt();
          return;
        }
        
        throw new Error(`Failed to load profile: ${response.status} ${errorText}`);
      }
      
      const user = await response.json();
      console.log('Profile data received:', user);
      
      this.displayProfile(user);
      
    } catch (error) {
      console.error('Profile load error:', error);
      
      // Show error message but don't redirect
      const profileHeader = document.querySelector('.profile-header');
      if (profileHeader) {
        profileHeader.innerHTML = `
          <div style="text-align: center; padding: 2rem;">
            <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
            <h3>Profile Load Error</h3>
            <p style="color: var(--text-secondary); margin: 1rem 0;">
              ${error.message || 'Failed to load profile data'}
            </p>
            <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 1rem;">
              <button onclick="location.reload()" class="btn btn-primary">
                Retry
              </button>
              <button onclick="window.location.href='/'" class="btn btn-outline">
                Go Home
              </button>
            </div>
          </div>
        `;
      }
    }
  }

  displayProfile(user) {
    console.log('Displaying profile for user:', user);
    
    // Update username
    const usernameElement = document.getElementById('profileUsername');
    if (usernameElement) {
      usernameElement.textContent = user.username || 'User';
    }
    
    // Update bio
    const bioElement = document.getElementById('profileBio');
    if (bioElement) {
      bioElement.textContent = user.bio || 'No bio yet';
      bioElement.style.color = user.bio ? 'var(--text-color)' : 'var(--text-secondary)';
    }
    
    // Update profile picture
    const avatarElement = document.getElementById('profileAvatar');
    if (avatarElement) {
      avatarElement.src = user.profile_picture || 'https://i.postimg.cc/MHz2HFfj/icons8-user-default-64.png';
      avatarElement.alt = `${user.username}'s profile picture`;
    }
    
    // Format join date
    let joinDateFormatted = 'Unknown';
    if (user.join_date) {
      try {
        const joinDate = new Date(user.join_date);
        joinDateFormatted = joinDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      } catch (e) {
        console.error('Error formatting join date:', e);
      }
    }
    
    // Update stats
    const statsElement = document.getElementById('profileStats');
    if (statsElement) {
      const postCount = user.post_count || 0;
      statsElement.innerHTML = `
        <div style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: center;">
          <span style="background: var(--primary-color); color: white; padding: 0.25rem 0.75rem; border-radius: 12px;">
            ${postCount} Post${postCount !== 1 ? 's' : ''}
          </span>
          <span style="color: var(--text-secondary);">
            Joined ${joinDateFormatted}
          </span>
        </div>
      `;
    }
    
    // Set bio in edit form if modal exists
    const editBioElement = document.getElementById('editBio');
    if (editBioElement) {
      editBioElement.value = user.bio || '';
    }
    
    // Update edit profile button
    const editProfileBtn = document.getElementById('editProfileBtn');
    if (editProfileBtn) {
      editProfileBtn.style.display = 'block';
    }
  }

  async loadUserPosts() {
    try {
      console.log('Loading user posts...');
      
      // Show loading state
      const postsContainer = document.getElementById('userPosts');
      if (postsContainer) {
        postsContainer.innerHTML = `
          <div style="text-align: center; padding: 2rem;">
            <div class="spinner"></div>
            <p style="margin-top: 1rem; color: var(--text-secondary);">
              Loading your posts...
            </p>
          </div>
        `;
      }
      
      // Get current user ID
      const userId = this.currentUser?.id || localStorage.getItem('userId');
      if (!userId) {
        console.log('No user ID available for posts');
        this.showNoPosts();
        return;
      }
      
      // Fetch all posts
      const response = await fetch('/api/posts');
      if (!response.ok) {
        throw new Error(`Failed to fetch posts: ${response.status}`);
      }
      
      const allPosts = await response.json();
      console.log('Total posts fetched:', allPosts.length);
      
      // Filter posts by current user
      const userPosts = allPosts.filter(post => {
        // Check by author_id or username
        const isAuthor = post.author_id && parseInt(post.author_id) === parseInt(userId);
        const isUsernameMatch = post.username && this.currentUser?.username && 
                               post.username === this.currentUser.username;
        
        return isAuthor || isUsernameMatch;
      });
      
      console.log('User posts found:', userPosts.length);
      
      if (userPosts.length === 0) {
        this.showNoPosts();
      } else {
        this.displayUserPosts(userPosts);
      }
      
    } catch (error) {
      console.error('Failed to load user posts:', error);
      
      const postsContainer = document.getElementById('userPosts');
      if (postsContainer) {
        postsContainer.innerHTML = `
          <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
            <div style="font-size: 2rem; margin-bottom: 1rem;">😕</div>
            <p>Failed to load posts: ${error.message}</p>
            <button onclick="profileManager.loadUserPosts()" class="btn btn-outline" style="margin-top: 1rem;">
              Try Again
            </button>
          </div>
        `;
      }
    }
  }

  showNoPosts() {
    const postsContainer = document.getElementById('userPosts');
    if (postsContainer) {
      postsContainer.innerHTML = `
        <div style="text-align: center; padding: 3rem;">
          <div style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.5;">📝</div>
          <h3 style="color: var(--text-secondary); margin-bottom: 0.5rem;">
            No Posts Yet
          </h3>
          <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
            You haven't created any posts yet.
          </p>
          <a href="/create-post.html" class="btn btn-primary">
            Create Your First Post
          </a>
        </div>
      `;
    }
  }

  displayUserPosts(posts) {
    const postsContainer = document.getElementById('userPosts');
    if (!postsContainer) return;
    
    // Clear container
    postsContainer.innerHTML = '';
    
    // Add posts header
    const header = document.createElement('div');
    header.className = 'feed-header';
    header.innerHTML = `<h3>Your Posts (${posts.length})</h3>`;
    postsContainer.appendChild(header);
    
    // Create posts grid
    const postsGrid = document.createElement('div');
    postsGrid.style.display = 'grid';
    postsGrid.style.gap = '1rem';
    postsGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
    
    posts.forEach(post => {
      const postElement = this.createPostCard(post);
      postsGrid.appendChild(postElement);
    });
    
    postsContainer.appendChild(postsGrid);
  }

  createPostCard(post) {
    const card = document.createElement('div');
    card.className = 'post-card';
    card.style.cursor = 'pointer';
    card.onclick = () => {
      window.location.href = `/post.html?id=${post.id}`;
    };
    
    // Format date
    const postDate = new Date(post.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    
    // Get media preview (first image if available)
    let mediaPreview = '';
    let mediaData = [];
    
    if (post.all_media && post.all_media.length > 0) {
      mediaData = Array.isArray(post.all_media) ? post.all_media : JSON.parse(post.all_media);
    } else if (post.media_url) {
      mediaData = [{ url: post.media_url, type: post.media_type }];
    }
    
    const firstImage = mediaData.find(media => media.type?.startsWith('image/'));
    if (firstImage) {
      mediaPreview = `
        <div style="margin: 0.5rem 0; border-radius: 6px; overflow: hidden;">
          <img src="${firstImage.url}" 
               alt="Post image" 
               style="width: 100%; height: 150px; object-fit: cover; border-radius: 4px;">
        </div>
      `;
    }
    
    // Truncate content
    const content = post.content.length > 100 
      ? post.content.substring(0, 100) + '...' 
      : post.content;
    
    card.innerHTML = `
      <div style="padding: 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <span style="background: var(--primary-color); color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem;">
            ${post.category}
          </span>
          <span style="color: var(--text-secondary); font-size: 0.85rem;">
            ${postDate}
          </span>
        </div>
        
        <h4 style="margin: 0.5rem 0; font-size: 1.1rem; color: var(--text-color);">
          ${this.escapeHtml(post.title)}
        </h4>
        
        <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0.5rem 0; line-height: 1.4;">
          ${this.escapeHtml(content)}
        </p>
        
        ${mediaPreview}
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; padding-top: 0.5rem; border-top: 1px solid var(--border-color);">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <span style="color: var(--text-secondary); font-size: 0.85rem;">
              <span style="color: #ff4444;">❤️</span> ${post.likes_count || 0}
            </span>
            <span style="color: var(--text-secondary); font-size: 0.85rem;">
              <span>💬</span> ${post.comment_count || 0}
            </span>
          </div>
          <span style="color: var(--primary-color); font-size: 0.85rem; font-weight: 500;">
            View Post →
          </span>
        </div>
      </div>
    `;
    
    return card;
  }

  setupEventListeners() {
    console.log('Setting up profile event listeners...');
    
    // Edit profile modal
    this.setupEditProfileModal();
    
    // Edit profile button
    const editProfileBtn = document.getElementById('editProfileBtn');
    if (editProfileBtn) {
      editProfileBtn.addEventListener('click', () => {
        this.openEditProfileModal();
      });
    }
    
    // Logout button in nav (if exists)
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.logout();
      });
    }
    
    // Create post button in profile
    const createPostBtn = document.querySelector('.create-post-btn');
    if (createPostBtn) {
      createPostBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = '/create-post.html';
      });
    }
  }

  setupEditProfileModal() {
    // Create modal HTML if not exists
    let modal = document.getElementById('editProfileModal');
    
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'editProfileModal';
      modal.className = 'modal';
      modal.style.display = 'none';
      
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h3 style="margin: 0;">Edit Profile</h3>
            <span class="close-modal" style="font-size: 1.5rem; cursor: pointer; color: var(--text-secondary);">&times;</span>
          </div>
          
          <form id="editProfileForm">
            <div class="form-group">
              <label for="editBio" class="form-label">Bio</label>
              <textarea id="editBio" class="form-input" rows="4" 
                        placeholder="Tell us about yourself..."></textarea>
            </div>
            
            <div class="form-group">
              <label for="profilePicture" class="form-label">Profile Picture</label>
              <input type="file" id="profilePicture" accept="image/*" class="form-input">
              <small style="display: block; margin-top: 0.25rem; color: var(--text-secondary);">
                Max size: 5MB. Allowed: JPG, PNG, WebP, GIF
              </small>
              <div id="profilePicturePreview" style="margin-top: 0.5rem;"></div>
            </div>
            
            <div class="form-group" style="display: flex; gap: 0.5rem; margin-top: 1.5rem;">
              <button type="submit" class="btn btn-primary" style="flex: 1;">
                Save Changes
              </button>
              <button type="button" id="cancelEditBtn" class="btn btn-outline" style="flex: 1;">
                Cancel
              </button>
            </div>
          </form>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Add modal event listeners
      const closeBtn = modal.querySelector('.close-modal');
      const cancelBtn = modal.querySelector('#cancelEditBtn');
      
      closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
      });
      
      cancelBtn.addEventListener('click', () => {
        modal.style.display = 'none';
      });
      
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      });
      
      // Form submission
      const form = modal.querySelector('#editProfileForm');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.updateProfile();
      });
      
      // Profile picture preview
      const pictureInput = modal.querySelector('#profilePicture');
      pictureInput.addEventListener('change', (e) => {
        this.previewProfilePicture(e.target.files[0]);
      });
    }
  }

  openEditProfileModal() {
    const modal = document.getElementById('editProfileModal');
    if (modal) {
      modal.style.display = 'block';
      
      // Load current bio into textarea
      const bioElement = document.getElementById('profileBio');
      const editBio = document.getElementById('editBio');
      if (bioElement && editBio) {
        editBio.value = bioElement.textContent === 'No bio yet' ? '' : bioElement.textContent;
      }
      
      // Clear preview
      const preview = document.getElementById('profilePicturePreview');
      if (preview) {
        preview.innerHTML = '';
      }
    }
  }

  previewProfilePicture(file) {
    if (!file) return;
    
    const preview = document.getElementById('profilePicturePreview');
    if (!preview) return;
    
    // Validate file
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.innerHTML = `
        <div style="display: flex; align-items: center; gap: 1rem;">
          <img src="${e.target.result}" 
               alt="Preview" 
               style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid var(--primary-color);">
          <div>
            <div style="font-weight: 500; margin-bottom: 0.25rem;">${file.name}</div>
            <div style="color: var(--text-secondary); font-size: 0.85rem;">
              ${(file.size / 1024 / 1024).toFixed(2)} MB
            </div>
          </div>
        </div>
      `;
    };
    reader.readAsDataURL(file);
  }

  async updateProfile() {
    try {
      const modal = document.getElementById('editProfileModal');
      const form = document.getElementById('editProfileForm');
      const submitBtn = form.querySelector('button[type="submit"]');
      
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
      
      const bio = document.getElementById('editBio').value.trim();
      const pictureFile = document.getElementById('profilePicture').files[0];
      
      const formData = new FormData();
      if (bio !== undefined) {
        formData.append('bio', bio);
      }
      if (pictureFile) {
        formData.append('profile_picture', pictureFile);
      }
      
      // Update profile via API
      const response = await fetch(`${this.apiBase}/profile`, {
        method: 'PUT',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update profile');
      }
      
      const result = await response.json();
      
      // Update profile display
      if (result.profile_picture) {
        const avatar = document.getElementById('profileAvatar');
        if (avatar) {
          avatar.src = result.profile_picture;
        }
      }
      
      if (bio !== undefined) {
        const bioElement = document.getElementById('profileBio');
        if (bioElement) {
          bioElement.textContent = bio || 'No bio yet';
        }
      }
      
      // Close modal
      modal.style.display = 'none';
      
      // Show success message
      this.showNotification('Profile updated successfully!', 'success');
      
    } catch (error) {
      console.error('Update profile error:', error);
      this.showNotification(`Error: ${error.message}`, 'error');
    } finally {
      const submitBtn = document.querySelector('#editProfileForm button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Changes';
      }
    }
  }

  async logout() {
    try {
      // Call logout API
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      
      // Clear localStorage
      localStorage.removeItem('user');
      localStorage.removeItem('userId');
      
      // Clear auth manager
      if (window.auth) {
        window.auth.currentUser = null;
        if (window.auth.updateUIForGuest) {
          window.auth.updateUIForGuest();
        }
      }
      
      // Redirect to home
      window.location.href = '/';
      
    } catch (error) {
      console.error('Logout error:', error);
      // Still redirect even if API call fails
      window.location.href = '/';
    }
  }

  showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelector('.profile-notification');
    if (existing) {
      existing.remove();
    }
    
    // Create notification
    const notification = document.createElement('div');
    notification.className = `profile-notification notification-${type}`;
    notification.innerHTML = `
      <div style="position: fixed; top: 20px; right: 20px; background: ${type === 'success' ? '#4CAF50' : '#f44336'}; 
           color: white; padding: 1rem 1.5rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
           z-index: 1000; animation: slideIn 0.3s ease;">
        ${message}
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 3000);
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Global instance
let profileManager;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('profileUsername')) {
    profileManager = new ProfileManager();
    window.profileManager = profileManager; // Make it globally accessible
  }
});
