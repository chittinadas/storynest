class CreatePostManager {
  constructor() {
    this.apiBase = '/api/posts';
    this.mediaFiles = [];
    this.maxFiles = 10;
    this.maxFileSize = 50 * 1024 * 1024; // 50MB
    
    if (document.getElementById('createPostForm')) {
      this.init();
    }
  }

  async init() {
    // First check authentication
    await this.checkAuthentication();
    
    // If authenticated, setup the form
    this.setupEventListeners();
    this.setupPostTypeToggle();
    this.setupFileUpload();
  }

  async checkAuthentication() {
    console.log('Checking authentication for create post...');
    
    // Check if auth manager exists and user is logged in
    if (!window.auth || !window.auth.isLoggedIn()) {
      console.log('User not logged in, checking localStorage...');
      
      // Check localStorage
      const user = localStorage.getItem('user');
      const userId = localStorage.getItem('userId');
      
      if (!user || !userId) {
        console.log('No user found, redirecting to login...');
        alert('Please login to create a post!');
        window.location.href = '/login.html';
        return false;
      }
      
      // Set auth manager user if exists
      if (window.auth) {
        window.auth.currentUser = JSON.parse(user);
        window.auth.updateUIForLoggedInUser();
      }
    }
    
    return true;
  }

  setupPostTypeToggle() {
    const postTypeSelect = document.getElementById('postType');
    const mediaUploadSection = document.getElementById('mediaUploadSection');
    
    if (postTypeSelect && mediaUploadSection) {
      postTypeSelect.addEventListener('change', (e) => {
        if (e.target.value === 'mixed') {
          mediaUploadSection.style.display = 'block';
        } else {
          mediaUploadSection.style.display = 'none';
          this.clearMediaFiles();
        }
      });
      
      // Initialize based on current value
      if (postTypeSelect.value === 'mixed') {
        mediaUploadSection.style.display = 'block';
      }
    }
  }

  setupFileUpload() {
    const fileInput = document.getElementById('postMedia');
    const filePreview = document.getElementById('mediaPreview');
    
    if (!fileInput || !filePreview) return;
    
    // Create file preview container
    const previewContainer = document.createElement('div');
    previewContainer.className = 'file-preview-container';
    filePreview.appendChild(previewContainer);
    
    // Create file count display
    const fileCount = document.createElement('div');
    fileCount.className = 'file-count';
    fileCount.textContent = '0 files selected';
    filePreview.appendChild(fileCount);
    
    // Update file input to allow multiple
    fileInput.multiple = true;
    fileInput.accept = 'image/*,video/*';
    
    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      this.handleFileSelection(files, previewContainer, fileCount);
    });
    
    // Add drag and drop support
    const dropZone = fileInput.closest('.form-group') || filePreview;
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.style.backgroundColor = 'rgba(255, 107, 0, 0.1)';
      dropZone.style.borderColor = 'var(--primary-color)';
    });
    
    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropZone.style.backgroundColor = '';
      dropZone.style.borderColor = '';
    });
    
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.backgroundColor = '';
      dropZone.style.borderColor = '';
      
      const files = Array.from(e.dataTransfer.files);
      this.handleFileSelection(files, previewContainer, fileCount);
      
      // Update file input files
      const dataTransfer = new DataTransfer();
      this.mediaFiles.forEach(file => dataTransfer.items.add(file));
      fileInput.files = dataTransfer.files;
    });
  }

  handleFileSelection(files, previewContainer, fileCount) {
    // Clear existing files if we're at max
    if (this.mediaFiles.length + files.length > this.maxFiles) {
      alert(`Maximum ${this.maxFiles} files allowed. You already have ${this.mediaFiles.length} files.`);
      return;
    }
    
    files.forEach(file => {
      // Validate file
      const validation = this.validateFile(file);
      if (!validation.isValid) {
        alert(validation.error);
        return;
      }
      
      // Check for duplicates
      const isDuplicate = this.mediaFiles.some(
        existingFile => existingFile.name === file.name && existingFile.size === file.size
      );
      
      if (isDuplicate) {
        alert(`File "${file.name}" is already added.`);
        return;
      }
      
      // Add to media files
      this.mediaFiles.push(file);
      
      // Create preview
      this.createFilePreview(file, previewContainer);
    });
    
    // Update file count
    this.updateFileCount(fileCount);
  }

  validateFile(file) {
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
      'video/mp4', 'video/webm', 'video/ogg'
    ];
    
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.webm', '.ogg'];
    
    if (file.size > this.maxFileSize) {
      return {
        isValid: false,
        error: `File "${file.name}" is too large. Maximum size is ${this.maxFileSize / (1024 * 1024)}MB.`
      };
    }
    
    if (!allowedTypes.includes(file.type)) {
      const extension = '.' + file.name.split('.').pop().toLowerCase();
      if (!allowedExtensions.includes(extension)) {
        return {
          isValid: false,
          error: `File "${file.name}" has invalid extension. Allowed: ${allowedExtensions.join(', ')}`
        };
      }
    }
    
    return { isValid: true };
  }

  createFilePreview(file, container) {
    const preview = document.createElement('div');
    preview.className = 'file-preview';
    preview.dataset.filename = file.name;
    
    if (file.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.alt = file.name;
      img.loading = 'lazy';
      preview.appendChild(img);
    } else if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.controls = true;
      video.preload = 'metadata';
      preview.appendChild(video);
    } else {
      const icon = document.createElement('div');
      icon.className = 'file-icon';
      icon.textContent = '📄';
      preview.appendChild(icon);
      
      const name = document.createElement('div');
      name.className = 'file-name';
      name.textContent = file.name;
      preview.appendChild(name);
    }
    
    // Add remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-file';
    removeBtn.innerHTML = '×';
    removeBtn.title = 'Remove file';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeFile(file.name, preview, container);
    });
    preview.appendChild(removeBtn);
    
    container.appendChild(preview);
  }

  removeFile(filename, previewElement, container) {
    // Remove from media files array
    this.mediaFiles = this.mediaFiles.filter(file => file.name !== filename);
    
    // Remove preview element
    if (previewElement.parentNode === container) {
      container.removeChild(previewElement);
    }
    
    // Update file count
    const fileCount = container.parentNode.querySelector('.file-count');
    this.updateFileCount(fileCount);
    
    // Update file input
    const fileInput = document.getElementById('postMedia');
    if (fileInput) {
      const dataTransfer = new DataTransfer();
      this.mediaFiles.forEach(file => dataTransfer.items.add(file));
      fileInput.files = dataTransfer.files;
    }
  }

  updateFileCount(fileCountElement) {
    if (!fileCountElement) return;
    
    const count = this.mediaFiles.length;
    const sizeMB = this.mediaFiles.reduce((total, file) => total + file.size, 0) / (1024 * 1024);
    
    fileCountElement.textContent = 
      `${count} file${count !== 1 ? 's' : ''} selected (${sizeMB.toFixed(1)} MB)`;
    
    // Update color based on count
    if (count >= this.maxFiles) {
      fileCountElement.style.color = '#ff4444';
    } else if (count > 0) {
      fileCountElement.style.color = '#4CAF50';
    } else {
      fileCountElement.style.color = 'var(--text-secondary)';
    }
  }

  clearMediaFiles() {
    this.mediaFiles = [];
    
    const previewContainer = document.querySelector('.file-preview-container');
    if (previewContainer) {
      previewContainer.innerHTML = '';
    }
    
    const fileCount = document.querySelector('.file-count');
    if (fileCount) {
      this.updateFileCount(fileCount);
    }
    
    const fileInput = document.getElementById('postMedia');
    if (fileInput) {
      fileInput.value = '';
    }
  }

  setupEventListeners() {
    console.log('Setting up create post event listeners');
    
    // Form submission
    const form = document.getElementById('createPostForm');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('Submitting post form...');
        
        // Get form data
        const title = document.getElementById('postTitle').value.trim();
        const content = document.getElementById('postContent').value.trim();
        const category = document.getElementById('postCategory').value;
        const postType = document.getElementById('postType').value;
        
        // Validation
        const errors = [];
        
        if (!title) {
          errors.push('Please enter a title');
        } else if (title.length > 200) {
          errors.push('Title must be less than 200 characters');
        }
        
        if (!content) {
          errors.push('Please enter content');
        }
        
        if (!category) {
          errors.push('Please select a category');
        }
        
        // Check if mixed post has media
        if (postType === 'mixed' && this.mediaFiles.length === 0) {
          errors.push('Please select at least one media file for mixed post');
        }
        
        if (errors.length > 0) {
          alert(errors.join('\n'));
          return;
        }
        
        // Get user ID
        const userId = localStorage.getItem('userId');
        if (!userId) {
          alert('Session expired. Please login again!');
          window.location.href = '/login.html';
          return;
        }
        
        // Create FormData
        const formData = new FormData();
        formData.append('title', title);
        formData.append('content', content);
        formData.append('category', category);
        formData.append('post_type', postType);
        
        // Add all media files
        this.mediaFiles.forEach((file, index) => {
          formData.append('media', file);
        });
        
        // Submit form
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-small"></span> Creating Post...';
        
        try {
          console.log('Sending post data...');
          const response = await fetch(this.apiBase, {
            method: 'POST',
            body: formData,
            credentials: 'include'
          });
          
          console.log('Response status:', response.status);
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create post');
          }
          
          const result = await response.json();
          console.log('Post created successfully:', result);
          
          // Show success message
          const successMsg = document.createElement('div');
          successMsg.className = 'success-message';
          successMsg.innerHTML = `
            <div style="text-align: center; padding: 1rem;">
              <div style="font-size: 3rem; margin-bottom: 1rem;">🎉</div>
              <h3>Post Created Successfully!</h3>
              <p>Your post has been published.</p>
              <div style="margin-top: 1rem;">
                <button id="viewPostBtn" class="btn btn-primary" style="margin-right: 0.5rem;">
                  View Post
                </button>
                <button id="createAnotherBtn" class="btn btn-outline">
                  Create Another
                </button>
              </div>
            </div>
          `;
          
          form.parentNode.replaceChild(successMsg, form);
          
          // Add event listeners to success buttons
          document.getElementById('viewPostBtn').addEventListener('click', () => {
            window.location.href = `/post.html?id=${result.postId}`;
          });
          
          document.getElementById('createAnotherBtn').addEventListener('click', () => {
            window.location.reload();
          });
          
        } catch (error) {
          console.error('Create post error:', error);
          
          // Show error message
          const errorDiv = document.createElement('div');
          errorDiv.className = 'error-message';
          errorDiv.style.cssText = `
            background: #ffebee;
            color: #c62828;
            padding: 1rem;
            border-radius: 4px;
            margin: 1rem 0;
            border-left: 4px solid #c62828;
          `;
          errorDiv.textContent = `Error: ${error.message}`;
          
          form.insertBefore(errorDiv, form.firstChild);
          
          // Scroll to error
          errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      });
    }
    
    // Cancel button
    const cancelBtn = document.querySelector('button[type="button"]');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        if (this.mediaFiles.length > 0 || 
            document.getElementById('postTitle').value.trim() || 
            document.getElementById('postContent').value.trim()) {
          if (confirm('Are you sure? Your post will not be saved.')) {
            window.location.href = '/';
          }
        } else {
          window.location.href = '/';
        }
      });
    }
    
    // Character counter for title
    const titleInput = document.getElementById('postTitle');
    if (titleInput) {
      const counter = document.createElement('div');
      counter.className = 'char-counter';
      counter.style.cssText = `
        text-align: right;
        font-size: 0.8rem;
        color: var(--text-secondary);
        margin-top: 0.25rem;
      `;
      counter.textContent = '0/200';
      titleInput.parentNode.appendChild(counter);
      
      titleInput.addEventListener('input', () => {
        const length = titleInput.value.length;
        counter.textContent = `${length}/200`;
        
        if (length > 180) {
          counter.style.color = '#ff9800';
        } else if (length > 200) {
          counter.style.color = '#f44336';
        } else {
          counter.style.color = 'var(--text-secondary)';
        }
      });
    }
    
    // Character counter for content
    const contentInput = document.getElementById('postContent');
    if (contentInput) {
      const counter = document.createElement('div');
      counter.className = 'char-counter';
      counter.style.cssText = `
        text-align: right;
        font-size: 0.8rem;
        color: var(--text-secondary);
        margin-top: 0.25rem;
      `;
      counter.textContent = '0 characters';
      contentInput.parentNode.appendChild(counter);
      
      contentInput.addEventListener('input', () => {
        const length = contentInput.value.length;
        counter.textContent = `${length} characters`;
        
        if (length > 5000) {
          counter.style.color = '#f44336';
        } else if (length > 4000) {
          counter.style.color = '#ff9800';
        } else {
          counter.style.color = 'var(--text-secondary)';
        }
      });
    }
  }
}

// Initialize create post manager when page loads
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('createPostForm')) {
    new CreatePostManager();
  }
});