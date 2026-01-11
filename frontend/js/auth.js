class AuthManager {
  constructor() {
    this.apiBase = '/api/auth';
    this.currentUser = null;
    this.init();
  }

  async init() {
    await this.checkSession();
    this.setupEventListeners();
  }

  async checkSession() {
    try {
      console.log('Checking session...');
      const response = await fetch(`${this.apiBase}/session`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        console.log('Session check failed');
        this.updateUIForGuest();
        return;
      }
      
      const data = await response.json();
      console.log('Session data:', data);
      
      if (data.loggedIn && data.user) {
        this.currentUser = data.user;
        this.updateUIForLoggedInUser();
        
        // Store in localStorage for easy access
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('userId', data.user.id);
      } else {
        this.updateUIForGuest();
      }
    } catch (error) {
      console.error('Session check failed:', error);
      this.updateUIForGuest();
    }
  }

  async register(username, email, password) {
    try {
      console.log('Registering user:', username);
      const response = await fetch(`${this.apiBase}/register`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ username, email, password })
      });

      const data = await response.json();
      console.log('Registration response:', data);
      
      if (response.ok) {
        this.currentUser = data.user;
        this.updateUIForLoggedInUser();
        
        // Store user data
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('userId', data.user.id);
        
        // Redirect to home
        window.location.href = '/';
      } else {
        throw new Error(data.error || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert(error.message || 'Registration failed. Please try again.');
      throw error;
    }
  }

  async login(username, password) {
    try {
      console.log('Logging in user:', username);
      const response = await fetch(`${this.apiBase}/login`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();
      console.log('Login response:', data);
      
      if (response.ok) {
        this.currentUser = data.user;
        this.updateUIForLoggedInUser();
        
        // Store user data
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('userId', data.user.id);
        
        // Redirect to home
        window.location.href = '/';
      } else {
        throw new Error(data.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert(error.message || 'Login failed. Please check credentials.');
      throw error;
    }
  }

  async logout() {
    try {
      console.log('Logging out...');
      await fetch(`${this.apiBase}/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      
      this.currentUser = null;
      this.updateUIForGuest();
      
      // Clear localStorage
      localStorage.removeItem('user');
      localStorage.removeItem('userId');
      
      // Redirect to home
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
      alert('Logout failed. Please try again.');
    }
  }

  isLoggedIn() {
    return !!this.currentUser;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  updateUIForLoggedInUser() {
    console.log('Updating UI for logged in user');
    
    // Get user from localStorage if currentUser is null
    if (!this.currentUser) {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        this.currentUser = JSON.parse(storedUser);
      }
    }
    
    if (!this.currentUser) return;
    
    // Update navigation
    const navMenu = document.querySelector('.nav-menu');
    if (navMenu) {
      navMenu.innerHTML = `
        <a href="/create-post.html" class="btn btn-primary">Create Post</a>
        <a href="/profile.html" class="btn btn-outline">Profile</a>
        <button id="logoutBtn" class="btn btn-outline">Logout</button>
      `;
      
      // Add logout event listener
      setTimeout(() => {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
          logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
          });
        }
      }, 100);
    }
    
    // Hide login/register buttons on auth pages
    const authPages = ['/login.html', '/register.html'];
    if (authPages.some(page => window.location.pathname.includes(page))) {
      window.location.href = '/';
    }
  }

  updateUIForGuest() {
    console.log('Updating UI for guest');
    
    // Update navigation
    const navMenu = document.querySelector('.nav-menu');
    if (navMenu) {
      navMenu.innerHTML = `
        <a href="/login.html" class="btn btn-outline">Login</a>
        <a href="/register.html" class="btn btn-primary">Sign Up</a>
      `;
    }
    
    // If on protected pages, redirect to login
    const protectedPages = ['/create-post.html', '/profile.html'];
    if (protectedPages.some(page => window.location.pathname.includes(page))) {
      window.location.href = '/login.html';
    }
  }

  setupEventListeners() {
    console.log('Setting up auth event listeners');
    
    // Registration form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword')?.value;
        
        // Validation
        if (!username || !email || !password) {
          alert('All fields are required!');
          return;
        }
        
        if (password.length < 6) {
          alert('Password must be at least 6 characters long!');
          return;
        }
        
        if (confirmPassword && password !== confirmPassword) {
          alert('Passwords do not match!');
          return;
        }
        
        const submitBtn = registerForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating Account...';
        
        try {
          await this.register(username, email, password);
        } catch (error) {
          console.error('Registration failed:', error);
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      });
    }
    
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        
        if (!username || !password) {
          alert('Please enter username and password!');
          return;
        }
        
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Logging in...';
        
        try {
          await this.login(username, password);
        } catch (error) {
          console.error('Login failed:', error);
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      });
    }
  }
}

// Initialize auth manager globally
window.auth = new AuthManager();