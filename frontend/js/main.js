// Global utility functions for StoryNest

class StoryNestUtils {
  constructor() {
    this.apiBase = '/api';
    this.init();
  }

  init() {
    this.setupGlobalEventListeners();
    this.setupTheme();
  }

  setupGlobalEventListeners() {
    // Escape key to close modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllModals();
      }
    });

    // Click outside to close modals
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
      }
    });
  }

  setupTheme() {
    // Check for saved theme preference or use OS preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }

  closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.style.display = 'none';
    });
  }

  // Format date utility
  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'just now';
    } else if (diffMins < 60) {
      return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  }

  // Truncate text utility
  truncateText(text, maxLength = 100) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  // Show notification
  showNotification(message, type = 'info', duration = 3000) {
    // Remove existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
      existingNotification.remove();
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">${message}</div>
      <button class="notification-close">&times;</button>
    `;

    // Add styles if not already present
    if (!document.querySelector('#notification-styles')) {
      const style = document.createElement('style');
      style.id = 'notification-styles';
      style.textContent = `
        .notification {
          position: fixed;
          top: 20px;
          right: 20px;
          padding: 1rem 1.5rem;
          border-radius: 8px;
          background: var(--card-color);
          color: var(--text-color);
          box-shadow: var(--shadow);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          z-index: 9999;
          max-width: 400px;
          animation: slideIn 0.3s ease;
        }
        
        .notification-success {
          border-left: 4px solid #4CAF50;
        }
        
        .notification-error {
          border-left: 4px solid #f44336;
        }
        
        .notification-info {
          border-left: 4px solid #2196F3;
        }
        
        .notification-warning {
          border-left: 4px solid #ff9800;
        }
        
        .notification-close {
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          font-size: 1.5rem;
          line-height: 1;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // Close button event
    notification.querySelector('.notification-close').addEventListener('click', () => {
      notification.remove();
    });

    // Auto remove after duration
    if (duration > 0) {
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, duration);
    }

    return notification;
  }

  // Confirm dialog
  async showConfirm(message) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.style.display = 'block';
      
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
          <h3>Confirm</h3>
          <p>${message}</p>
          <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
            <button id="confirmYes" class="btn btn-primary" style="flex: 1;">Yes</button>
            <button id="confirmNo" class="btn btn-outline" style="flex: 1;">No</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      modal.querySelector('#confirmYes').addEventListener('click', () => {
        document.body.removeChild(modal);
        resolve(true);
      });
      
      modal.querySelector('#confirmNo').addEventListener('click', () => {
        document.body.removeChild(modal);
        resolve(false);
      });
      
      // Click outside to cancel
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          document.body.removeChild(modal);
          resolve(false);
        }
      });
    });
  }

  // Loading spinner
  showLoading(container, message = 'Loading...') {
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    spinner.innerHTML = `
      <div class="spinner"></div>
      ${message ? `<p>${message}</p>` : ''}
    `;
    
    if (!document.querySelector('#loading-styles')) {
      const style = document.createElement('style');
      style.id = 'loading-styles';
      style.textContent = `
        .loading-spinner {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          text-align: center;
        }
        
        .loading-spinner p {
          margin-top: 1rem;
          color: var(--text-secondary);
        }
      `;
      document.head.appendChild(style);
    }
    
    if (container) {
      container.innerHTML = '';
      container.appendChild(spinner);
    }
    
    return spinner;
  }

  // File validation
  validateFile(file, options = {}) {
    const {
      maxSize = 10 * 1024 * 1024, // 10MB default
      allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'],
      allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.mp4']
    } = options;

    const errors = [];

    // Check file size
    if (file.size > maxSize) {
      const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
      errors.push(`File size must be less than ${maxSizeMB}MB`);
    }

    // Check file type
    if (!allowedTypes.includes(file.type)) {
      errors.push(`File type not allowed. Allowed: ${allowedTypes.join(', ')}`);
    }

    // Check file extension
    const extension = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      errors.push(`File extension not allowed. Allowed: ${allowedExtensions.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // API error handling
  async handleApiError(response) {
    if (response.status === 401) {
      // Unauthorized - redirect to login
      window.location.href = '/login.html';
      throw new Error('Authentication required');
    } else if (response.status === 403) {
      throw new Error('You do not have permission to perform this action');
    } else if (response.status === 404) {
      throw new Error('Resource not found');
    } else if (response.status >= 500) {
      throw new Error('Server error. Please try again later.');
    } else {
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || 'An error occurred');
      } catch (e) {
        throw new Error('An unexpected error occurred');
      }
    }
  }

  // Debounce function for search inputs
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Throttle function for scroll events
  throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // Copy to clipboard
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showNotification('Copied to clipboard!', 'success');
      return true;
    } catch (err) {
      console.error('Failed to copy:', err);
      this.showNotification('Failed to copy', 'error');
      return false;
    }
  }

  // Share utilities
  sharePost(postId, title) {
    if (navigator.share) {
      navigator.share({
        title: title,
        text: 'Check out this post on StoryNest',
        url: `${window.location.origin}/post.html?id=${postId}`
      });
    } else {
      this.copyToClipboard(`${window.location.origin}/post.html?id=${postId}`);
    }
  }

  // Infinite scroll helper
  setupInfiniteScroll(callback, options = {}) {
    const {
      threshold = 100, // pixels from bottom
      container = window,
      enabled = true
    } = options;

    if (!enabled) return;

    const handler = this.throttle(() => {
      if (container === window) {
        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
        if (scrollTop + clientHeight >= scrollHeight - threshold) {
          callback();
        }
      } else {
        const element = container;
        if (element.scrollTop + element.clientHeight >= element.scrollHeight - threshold) {
          callback();
        }
      }
    }, 200);

    if (container === window) {
      window.addEventListener('scroll', handler);
    } else {
      container.addEventListener('scroll', handler);
    }

    // Return cleanup function
    return () => {
      if (container === window) {
        window.removeEventListener('scroll', handler);
      } else {
        container.removeEventListener('scroll', handler);
      }
    };
  }
}

// Initialize utilities
const utils = new StoryNestUtils();

// Make utils globally available
window.StoryNestUtils = utils;