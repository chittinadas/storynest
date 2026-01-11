class ProfileManager {
  constructor() {
    this.apiBase = '/api/users';
    this.init();
  }

  async init() {
    await this.loadProfile();
    this.setupEventListeners();
    this.loadUserPosts();
  }

  async loadProfile() {
    try {
      const response = await fetch(`${this.apiBase}/me`);
      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/login.html';
          return;
        }
        throw new Error('Failed to load profile');
      }
      
      const user = await response.json();
      this.displayProfile(user);
    } catch (error) {
      console.error('Profile load error:', error);
      alert('Failed to load profile. Please try again.');
    }
  }

  displayProfile(user) {
    document.getElementById('profileUsername').textContent = user.username;
    document.getElementById('profileBio').textContent = user.bio || 'No bio yet';
    document.getElementById('profileAvatar').src = user.profile_picture;
    
    const joinDate = new Date(user.join_date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    document.getElementById('profileStats').textContent = 
      `Posts: ${user.post_count || 0} | Joined: ${joinDate}`;
    
    // Set bio in edit form
    document.getElementById('editBio').value = user.bio || '';
  }

  async loadUserPosts() {
    try {
      const response = await fetch('/api/posts');
      const posts = await response.json();
      
      const userPosts = posts.filter(post => 
        post.author_id === parseInt(localStorage.getItem('userId')) || 
        post.author_id === window.auth?.currentUser?.id
      );
      
      this.displayUserPosts(userPosts);
    } catch (error) {
      console.error('Failed to load user posts:', error);
      document.getElementById('userPosts').innerHTML = 
        '<div class="error">Failed to load posts.</div>';
    }
  }

  displayUserPosts(posts) {
    const container = document.getElementById('userPosts');
    
    if (posts.length === 0) {
      container.innerHTML = '<div class="no-posts">You haven\'t posted anything yet.</div>';
      return;
    }
    
    container.innerHTML = posts.map(post => `
      <div class="post-card">
        <div class="post-header">
          <img src="${post.profile_picture}" alt="${post.username}" class="avatar">
          <div>
            <strong>${post.username}</strong>
            <div class="post-meta">Posted in ${post.category} • ${new Date(post.created_at).toLocaleDateString()}</div>
          </div>
        </div>
        
        <h3 class="post-title">${this.escapeHtml(post.title)}</h3>
        
        <div class="post-content">${this.escapeHtml(post.content.substring(0, 200))}${post.content.length > 200 ? '...' : ''}</div>
        
        ${post.media_url ? 
          (post.media_type?.startsWith('image/') ? 
            `<img src="${post.media_url}" alt="Post image" class="post-media" style="max-height: 150px;">` : 
            `<video src="${post.media_url}" class="post-media" style="max-height: 150px;" controls></video>`) : 
          ''}
        
        <div class="post-actions">
          <button class="like-btn" onclick="location.href='/post.html?id=${post.id}'">
            <span>❤️</span> ${post.likes_count} Likes
          </button>
          <button class="comment-btn" onclick="location.href='/post.html?id=${post.id}'">
            <span>💬</span> ${post.comment_count || 0} Comments
          </button>
        </div>
      </div>
    `).join('');
  }

  setupEventListeners() {
    // Edit profile modal
    const editBtn = document.getElementById('editProfileBtn');
    const modal = document.getElementById('editProfileModal');
    const closeBtn = document.querySelector('.close-modal');
    const cancelBtn = document.getElementById('cancelEditBtn');
    
    editBtn?.addEventListener('click', () => {
      modal.style.display = 'block';
    });
    
    closeBtn?.addEventListener('click', () => {
      modal.style.display = 'none';
    });
    
    cancelBtn?.addEventListener('click', () => {
      modal.style.display = 'none';
    });
    
    window.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
    
    // Edit profile form
    const editForm = document.getElementById('editProfileForm');
    editForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData();
      const bio = document.getElementById('editBio').value;
      const profilePicture = document.getElementById('profilePicture').files[0];
      
      formData.append('bio', bio);
      if (profilePicture) {
        formData.append('profile_picture', profilePicture);
      }
      
      try {
        const response = await fetch(`${this.apiBase}/profile`, {
          method: 'PUT',
          body: formData
        });
        
        if (!response.ok) {
          throw new Error('Failed to update profile');
        }
        
        const result = await response.json();
        
        // Update profile picture if changed
        if (result.profile_picture) {
          document.getElementById('profileAvatar').src = result.profile_picture;
        }
        
        // Update bio
        document.getElementById('profileBio').textContent = bio || 'No bio yet';
        
        // Close modal
        modal.style.display = 'none';
        
        alert('Profile updated successfully!');
        
        // Reload profile to get updated data
        await this.loadProfile();
        
      } catch (error) {
        console.error('Update profile error:', error);
        alert('Failed to update profile. Please try again.');
      }
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize profile manager when page loads
if (document.getElementById('profileUsername')) {
  // Wait for auth to initialize
  setTimeout(() => {
    const profileManager = new ProfileManager();
  }, 100);
}