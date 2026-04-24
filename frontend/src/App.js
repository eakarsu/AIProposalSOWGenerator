import React, { useState, useEffect, useCallback, createContext, useContext, Component } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  LayoutDashboard, Users, Building2, FolderKanban, FileText, FileCheck,
  DollarSign, Briefcase, FileCode, Sparkles, Files, BarChart3,
  Settings, LogOut, Plus, Search, X, ChevronRight, ChevronLeft, ArrowLeft,
  Edit, Trash2, Copy, Wand2, RefreshCw, UserCircle, TrendingUp,
  Target, Clock, AlertTriangle, Award, CheckCircle, XCircle, Loader,
  Menu, Download, Printer, ChevronDown, ChevronUp
} from 'lucide-react';

const API_URL = 'http://localhost:5001/api';

// Lightweight markdown-to-HTML renderer for AI text content
function renderMarkdown(text) {
  if (!text) return '';
  try {
    const lines = text.split('\n');
    const result = [];
    let inList = false;

    for (let line of lines) {
      // Escape HTML
      line = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      // Headers
      if (line.match(/^### /)) { if (inList) { result.push('</ul>'); inList = false; } result.push('<h4>' + line.slice(4) + '</h4>'); continue; }
      if (line.match(/^## /)) { if (inList) { result.push('</ul>'); inList = false; } result.push('<h3>' + line.slice(3) + '</h3>'); continue; }
      if (line.match(/^# /)) { if (inList) { result.push('</ul>'); inList = false; } result.push('<h2>' + line.slice(2) + '</h2>'); continue; }

      // Bullet/numbered lists
      const bulletMatch = line.match(/^[-*]\s+(.+)/);
      const numberMatch = line.match(/^\d+\.\s+(.+)/);
      if (bulletMatch || numberMatch) {
        if (!inList) { result.push('<ul>'); inList = true; }
        const content = bulletMatch ? bulletMatch[1] : numberMatch[1];
        result.push('<li>' + applyInline(content) + '</li>');
        continue;
      }

      // Close list if we hit a non-list line
      if (inList) { result.push('</ul>'); inList = false; }

      // Empty line = paragraph break
      if (line.trim() === '') { result.push('<br/>'); continue; }

      // Regular text line
      result.push('<p>' + applyInline(line) + '</p>');
    }

    if (inList) result.push('</ul>');
    return result.join('');
  } catch (e) {
    // Fallback: return plain text if rendering fails
    return '<p>' + text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>') + '</p>';
  }
}

// Apply inline formatting (bold, italic) to a line of text
function applyInline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>');
}

const MarkdownText = ({ content, className }) => {
  if (!content) return null;
  return (
    <div
      className={className || 'ai-text-content'}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  );
};

// ============ Toast Context ============
const ToastContext = createContext(null);
const useToast = () => useContext(ToastContext);

const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);
  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error'),
    info: (msg) => addToast(msg, 'info'),
  };
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.type === 'success' && <CheckCircle size={16} />}
            {t.type === 'error' && <XCircle size={16} />}
            {t.type === 'info' && <AlertTriangle size={16} />}
            <span>{t.message}</span>
            <button className="toast-close" onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}><X size={14} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// ============ Confirm Context ============
const ConfirmContext = createContext(null);
const useConfirm = () => useContext(ConfirmContext);

const ConfirmProvider = ({ children }) => {
  const [state, setState] = useState(null);
  const confirm = useCallback((message, opts = {}) => {
    return new Promise((resolve) => {
      setState({ message, title: opts.title || 'Confirm', variant: opts.variant || 'default', resolve });
    });
  }, []);
  const handleConfirm = () => { state?.resolve(true); setState(null); };
  const handleCancel = () => { state?.resolve(false); setState(null); };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="confirm-overlay" onClick={handleCancel}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <h3 className="confirm-title">{state.title}</h3>
            <p className="confirm-message">{state.message}</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={handleCancel}>Cancel</button>
              <button className={`btn ${state.variant === 'danger' ? 'btn-danger' : 'btn-primary'}`} onClick={handleConfirm}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

// ============ Error Boundary ============
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <AlertTriangle size={48} />
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message || 'An unexpected error occurred'}</p>
          <button className="btn btn-primary" onClick={() => this.setState({ hasError: false, error: null })}>Try Again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============ Form Validation Hook ============
const useFormValidation = (data, rules) => {
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const validate = useCallback(() => {
    const newErrors = {};
    const validators = {
      required: (v) => (!v || (typeof v === 'string' && !v.trim())) ? 'This field is required' : null,
      email: (v) => v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'Invalid email format' : null,
      numeric: (v) => v && isNaN(Number(v)) ? 'Must be a number' : null,
      url: (v) => v && v.trim() && !/^https?:\/\/.+/.test(v) ? 'Invalid URL format' : null,
      phone: (v) => v && v.trim() && !/^[+]?[\d\s()-]{7,}$/.test(v) ? 'Invalid phone format' : null,
    };
    Object.entries(rules).forEach(([field, fieldRules]) => {
      for (const rule of fieldRules) {
        const validator = typeof rule === 'string' ? validators[rule] : null;
        if (validator) {
          const error = validator(data[field]);
          if (error) { newErrors[field] = error; break; }
        }
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [data, rules]);
  const touchField = (field) => setTouched(prev => ({ ...prev, [field]: true }));
  const isValid = Object.keys(errors).length === 0;
  return { errors, touched, touchField, validate, isValid };
};

// ============ Table Skeleton ============
const TableSkeleton = ({ rows = 5, cols = 4 }) => (
  <div className="skeleton-table">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="skeleton-row">
        {Array.from({ length: cols }).map((_, j) => (
          <div key={j} className="skeleton-cell"><div className="skeleton"></div></div>
        ))}
      </div>
    ))}
  </div>
);

// ============ Pagination ============
const PaginationControls = ({ page, totalPages, total, limit, onPageChange, onLimitChange }) => {
  if (totalPages <= 1 && total <= limit) return null;
  const pages = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);
  return (
    <div className="pagination">
      <div className="pagination-info">
        Showing {Math.min(((page - 1) * limit) + 1, total)}-{Math.min(page * limit, total)} of {total}
      </div>
      <div className="pagination-controls">
        <button className="pagination-btn" disabled={page <= 1} onClick={() => onPageChange(page - 1)}><ChevronLeft size={16} /></button>
        {start > 1 && <button className="pagination-btn" onClick={() => onPageChange(1)}>1</button>}
        {start > 2 && <span className="pagination-ellipsis">...</span>}
        {pages.map(p => (
          <button key={p} className={`pagination-btn ${p === page ? 'active' : ''}`} onClick={() => onPageChange(p)}>{p}</button>
        ))}
        {end < totalPages - 1 && <span className="pagination-ellipsis">...</span>}
        {end < totalPages && <button className="pagination-btn" onClick={() => onPageChange(totalPages)}>{totalPages}</button>}
        <button className="pagination-btn" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}><ChevronRight size={16} /></button>
      </div>
      <select className="page-size-select" value={limit} onChange={(e) => onLimitChange(Number(e.target.value))}>
        <option value={10}>10/page</option>
        <option value={25}>25/page</option>
        <option value={50}>50/page</option>
        <option value={100}>100/page</option>
      </select>
    </div>
  );
};

// ============ RoleGuard ============
const RoleGuard = ({ roles, children }) => {
  const { user } = useAuth();
  if (!roles || roles.includes(user?.role)) return children;
  return null;
};

// Auth Context
const AuthContext = createContext(null);

const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      axios.get(`${API_URL}/auth/me`)
        .then(res => setUser(res.data))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await axios.post(`${API_URL}/auth/login`, { email, password });
    localStorage.setItem('token', res.data.token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
    setUser(res.data.user);
    return res.data;
  };

  const register = async (userData) => {
    const res = await axios.post(`${API_URL}/auth/register`, userData);
    localStorage.setItem('token', res.data.token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
    setUser(res.data.user);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div>Loading...</div>;
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// Login Page (with Registration toggle)
const LoginPage = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (isRegister && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      if (isRegister) {
        await register({ email, password, first_name: firstName, last_name: lastName });
      } else {
        await login(email, password);
      }
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || (isRegister ? 'Registration failed' : 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setEmail('admin@proposalgen.com');
    setPassword('password123');
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <div className="login-logo">ProposalGen</div>
          <p className="login-subtitle">AI-Powered Proposal & SOW Generator</p>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div className="form-grid" style={{ marginBottom: 0 }}>
              <div className="form-group">
                <label className="form-label">First Name</label>
                <input className="form-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" required />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name</label>
                <input className="form-input" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" required />
              </div>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required />
          </div>
          {isRegister && (
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input type="password" className="form-input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password" required />
            </div>
          )}
          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
            {loading ? (isRegister ? 'Creating account...' : 'Signing in...') : (isRegister ? 'Create Account' : 'Sign In')}
          </button>
          {!isRegister && (
            <button type="button" className="btn demo-btn btn-block" onClick={fillDemo}>
              <UserCircle size={18} /> Fill Demo Credentials
            </button>
          )}
        </form>
        <div className="login-toggle">
          {isRegister ? (
            <span>Already have an account? <button className="login-link" onClick={() => setIsRegister(false)}>Sign In</button></span>
          ) : (
            <>
              <span>Don't have an account? <button className="login-link" onClick={() => setIsRegister(true)}>Register</button></span>
              <br />
              <button className="login-link" onClick={() => navigate('/forgot-password')}>Forgot password?</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Forgot Password Page
const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await axios.post(`${API_URL}/auth/forgot-password`, { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <div className="login-logo">ProposalGen</div>
          <p className="login-subtitle">Reset Your Password</p>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        {sent ? (
          <div className="alert alert-success" style={{ background: '#dcfce7', color: '#166534', padding: 16, borderRadius: 8, marginBottom: 16 }}>
            If an account exists with that email, a reset link has been generated. Check the server console for the reset token (dev mode).
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" required />
            </div>
            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}
        <div className="login-toggle">
          <button className="login-link" onClick={() => navigate('/login')}>Back to Login</button>
        </div>
      </div>
    </div>
  );
};

// Reset Password Page
const ResetPasswordPage = () => {
  const { token } = useParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setError('');
    setLoading(true);
    try {
      await axios.post(`${API_URL}/auth/reset-password`, { token, password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <div className="login-logo">ProposalGen</div>
          <p className="login-subtitle">Set New Password</p>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        {success ? (
          <div className="alert alert-success" style={{ background: '#dcfce7', color: '#166534', padding: 16, borderRadius: 8 }}>
            Password reset successfully! Redirecting to login...
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input type="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" required />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input type="password" className="form-input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password" required />
            </div>
            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

// Sidebar Navigation
const Sidebar = ({ onNavigate, isOpen }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { section: 'Overview', items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    ]},
    { section: 'Sales', items: [
      { icon: Building2, label: 'Clients', path: '/clients' },
      { icon: FolderKanban, label: 'Projects', path: '/projects' },
      { icon: FileText, label: 'Proposals', path: '/proposals' },
      { icon: FileCheck, label: 'SOWs', path: '/sows' },
    ]},
    { section: 'Configuration', items: [
      { icon: Briefcase, label: 'Services', path: '/services' },
      { icon: DollarSign, label: 'Pricing', path: '/pricing' },
      { icon: FileCode, label: 'Templates', path: '/templates' },
      { icon: Users, label: 'Team', path: '/team', roles: ['admin', 'manager'] },
    ]},
    { section: 'AI Tools', items: [
      { icon: Sparkles, label: 'AI Generator', path: '/ai-generator' },
      { icon: DollarSign, label: 'AI Pricing', path: '/ai-pricing' },
      { icon: TrendingUp, label: 'Win/Loss Analysis', path: '/ai-win-loss' },
      { icon: Target, label: 'Competitor Analysis', path: '/ai-competitors' },
      { icon: Clock, label: 'Timeline Generator', path: '/ai-timeline' },
      { icon: AlertTriangle, label: 'Risk Assessment', path: '/ai-risk' },
    ]},
    { section: 'Analytics', items: [
      { icon: Files, label: 'Documents', path: '/documents' },
      { icon: BarChart3, label: 'Analytics', path: '/analytics' },
    ]},
    { section: 'System', items: [
      { icon: UserCircle, label: 'Profile', path: '/profile' },
      { icon: Settings, label: 'Settings', path: '/settings', roles: ['admin'] },
    ]},
  ];

  const currentPath = window.location.pathname;

  const handleNav = (path) => {
    navigate(path);
    onNavigate && onNavigate();
  };

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-logo">
        <h1><span>P</span>roposalGen</h1>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((section, i) => {
          const visibleItems = section.items.filter(item => !item.roles || item.roles.includes(user?.role));
          if (visibleItems.length === 0) return null;
          return (
            <div key={i} className="nav-section">
              <div className="nav-section-title">{section.section}</div>
              {visibleItems.map((item, j) => (
                <button
                  key={j}
                  className={`nav-item ${currentPath === item.path ? 'active' : ''}`}
                  onClick={() => handleNav(item.path)}
                >
                  <item.icon size={20} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">{user?.firstName?.[0]}{user?.lastName?.[0]}</div>
          <div className="user-details">
            <div className="user-name">{user?.firstName} {user?.lastName}</div>
            <div className="user-role">{user?.role}</div>
          </div>
          <button className="btn btn-ghost" onClick={logout} title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

// Layout Component
const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="layout">
      <button className="hamburger-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <Sidebar isOpen={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
      <main className="main-content">{children}</main>
    </div>
  );
};

// Dashboard
const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get(`${API_URL}/dashboard/stats`)
      .then(res => setStats(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const features = [
    { icon: Building2, label: 'Clients', path: '/clients', color: 'blue', desc: 'Manage client relationships' },
    { icon: FolderKanban, label: 'Projects', path: '/projects', color: 'green', desc: 'Track project progress' },
    { icon: FileText, label: 'Proposals', path: '/proposals', color: 'purple', desc: 'Create winning proposals' },
    { icon: FileCheck, label: 'SOWs', path: '/sows', color: 'orange', desc: 'Generate statements of work' },
    { icon: Sparkles, label: 'AI Generator', path: '/ai-generator', color: 'purple', desc: 'AI-powered content' },
    { icon: DollarSign, label: 'AI Pricing', path: '/ai-pricing', color: 'green', desc: 'AI pricing suggestions' },
    { icon: TrendingUp, label: 'Win/Loss Analysis', path: '/ai-win-loss', color: 'blue', desc: 'Analyze proposal outcomes' },
    { icon: Target, label: 'Competitor Analysis', path: '/ai-competitors', color: 'orange', desc: 'Competitive positioning' },
    { icon: Clock, label: 'Timeline Generator', path: '/ai-timeline', color: 'teal', desc: 'AI project timelines' },
    { icon: AlertTriangle, label: 'Risk Assessment', path: '/ai-risk', color: 'pink', desc: 'AI risk analysis' },
    { icon: Briefcase, label: 'Services', path: '/services', color: 'teal', desc: 'Define service offerings' },
    { icon: Users, label: 'Team', path: '/team', color: 'green', desc: 'Team management' },
  ];

  if (loading) return <div className="loading"><div className="spinner"></div>Loading dashboard...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back! Here's your business overview.</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card" onClick={() => navigate('/clients')}>
          <div className="stat-header">
            <div className="stat-icon blue"><Building2 size={24} /></div>
          </div>
          <div className="stat-value">{stats?.activeClients || 0}</div>
          <div className="stat-label">Active Clients</div>
        </div>
        <div className="stat-card" onClick={() => navigate('/projects')}>
          <div className="stat-header">
            <div className="stat-icon green"><FolderKanban size={24} /></div>
          </div>
          <div className="stat-value">{stats?.activeProjects || 0}</div>
          <div className="stat-label">Active Projects</div>
        </div>
        <div className="stat-card" onClick={() => navigate('/proposals')}>
          <div className="stat-header">
            <div className="stat-icon purple"><FileText size={24} /></div>
          </div>
          <div className="stat-value">{stats?.pendingProposals || 0}</div>
          <div className="stat-label">Pending Proposals</div>
        </div>
        <div className="stat-card" onClick={() => navigate('/sows')}>
          <div className="stat-header">
            <div className="stat-icon orange"><FileCheck size={24} /></div>
          </div>
          <div className="stat-value">{stats?.activeSows || 0}</div>
          <div className="stat-label">Active SOWs</div>
        </div>
        <div className="stat-card" onClick={() => navigate('/proposals')}>
          <div className="stat-header">
            <div className="stat-icon teal"><DollarSign size={24} /></div>
          </div>
          <div className="stat-value">${(stats?.totalRevenue / 1000 || 0).toFixed(0)}k</div>
          <div className="stat-label">Total Revenue</div>
        </div>
      </div>

      <h2 style={{ marginBottom: 24, fontSize: 20, fontWeight: 600 }}>Quick Access</h2>
      <div className="feature-grid">
        {features.map((f, i) => (
          <div key={i} className="feature-card" onClick={() => navigate(f.path)}>
            <div className={`feature-icon stat-icon ${f.color}`}>
              <f.icon size={28} />
            </div>
            <div className="feature-title">{f.label}</div>
            <div className="feature-description">{f.desc}</div>
            <ChevronRight size={20} style={{ color: 'var(--text-secondary)' }} />
          </div>
        ))}
      </div>
    </div>
  );
};

// Generic List Component
const GenericList = ({ title, endpoint, columns, renderRow, FormComponent, detailPath }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState('id');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();

  const fetchItems = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit, sortBy, sortOrder });
    if (search) params.append('search', search);
    axios.get(`${API_URL}/${endpoint}?${params}`)
      .then(res => {
        const d = res.data;
        setItems(d.data || []);
        setTotal(d.total || 0);
        setTotalPages(d.totalPages || 1);
      })
      .catch(err => { console.error(err); toast.error('Failed to load data'); })
      .finally(() => setLoading(false));
  }, [endpoint, page, limit, sortBy, sortOrder, search]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleSave = async (data) => {
    try {
      if (editItem) {
        await axios.put(`${API_URL}/${endpoint}/${editItem.id}`, data);
        toast.success('Item updated successfully');
      } else {
        await axios.post(`${API_URL}/${endpoint}`, data);
        toast.success('Item created successfully');
      }
      setShowModal(false);
      setEditItem(null);
      fetchItems();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to save');
    }
  };

  const handleDelete = async (id) => {
    const ok = await confirm('Are you sure you want to delete this item?', { title: 'Delete Item', variant: 'danger' });
    if (!ok) return;
    try {
      await axios.delete(`${API_URL}/${endpoint}/${id}`);
      toast.success('Item deleted');
      fetchItems();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const ok = await confirm(`Delete ${selectedIds.size} selected items?`, { title: 'Bulk Delete', variant: 'danger' });
    if (!ok) return;
    try {
      await axios.post(`${API_URL}/${endpoint}/bulk-delete`, { ids: Array.from(selectedIds) });
      toast.success(`${selectedIds.size} items deleted`);
      setSelectedIds(new Set());
      fetchItems();
    } catch (err) {
      toast.error('Bulk delete failed');
    }
  };

  const handleSort = (field) => {
    if (!field) return;
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(i => i.id)));
    }
  };

  const exportCSV = () => {
    const headers = columns.filter(c => c.field).map(c => c.label);
    const rows = items.map(item => columns.filter(c => c.field).map(c => {
      const val = String(item[c.field] ?? '');
      return val.includes(',') || val.includes('"') || val.includes('\n') ? `"${val.replace(/"/g, '""')}"` : val;
    }));
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${endpoint}-export.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  const handlePageChange = (newPage) => { setPage(newPage); setSelectedIds(new Set()); };
  const handleLimitChange = (newLimit) => { setLimit(newLimit); setPage(1); setSelectedIds(new Set()); };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">{total} total items</p>
        </div>
        <RoleGuard roles={['admin', 'manager']}>
          <button className="btn btn-primary" onClick={() => { setEditItem(null); setShowModal(true); }}>
            <Plus size={18} /> New Item
          </button>
        </RoleGuard>
      </div>

      {selectedIds.size > 0 && (
        <div className="bulk-toolbar">
          <span className="bulk-count">{selectedIds.size} selected</span>
          <RoleGuard roles={['admin', 'manager']}>
            <button className="btn btn-danger btn-sm" onClick={handleBulkDelete}><Trash2 size={14} /> Delete Selected</button>
          </RoleGuard>
          <button className="btn btn-secondary btn-sm" onClick={() => {
            const selected = items.filter(i => selectedIds.has(i.id));
            const headers = columns.filter(c => c.field).map(c => c.label);
            const rows = selected.map(item => columns.filter(c => c.field).map(c => String(item[c.field] ?? '')));
            const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `${endpoint}-selected.csv`; a.click();
            URL.revokeObjectURL(url);
          }}><Download size={14} /> Export Selected</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelectedIds(new Set())}>Clear</button>
        </div>
      )}

      <div className="table-container">
        <div className="table-header">
          <div className="table-title">All {title}</div>
          <div className="table-actions">
            <input type="text" className="search-input" placeholder="Search..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            <button className="btn btn-secondary btn-sm" onClick={exportCSV} title="Export CSV"><Download size={16} /> CSV</button>
            <button className="btn btn-secondary btn-sm" onClick={() => window.print()} title="Print/PDF"><Printer size={16} /> PDF</button>
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={5} cols={columns.length + 1} />
        ) : items.length === 0 ? (
          <div className="empty-state">
            <Search size={48} />
            <h3>No items found</h3>
            <p>Try adjusting your search or create a new item.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className="checkbox-col">
                  <input type="checkbox" className="row-checkbox" checked={selectedIds.size === items.length && items.length > 0}
                    onChange={toggleSelectAll} />
                </th>
                {columns.map((col, i) => (
                  <th key={i} className={col.field ? 'sortable-header' : ''} onClick={() => handleSort(col.field)}>
                    {col.label}
                    {col.field && sortBy === col.field && (
                      <span className="sort-indicator">{sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
                    )}
                  </th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} onClick={() => detailPath && navigate(`${detailPath}/${item.id}`)}>
                  <td className="checkbox-col" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="row-checkbox" checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)} />
                  </td>
                  {renderRow(item)}
                  <td onClick={(e) => e.stopPropagation()}>
                    <RoleGuard roles={['admin', 'manager']}>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setEditItem(item); setShowModal(true); }}>
                        <Edit size={16} />
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(item.id)}>
                        <Trash2 size={16} />
                      </button>
                    </RoleGuard>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <PaginationControls page={page} totalPages={totalPages} total={total} limit={limit}
          onPageChange={handlePageChange} onLimitChange={handleLimitChange} />
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editItem ? 'Edit' : 'New'} Item</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <FormComponent item={editItem} onSave={handleSave} onCancel={() => setShowModal(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

// Client Form
const ClientForm = ({ item, onSave, onCancel }) => {
  const [data, setData] = useState(item || {
    company_name: '', contact_name: '', email: '', phone: '',
    address: '', city: '', state: '', country: '', industry: '', website: '', notes: '', status: 'active'
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(data); }}>
      <div className="modal-body">
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Company Name *</label>
            <input className="form-input" value={data.company_name} onChange={(e) => setData({...data, company_name: e.target.value})} required />
          </div>
          <div className="form-group">
            <label className="form-label">Contact Name</label>
            <input className="form-input" value={data.contact_name || ''} onChange={(e) => setData({...data, contact_name: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-input" value={data.email || ''} onChange={(e) => setData({...data, email: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input className="form-input" value={data.phone || ''} onChange={(e) => setData({...data, phone: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Industry</label>
            <input className="form-input" value={data.industry || ''} onChange={(e) => setData({...data, industry: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Website</label>
            <input className="form-input" value={data.website || ''} onChange={(e) => setData({...data, website: e.target.value})} />
          </div>
          <div className="form-group full-width">
            <label className="form-label">Address</label>
            <input className="form-input" value={data.address || ''} onChange={(e) => setData({...data, address: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">City</label>
            <input className="form-input" value={data.city || ''} onChange={(e) => setData({...data, city: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">State</label>
            <input className="form-input" value={data.state || ''} onChange={(e) => setData({...data, state: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Country</label>
            <input className="form-input" value={data.country || ''} onChange={(e) => setData({...data, country: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={data.status} onChange={(e) => setData({...data, status: e.target.value})}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="form-group full-width">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" value={data.notes || ''} onChange={(e) => setData({...data, notes: e.target.value})} />
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save</button>
      </div>
    </form>
  );
};

// Client List
const ClientList = () => (
  <GenericList
    title="Clients"
    endpoint="clients"
    columns={[
      { label: 'Company', field: 'company_name' },
      { label: 'Contact', field: 'contact_name' },
      { label: 'Industry', field: 'industry' },
      { label: 'Status', field: 'status' },
    ]}
    renderRow={(item) => (
      <>
        <td><strong>{item.company_name}</strong><br/><small style={{color: 'var(--text-secondary)'}}>{item.email}</small></td>
        <td>{item.contact_name}</td>
        <td>{item.industry}</td>
        <td><span className={`status-badge ${item.status}`}>{item.status}</span></td>
      </>
    )}
    FormComponent={ClientForm}
    detailPath="/clients"
  />
);

// Detail View Component
const DetailView = ({ endpoint, title, renderContent }) => {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get(`${API_URL}/${endpoint}/${id}`)
      .then(res => setItem(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [endpoint, id]);

  if (loading) return <div className="loading"><div className="spinner"></div>Loading...</div>;
  if (!item) return <div className="empty-state"><h3>Item not found</h3></div>;

  return (
    <div>
      <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
        <ArrowLeft size={18} /> Back
      </button>
      {renderContent(item)}
    </div>
  );
};

// Client Detail
const ClientDetail = () => (
  <DetailView
    endpoint="clients"
    title="Client"
    renderContent={(item) => (
      <div className="detail-container">
        <div className="detail-header">
          <div>
            <h1 className="detail-title">{item.company_name}</h1>
            <div className="detail-meta">
              <span>{item.industry}</span>
              <span className={`status-badge ${item.status}`}>{item.status}</span>
            </div>
          </div>
        </div>
        <div className="detail-body">
          <div className="detail-section">
            <h3 className="detail-section-title">Contact Information</h3>
            <div className="detail-grid">
              <div className="detail-item"><div className="detail-label">Contact Name</div><div className="detail-value">{item.contact_name || '-'}</div></div>
              <div className="detail-item"><div className="detail-label">Email</div><div className="detail-value">{item.email || '-'}</div></div>
              <div className="detail-item"><div className="detail-label">Phone</div><div className="detail-value">{item.phone || '-'}</div></div>
              <div className="detail-item"><div className="detail-label">Website</div><div className="detail-value">{item.website || '-'}</div></div>
            </div>
          </div>
          <div className="detail-section">
            <h3 className="detail-section-title">Location</h3>
            <div className="detail-grid">
              <div className="detail-item"><div className="detail-label">Address</div><div className="detail-value">{item.address || '-'}</div></div>
              <div className="detail-item"><div className="detail-label">City</div><div className="detail-value">{item.city || '-'}</div></div>
              <div className="detail-item"><div className="detail-label">State</div><div className="detail-value">{item.state || '-'}</div></div>
              <div className="detail-item"><div className="detail-label">Country</div><div className="detail-value">{item.country || '-'}</div></div>
            </div>
          </div>
          {item.notes && (
            <div className="detail-section">
              <h3 className="detail-section-title">Notes</h3>
              <p>{item.notes}</p>
            </div>
          )}
        </div>
      </div>
    )}
  />
);

// Project Form
const ProjectForm = ({ item, onSave, onCancel }) => {
  const [data, setData] = useState(item || {
    name: '', description: '', status: 'planning', priority: 'medium', budget: ''
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(data); }}>
      <div className="modal-body">
        <div className="form-grid">
          <div className="form-group full-width">
            <label className="form-label">Project Name *</label>
            <input className="form-input" value={data.name} onChange={(e) => setData({...data, name: e.target.value})} required />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={data.status} onChange={(e) => setData({...data, status: e.target.value})}>
              <option value="planning">Planning</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Priority</label>
            <select className="form-select" value={data.priority} onChange={(e) => setData({...data, priority: e.target.value})}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Budget</label>
            <input type="number" className="form-input" value={data.budget || ''} onChange={(e) => setData({...data, budget: e.target.value})} />
          </div>
          <div className="form-group full-width">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" value={data.description || ''} onChange={(e) => setData({...data, description: e.target.value})} />
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save</button>
      </div>
    </form>
  );
};

// Project List
const ProjectList = () => (
  <GenericList
    title="Projects"
    endpoint="projects"
    columns={[
      { label: 'Project', field: 'name' },
      { label: 'Status', field: 'status' },
      { label: 'Priority', field: 'priority' },
      { label: 'Budget', field: 'budget' },
    ]}
    renderRow={(item) => (
      <>
        <td><strong>{item.name}</strong></td>
        <td><span className={`status-badge ${item.status}`}>{item.status?.replace('_', ' ')}</span></td>
        <td>{item.priority}</td>
        <td>${(item.budget / 1000).toFixed(0)}k</td>
      </>
    )}
    FormComponent={ProjectForm}
    detailPath="/projects"
  />
);

// Project Detail
const ProjectDetail = () => (
  <DetailView
    endpoint="projects"
    title="Project"
    renderContent={(item) => (
      <div className="detail-container">
        <div className="detail-header">
          <div>
            <h1 className="detail-title">{item.name}</h1>
            <div className="detail-meta">
              <span className={`status-badge ${item.status}`}>{item.status?.replace('_', ' ')}</span>
              <span>Priority: {item.priority}</span>
            </div>
          </div>
        </div>
        <div className="detail-body">
          <div className="detail-section">
            <h3 className="detail-section-title">Project Details</h3>
            <div className="detail-grid">
              <div className="detail-item"><div className="detail-label">Budget</div><div className="detail-value">${(item.budget || 0).toLocaleString()}</div></div>
              <div className="detail-item"><div className="detail-label">Actual Cost</div><div className="detail-value">${(item.actual_cost || 0).toLocaleString()}</div></div>
              <div className="detail-item"><div className="detail-label">Start Date</div><div className="detail-value">{item.start_date || '-'}</div></div>
              <div className="detail-item"><div className="detail-label">End Date</div><div className="detail-value">{item.end_date || '-'}</div></div>
            </div>
          </div>
          {item.description && (
            <div className="detail-section">
              <h3 className="detail-section-title">Description</h3>
              <p>{item.description}</p>
            </div>
          )}
        </div>
      </div>
    )}
  />
);

// Generic Form for Proposals
const ProposalForm = ({ item, onSave, onCancel }) => {
  const [data, setData] = useState(item || {
    title: '', status: 'draft', executive_summary: '', scope_of_work: '', total_amount: ''
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(data); }}>
      <div className="modal-body">
        <div className="form-grid">
          <div className="form-group full-width">
            <label className="form-label">Title *</label>
            <input className="form-input" value={data.title} onChange={(e) => setData({...data, title: e.target.value})} required />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={data.status} onChange={(e) => setData({...data, status: e.target.value})}>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Total Amount</label>
            <input type="number" className="form-input" value={data.total_amount || ''} onChange={(e) => setData({...data, total_amount: e.target.value})} />
          </div>
          <div className="form-group full-width">
            <label className="form-label">Executive Summary</label>
            <textarea className="form-textarea" value={data.executive_summary || ''} onChange={(e) => setData({...data, executive_summary: e.target.value})} />
          </div>
          <div className="form-group full-width">
            <label className="form-label">Scope of Work</label>
            <textarea className="form-textarea" value={data.scope_of_work || ''} onChange={(e) => setData({...data, scope_of_work: e.target.value})} />
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save</button>
      </div>
    </form>
  );
};

// Proposal List
const ProposalList = () => (
  <GenericList
    title="Proposals"
    endpoint="proposals"
    columns={[
      { label: 'Title', field: 'title' },
      { label: 'Status', field: 'status' },
      { label: 'Amount', field: 'total_amount' },
    ]}
    renderRow={(item) => (
      <>
        <td><strong>{item.title}</strong></td>
        <td><span className={`status-badge ${item.status}`}>{item.status}</span></td>
        <td>${(item.total_amount || 0).toLocaleString()}</td>
      </>
    )}
    FormComponent={ProposalForm}
    detailPath="/proposals"
  />
);

// Proposal Detail
const ProposalDetail = () => (
  <DetailView
    endpoint="proposals"
    title="Proposal"
    renderContent={(item) => (
      <div className="detail-container">
        <div className="detail-header">
          <div>
            <h1 className="detail-title">{item.title}</h1>
            <div className="detail-meta">
              <span className={`status-badge ${item.status}`}>{item.status}</span>
              <span>${(item.total_amount || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div className="detail-body">
          {item.executive_summary && (
            <div className="detail-section">
              <h3 className="detail-section-title">Executive Summary</h3>
              <p>{item.executive_summary}</p>
            </div>
          )}
          {item.scope_of_work && (
            <div className="detail-section">
              <h3 className="detail-section-title">Scope of Work</h3>
              <p>{item.scope_of_work}</p>
            </div>
          )}
          {item.deliverables && (
            <div className="detail-section">
              <h3 className="detail-section-title">Deliverables</h3>
              <p>{item.deliverables}</p>
            </div>
          )}
          {item.timeline && (
            <div className="detail-section">
              <h3 className="detail-section-title">Timeline</h3>
              <p>{item.timeline}</p>
            </div>
          )}
        </div>
      </div>
    )}
  />
);

// SOW Form
const SOWForm = ({ item, onSave, onCancel }) => {
  const [data, setData] = useState(item || {
    title: '', status: 'draft', introduction: '', objectives: '', scope: '', total_amount: ''
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(data); }}>
      <div className="modal-body">
        <div className="form-grid">
          <div className="form-group full-width">
            <label className="form-label">Title *</label>
            <input className="form-input" value={data.title} onChange={(e) => setData({...data, title: e.target.value})} required />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={data.status} onChange={(e) => setData({...data, status: e.target.value})}>
              <option value="draft">Draft</option>
              <option value="signed">Signed</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Total Amount</label>
            <input type="number" className="form-input" value={data.total_amount || ''} onChange={(e) => setData({...data, total_amount: e.target.value})} />
          </div>
          <div className="form-group full-width">
            <label className="form-label">Introduction</label>
            <textarea className="form-textarea" value={data.introduction || ''} onChange={(e) => setData({...data, introduction: e.target.value})} />
          </div>
          <div className="form-group full-width">
            <label className="form-label">Objectives</label>
            <textarea className="form-textarea" value={data.objectives || ''} onChange={(e) => setData({...data, objectives: e.target.value})} />
          </div>
          <div className="form-group full-width">
            <label className="form-label">Scope</label>
            <textarea className="form-textarea" value={data.scope || ''} onChange={(e) => setData({...data, scope: e.target.value})} />
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save</button>
      </div>
    </form>
  );
};

// SOW List
const SOWList = () => (
  <GenericList
    title="Statements of Work"
    endpoint="sows"
    columns={[
      { label: 'Title', field: 'title' },
      { label: 'Status', field: 'status' },
      { label: 'Amount', field: 'total_amount' },
    ]}
    renderRow={(item) => (
      <>
        <td><strong>{item.title}</strong></td>
        <td><span className={`status-badge ${item.status}`}>{item.status}</span></td>
        <td>${(item.total_amount || 0).toLocaleString()}</td>
      </>
    )}
    FormComponent={SOWForm}
    detailPath="/sows"
  />
);

// SOW Detail
const SOWDetail = () => (
  <DetailView
    endpoint="sows"
    title="SOW"
    renderContent={(item) => (
      <div className="detail-container">
        <div className="detail-header">
          <div>
            <h1 className="detail-title">{item.title}</h1>
            <div className="detail-meta">
              <span className={`status-badge ${item.status}`}>{item.status}</span>
              <span>${(item.total_amount || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div className="detail-body">
          {item.introduction && (<div className="detail-section"><h3 className="detail-section-title">Introduction</h3><p>{item.introduction}</p></div>)}
          {item.objectives && (<div className="detail-section"><h3 className="detail-section-title">Objectives</h3><p>{item.objectives}</p></div>)}
          {item.scope && (<div className="detail-section"><h3 className="detail-section-title">Scope</h3><p>{item.scope}</p></div>)}
          {item.deliverables && (<div className="detail-section"><h3 className="detail-section-title">Deliverables</h3><p>{item.deliverables}</p></div>)}
          {item.milestones && (<div className="detail-section"><h3 className="detail-section-title">Milestones</h3><p>{item.milestones}</p></div>)}
        </div>
      </div>
    )}
  />
);

// Service Form
const ServiceForm = ({ item, onSave, onCancel }) => {
  const [data, setData] = useState(item || {
    name: '', description: '', category: '', base_price: '', unit: '', estimated_hours: '', status: 'active'
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(data); }}>
      <div className="modal-body">
        <div className="form-grid">
          <div className="form-group full-width">
            <label className="form-label">Name *</label>
            <input className="form-input" value={data.name} onChange={(e) => setData({...data, name: e.target.value})} required />
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <input className="form-input" value={data.category || ''} onChange={(e) => setData({...data, category: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Base Price</label>
            <input type="number" className="form-input" value={data.base_price || ''} onChange={(e) => setData({...data, base_price: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Unit</label>
            <input className="form-input" value={data.unit || ''} onChange={(e) => setData({...data, unit: e.target.value})} placeholder="e.g., project, hour, month" />
          </div>
          <div className="form-group">
            <label className="form-label">Estimated Hours</label>
            <input type="number" className="form-input" value={data.estimated_hours || ''} onChange={(e) => setData({...data, estimated_hours: e.target.value})} />
          </div>
          <div className="form-group full-width">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" value={data.description || ''} onChange={(e) => setData({...data, description: e.target.value})} />
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save</button>
      </div>
    </form>
  );
};

// Service List
const ServiceList = () => (
  <GenericList
    title="Services"
    endpoint="services"
    columns={[
      { label: 'Name', field: 'name' },
      { label: 'Category', field: 'category' },
      { label: 'Price', field: 'base_price' },
      { label: 'Unit', field: 'unit' },
    ]}
    renderRow={(item) => (
      <>
        <td><strong>{item.name}</strong></td>
        <td>{item.category}</td>
        <td>${(item.base_price || 0).toLocaleString()}</td>
        <td>{item.unit}</td>
      </>
    )}
    FormComponent={ServiceForm}
    detailPath="/services"
  />
);

// Service Detail
const ServiceDetail = () => (
  <DetailView
    endpoint="services"
    title="Service"
    renderContent={(item) => (
      <div className="detail-container">
        <div className="detail-header">
          <div>
            <h1 className="detail-title">{item.name}</h1>
            <div className="detail-meta">
              <span>{item.category}</span>
              <span>${(item.base_price || 0).toLocaleString()} / {item.unit}</span>
            </div>
          </div>
        </div>
        <div className="detail-body">
          <div className="detail-section">
            <h3 className="detail-section-title">Details</h3>
            <div className="detail-grid">
              <div className="detail-item"><div className="detail-label">Estimated Hours</div><div className="detail-value">{item.estimated_hours || '-'}</div></div>
              <div className="detail-item"><div className="detail-label">Status</div><div className="detail-value">{item.status}</div></div>
            </div>
          </div>
          {item.description && (<div className="detail-section"><h3 className="detail-section-title">Description</h3><p>{item.description}</p></div>)}
        </div>
      </div>
    )}
  />
);

// Pricing Form
const PricingForm = ({ item, onSave, onCancel }) => {
  const [data, setData] = useState(item || {
    name: '', description: '', pricing_type: 'package', base_amount: '', billing_frequency: 'one-time', status: 'active'
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(data); }}>
      <div className="modal-body">
        <div className="form-grid">
          <div className="form-group full-width">
            <label className="form-label">Name *</label>
            <input className="form-input" value={data.name} onChange={(e) => setData({...data, name: e.target.value})} required />
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-select" value={data.pricing_type} onChange={(e) => setData({...data, pricing_type: e.target.value})}>
              <option value="package">Package</option>
              <option value="hourly">Hourly</option>
              <option value="retainer">Retainer</option>
              <option value="discount">Discount</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Base Amount</label>
            <input type="number" className="form-input" value={data.base_amount || ''} onChange={(e) => setData({...data, base_amount: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Billing Frequency</label>
            <select className="form-select" value={data.billing_frequency} onChange={(e) => setData({...data, billing_frequency: e.target.value})}>
              <option value="one-time">One-time</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="hourly">Hourly</option>
            </select>
          </div>
          <div className="form-group full-width">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" value={data.description || ''} onChange={(e) => setData({...data, description: e.target.value})} />
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save</button>
      </div>
    </form>
  );
};

// Pricing List
const PricingList = () => (
  <GenericList
    title="Pricing"
    endpoint="pricing"
    columns={[
      { label: 'Name', field: 'name' },
      { label: 'Type', field: 'pricing_type' },
      { label: 'Amount', field: 'base_amount' },
      { label: 'Frequency', field: 'billing_frequency' },
    ]}
    renderRow={(item) => (
      <>
        <td><strong>{item.name}</strong></td>
        <td>{item.pricing_type}</td>
        <td>${(item.base_amount || 0).toLocaleString()}</td>
        <td>{item.billing_frequency}</td>
      </>
    )}
    FormComponent={PricingForm}
    detailPath="/pricing"
  />
);

// Pricing Detail
const PricingDetail = () => (
  <DetailView
    endpoint="pricing"
    title="Pricing"
    renderContent={(item) => (
      <div className="detail-container">
        <div className="detail-header">
          <div>
            <h1 className="detail-title">{item.name}</h1>
            <div className="detail-meta">
              <span>{item.pricing_type}</span>
              <span>${(item.base_amount || 0).toLocaleString()} / {item.billing_frequency}</span>
            </div>
          </div>
        </div>
        <div className="detail-body">
          <div className="detail-section">
            <h3 className="detail-section-title">Details</h3>
            <div className="detail-grid">
              <div className="detail-item"><div className="detail-label">Discount</div><div className="detail-value">{item.discount_percentage || 0}%</div></div>
              <div className="detail-item"><div className="detail-label">Min Commitment</div><div className="detail-value">{item.minimum_commitment || '-'}</div></div>
            </div>
          </div>
          {item.description && (<div className="detail-section"><h3 className="detail-section-title">Description</h3><p>{item.description}</p></div>)}
        </div>
      </div>
    )}
  />
);

// Template Form
const TemplateForm = ({ item, onSave, onCancel }) => {
  const [data, setData] = useState(item || {
    name: '', type: 'proposal', category: '', description: '', content: '', status: 'active'
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(data); }}>
      <div className="modal-body">
        <div className="form-grid">
          <div className="form-group full-width">
            <label className="form-label">Name *</label>
            <input className="form-input" value={data.name} onChange={(e) => setData({...data, name: e.target.value})} required />
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-select" value={data.type} onChange={(e) => setData({...data, type: e.target.value})}>
              <option value="proposal">Proposal</option>
              <option value="sow">SOW</option>
              <option value="document">Document</option>
              <option value="legal">Legal</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <input className="form-input" value={data.category || ''} onChange={(e) => setData({...data, category: e.target.value})} />
          </div>
          <div className="form-group full-width">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" value={data.description || ''} onChange={(e) => setData({...data, description: e.target.value})} />
          </div>
          <div className="form-group full-width">
            <label className="form-label">Content</label>
            <textarea className="form-textarea" style={{minHeight: 200}} value={data.content || ''} onChange={(e) => setData({...data, content: e.target.value})} />
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save</button>
      </div>
    </form>
  );
};

// Template List
const TemplateList = () => (
  <GenericList
    title="Templates"
    endpoint="templates"
    columns={[
      { label: 'Name', field: 'name' },
      { label: 'Type', field: 'type' },
      { label: 'Category', field: 'category' },
      { label: 'Usage', field: 'usage_count' },
    ]}
    renderRow={(item) => (
      <>
        <td><strong>{item.name}</strong></td>
        <td>{item.type}</td>
        <td>{item.category}</td>
        <td>{item.usage_count || 0} uses</td>
      </>
    )}
    FormComponent={TemplateForm}
    detailPath="/templates"
  />
);

// Template Detail
const TemplateDetail = () => (
  <DetailView
    endpoint="templates"
    title="Template"
    renderContent={(item) => (
      <div className="detail-container">
        <div className="detail-header">
          <div>
            <h1 className="detail-title">{item.name}</h1>
            <div className="detail-meta">
              <span>{item.type}</span>
              <span>{item.category}</span>
              <span>{item.usage_count || 0} uses</span>
            </div>
          </div>
        </div>
        <div className="detail-body">
          {item.description && (<div className="detail-section"><h3 className="detail-section-title">Description</h3><p>{item.description}</p></div>)}
          {item.content && (
            <div className="detail-section">
              <h3 className="detail-section-title">Content</h3>
              <pre style={{background: '#f8fafc', padding: 16, borderRadius: 8, overflow: 'auto', whiteSpace: 'pre-wrap'}}>{item.content}</pre>
            </div>
          )}
        </div>
      </div>
    )}
  />
);

// Team Member Form
const TeamMemberForm = ({ item, onSave, onCancel }) => {
  const [data, setData] = useState(item || {
    first_name: '', last_name: '', email: '', phone: '', role: '', department: '', hourly_rate: '', availability: 'available', bio: '', status: 'active'
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(data); }}>
      <div className="modal-body">
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">First Name *</label>
            <input className="form-input" value={data.first_name} onChange={(e) => setData({...data, first_name: e.target.value})} required />
          </div>
          <div className="form-group">
            <label className="form-label">Last Name *</label>
            <input className="form-input" value={data.last_name} onChange={(e) => setData({...data, last_name: e.target.value})} required />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-input" value={data.email || ''} onChange={(e) => setData({...data, email: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input className="form-input" value={data.phone || ''} onChange={(e) => setData({...data, phone: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Role</label>
            <input className="form-input" value={data.role || ''} onChange={(e) => setData({...data, role: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Department</label>
            <input className="form-input" value={data.department || ''} onChange={(e) => setData({...data, department: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Hourly Rate</label>
            <input type="number" className="form-input" value={data.hourly_rate || ''} onChange={(e) => setData({...data, hourly_rate: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Availability</label>
            <select className="form-select" value={data.availability} onChange={(e) => setData({...data, availability: e.target.value})}>
              <option value="available">Available</option>
              <option value="busy">Busy</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </div>
          <div className="form-group full-width">
            <label className="form-label">Bio</label>
            <textarea className="form-textarea" value={data.bio || ''} onChange={(e) => setData({...data, bio: e.target.value})} />
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save</button>
      </div>
    </form>
  );
};

// Team List
const TeamList = () => (
  <GenericList
    title="Team Members"
    endpoint="team_members"
    columns={[
      { label: 'Name', field: 'first_name' },
      { label: 'Role', field: 'role' },
      { label: 'Department', field: 'department' },
      { label: 'Rate', field: 'hourly_rate' },
    ]}
    renderRow={(item) => (
      <>
        <td><strong>{item.first_name} {item.last_name}</strong><br/><small style={{color: 'var(--text-secondary)'}}>{item.email}</small></td>
        <td>{item.role}</td>
        <td>{item.department}</td>
        <td>${item.hourly_rate}/hr</td>
      </>
    )}
    FormComponent={TeamMemberForm}
    detailPath="/team"
  />
);

// Team Detail
const TeamDetail = () => (
  <DetailView
    endpoint="team_members"
    title="Team Member"
    renderContent={(item) => (
      <div className="detail-container">
        <div className="detail-header">
          <div>
            <h1 className="detail-title">{item.first_name} {item.last_name}</h1>
            <div className="detail-meta">
              <span>{item.role}</span>
              <span>{item.department}</span>
              <span className={`status-badge ${item.availability === 'available' ? 'active' : 'inactive'}`}>{item.availability}</span>
            </div>
          </div>
        </div>
        <div className="detail-body">
          <div className="detail-section">
            <h3 className="detail-section-title">Contact Information</h3>
            <div className="detail-grid">
              <div className="detail-item"><div className="detail-label">Email</div><div className="detail-value">{item.email || '-'}</div></div>
              <div className="detail-item"><div className="detail-label">Phone</div><div className="detail-value">{item.phone || '-'}</div></div>
              <div className="detail-item"><div className="detail-label">Hourly Rate</div><div className="detail-value">${item.hourly_rate}/hr</div></div>
            </div>
          </div>
          {item.bio && (<div className="detail-section"><h3 className="detail-section-title">Bio</h3><p>{item.bio}</p></div>)}
          {item.skills && item.skills.length > 0 && (
            <div className="detail-section">
              <h3 className="detail-section-title">Skills</h3>
              <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
                {item.skills.map((skill, i) => <span key={i} className="status-badge active">{skill}</span>)}
              </div>
            </div>
          )}
        </div>
      </div>
    )}
  />
);

// Document Form
const DocumentForm = ({ item, onSave, onCancel }) => {
  const [data, setData] = useState(item || {
    name: '', type: 'pdf', category: '', description: '', file_url: '', status: 'active'
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(data); }}>
      <div className="modal-body">
        <div className="form-grid">
          <div className="form-group full-width">
            <label className="form-label">Name *</label>
            <input className="form-input" value={data.name} onChange={(e) => setData({...data, name: e.target.value})} required />
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-select" value={data.type} onChange={(e) => setData({...data, type: e.target.value})}>
              <option value="pdf">PDF</option>
              <option value="document">Document</option>
              <option value="spreadsheet">Spreadsheet</option>
              <option value="image">Image</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <input className="form-input" value={data.category || ''} onChange={(e) => setData({...data, category: e.target.value})} />
          </div>
          <div className="form-group full-width">
            <label className="form-label">File URL</label>
            <input className="form-input" value={data.file_url || ''} onChange={(e) => setData({...data, file_url: e.target.value})} />
          </div>
          <div className="form-group full-width">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" value={data.description || ''} onChange={(e) => setData({...data, description: e.target.value})} />
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save</button>
      </div>
    </form>
  );
};

// Document List
const DocumentList = () => (
  <GenericList
    title="Documents"
    endpoint="documents"
    columns={[
      { label: 'Name', field: 'name' },
      { label: 'Type', field: 'type' },
      { label: 'Category', field: 'category' },
    ]}
    renderRow={(item) => (
      <>
        <td><strong>{item.name}</strong></td>
        <td>{item.type}</td>
        <td>{item.category}</td>
      </>
    )}
    FormComponent={DocumentForm}
    detailPath="/documents"
  />
);

// Document Detail
const DocumentDetail = () => (
  <DetailView
    endpoint="documents"
    title="Document"
    renderContent={(item) => (
      <div className="detail-container">
        <div className="detail-header">
          <div>
            <h1 className="detail-title">{item.name}</h1>
            <div className="detail-meta">
              <span>{item.type}</span>
              <span>{item.category}</span>
            </div>
          </div>
        </div>
        <div className="detail-body">
          <div className="detail-section">
            <h3 className="detail-section-title">Details</h3>
            <div className="detail-grid">
              <div className="detail-item"><div className="detail-label">File URL</div><div className="detail-value">{item.file_url || '-'}</div></div>
              <div className="detail-item"><div className="detail-label">File Size</div><div className="detail-value">{item.file_size ? `${(item.file_size / 1024).toFixed(1)} KB` : '-'}</div></div>
            </div>
          </div>
          {item.description && (<div className="detail-section"><h3 className="detail-section-title">Description</h3><p>{item.description}</p></div>)}
        </div>
      </div>
    )}
  />
);

// AI Generator
const AIGenerator = () => {
  const [type, setType] = useState('proposal');
  const [prompt, setPrompt] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sampleProjects = [
    {
      name: 'E-Commerce Platform',
      description: 'Build a modern e-commerce platform for a retail company. Features include product catalog, shopping cart, secure checkout, user accounts, order tracking, inventory management, and admin dashboard. Tech stack: React, Node.js, PostgreSQL. Timeline: 4 months. Budget: $80,000.'
    },
    {
      name: 'Healthcare Mobile App',
      description: 'Develop a HIPAA-compliant mobile health application for patients to schedule appointments, view medical records, communicate with doctors via secure messaging, and manage prescriptions. iOS and Android native apps with backend API. Timeline: 6 months. Budget: $150,000.'
    },
    {
      name: 'CRM System Integration',
      description: 'Integrate Salesforce CRM with existing ERP system, marketing automation tools, and customer support platform. Include data migration, custom workflows, reporting dashboards, and staff training. Timeline: 3 months. Budget: $45,000.'
    },
    {
      name: 'AI Chatbot Solution',
      description: 'Create an AI-powered customer service chatbot for a financial services company. Features include natural language processing, integration with knowledge base, escalation to human agents, multi-language support, and analytics dashboard. Timeline: 2 months. Budget: $35,000.'
    },
    {
      name: 'Cloud Migration Project',
      description: 'Migrate on-premise infrastructure to AWS cloud. Includes assessment, architecture design, migration of 15 applications, database migration, security configuration, CI/CD pipeline setup, monitoring, and documentation. Timeline: 5 months. Budget: $120,000.'
    }
  ];

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError('');
    setOutput('');
    try {
      const res = await axios.post(`${API_URL}/ai/generate`, { type, prompt });
      setOutput(res.data.content);
    } catch (err) {
      setError(err.response?.data?.error || 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const generateProposal = async () => {
    setLoading(true);
    setError('');
    setOutput('');
    try {
      const res = await axios.post(`${API_URL}/ai/generate-proposal`, {
        projectName: prompt || 'New Software Project',
        requirements: 'Build a modern web application'
      });
      setOutput(res.data.content);
    } catch (err) {
      setError(err.response?.data?.error || 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const generateSOW = async () => {
    setLoading(true);
    setError('');
    setOutput('');
    try {
      const res = await axios.post(`${API_URL}/ai/generate-sow`, {
        projectName: prompt || 'Software Development Project',
        scope: 'Full-stack web application development',
        deliverables: 'Web application, API, Documentation',
        timeline: '6 months'
      });
      setOutput(res.data.content);
    } catch (err) {
      setError(err.response?.data?.error || 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Generator</h1>
          <p className="page-subtitle">Generate professional proposals and SOWs with AI</p>
        </div>
      </div>

      <div className="ai-generator">
        <div className="form-group">
          <label className="form-label">Generation Type</label>
          <select className="form-select" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="proposal">Proposal Content</option>
            <option value="sow">Statement of Work</option>
            <option value="email">Follow-up Email</option>
            <option value="summary">Executive Summary</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Quick Load Sample Projects</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {sampleProjects.map((project, index) => (
              <button
                key={index}
                className="btn btn-secondary btn-sm"
                onClick={() => setPrompt(project.description)}
                style={{ fontSize: 13 }}
              >
                {project.name}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Prompt / Project Description</label>
          <textarea
            className="form-textarea"
            rows={5}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want to generate... e.g., 'Generate a proposal for a mobile app development project for a healthcare client'"
          />
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button className="btn btn-primary" onClick={generate} disabled={loading || !prompt.trim()}>
            <Wand2 size={18} /> {loading ? 'Generating...' : 'Generate Custom'}
          </button>
          <button className="btn btn-secondary" onClick={generateProposal} disabled={loading}>
            <FileText size={18} /> Generate Full Proposal
          </button>
          <button className="btn btn-secondary" onClick={generateSOW} disabled={loading}>
            <FileCheck size={18} /> Generate Full SOW
          </button>
        </div>

        {error && <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>}

        {output && (
          <>
            <div className="ai-output">{output}</div>
            <div className="ai-actions">
              <button className="btn btn-secondary" onClick={() => navigator.clipboard.writeText(output)}>
                <Copy size={18} /> Copy to Clipboard
              </button>
              <button className="btn btn-secondary" onClick={() => setOutput('')}>
                <RefreshCw size={18} /> Clear
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// Analytics
const Analytics = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_URL}/analytics?limit=100`)
      .then(res => setData(res.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner"></div>Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Business performance metrics</p>
        </div>
      </div>

      <div className="stats-grid">
        {data.slice(0, 8).map((metric, i) => (
          <div key={i} className="stat-card">
            <div className="stat-value">
              {metric.metric_type === 'currency' ? `$${(metric.metric_value / 1000).toFixed(0)}k` :
               metric.metric_type === 'percentage' ? `${metric.metric_value}%` :
               metric.metric_value}
            </div>
            <div className="stat-label">{metric.metric_name.replace(/_/g, ' ')}</div>
            <div className="stat-trend positive">{metric.period}</div>
          </div>
        ))}
      </div>

      <div className="table-container">
        <div className="table-header">
          <div className="table-title">All Metrics</div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Value</th>
              <th>Type</th>
              <th>Period</th>
            </tr>
          </thead>
          <tbody>
            {data.map(m => (
              <tr key={m.id}>
                <td><strong>{m.metric_name.replace(/_/g, ' ')}</strong></td>
                <td>
                  {m.metric_type === 'currency' ? `$${m.metric_value.toLocaleString()}` :
                   m.metric_type === 'percentage' ? `${m.metric_value}%` :
                   m.metric_value}
                </td>
                <td>{m.metric_type}</td>
                <td>{m.period}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Settings Form
const SettingForm = ({ item, onSave, onCancel }) => {
  const [data, setData] = useState(item || {
    key: '', value: '', type: 'string', category: '', description: '', is_public: false
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(data); }}>
      <div className="modal-body">
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Key *</label>
            <input className="form-input" value={data.key} onChange={(e) => setData({...data, key: e.target.value})} required disabled={!!item} />
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <input className="form-input" value={data.category || ''} onChange={(e) => setData({...data, category: e.target.value})} />
          </div>
          <div className="form-group full-width">
            <label className="form-label">Value</label>
            <input className="form-input" value={data.value || ''} onChange={(e) => setData({...data, value: e.target.value})} />
          </div>
          <div className="form-group full-width">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" value={data.description || ''} onChange={(e) => setData({...data, description: e.target.value})} />
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">Save</button>
      </div>
    </form>
  );
};

// Professional AI Output Display Component
const AIOutputDisplay = ({ data, title }) => {
  if (!data) return null;

  const renderValue = (value, key) => {
    if (value === null || value === undefined) return <span className="text-muted">-</span>;
    if (typeof value === 'boolean') return value ? <CheckCircle size={16} className="text-success" /> : <XCircle size={16} className="text-danger" />;
    if (Array.isArray(value)) {
      return (
        <div className="ai-tags">
          {value.map((item, i) => (
            <span key={i} className="ai-tag">{typeof item === 'object' ? JSON.stringify(item) : item}</span>
          ))}
        </div>
      );
    }
    if (typeof value === 'object') {
      return (
        <div className="ai-nested">
          {Object.entries(value).map(([k, v]) => (
            <div key={k} className="ai-nested-item">
              <span className="ai-nested-key">{k.replace(/_/g, ' ')}:</span>
              {renderValue(v, k)}
            </div>
          ))}
        </div>
      );
    }
    return <span>{String(value)}</span>;
  };

  return (
    <div className="ai-output-professional">
      {title && <h3 className="ai-output-title">{title}</h3>}
      <div className="ai-output-grid">
        {Object.entries(data).filter(([key]) => !['id', 'created_at', 'updated_at', 'created_by', 'ai_response', 'ai_analysis', 'ai_assessment', 'ai_timeline'].includes(key)).map(([key, value]) => (
          <div key={key} className="ai-output-item">
            <div className="ai-output-label">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
            <div className="ai-output-value">{renderValue(value, key)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// AI Pricing Suggester Page
const AIPricingSuggester = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    projectName: '', projectType: 'Web Application', complexity: 'medium',
    durationWeeks: 12, teamSize: 3, requirements: '', clientId: '', projectId: ''
  });
  const navigate = useNavigate();
  const toast = useToast();
  const confirmDialog = useConfirm();

  const fetchItems = () => {
    setLoading(true);
    axios.get(`${API_URL}/pricing_suggestions?limit=100`)
      .then(res => setItems(res.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchItems(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await axios.post(`${API_URL}/ai/suggest-pricing`, form);
      setItems([res.data.suggestion, ...items]);
      setSelectedItem(res.data.suggestion);
      setShowModal(false);
      toast.success('Pricing suggestion generated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    const ok = await confirmDialog('Delete this pricing suggestion?', { title: 'Delete', variant: 'danger' });
    if (!ok) return;
    try {
      await axios.delete(`${API_URL}/pricing_suggestions/${id}`);
      fetchItems();
      if (selectedItem?.id === id) setSelectedItem(null);
      toast.success('Deleted');
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const filtered = items.filter(item =>
    JSON.stringify(item).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Pricing Suggester</h1>
          <p className="page-subtitle">AI-powered pricing recommendations for your projects</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Generate New Pricing
        </button>
      </div>

      <div className="ai-layout">
        <div className="ai-list-panel">
          <div className="table-container">
            <div className="table-header">
              <div className="table-title">Pricing Suggestions ({filtered.length})</div>
              <input type="text" className="search-input" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {loading ? (
              <div className="loading"><div className="spinner"></div>Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="empty-state"><DollarSign size={48} /><h3>No pricing suggestions yet</h3><p>Generate your first AI pricing recommendation</p></div>
            ) : (
              <div className="ai-item-list">
                {filtered.map(item => (
                  <div key={item.id} className={`ai-item ${selectedItem?.id === item.id ? 'selected' : ''}`} onClick={() => setSelectedItem(item)}>
                    <div className="ai-item-header">
                      <strong>{item.project_name}</strong>
                      <button className="btn btn-ghost btn-sm" onClick={(e) => handleDelete(item.id, e)}><Trash2 size={14} /></button>
                    </div>
                    <div className="ai-item-meta">
                      <span className="status-badge active">{item.pricing_strategy}</span>
                      <span>${Number(item.suggested_min_price || 0).toLocaleString()} - ${Number(item.suggested_max_price || 0).toLocaleString()}</span>
                    </div>
                    <div className="ai-item-meta">
                      <span>{item.project_type}</span>
                      <span>Confidence: {item.confidence_score}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="ai-detail-panel">
          {selectedItem ? (
            <div className="detail-container">
              <div className="detail-header">
                <div>
                  <h1 className="detail-title">{selectedItem.project_name}</h1>
                  <div className="detail-meta">
                    <span className="status-badge active">{selectedItem.pricing_strategy}</span>
                    <span>{selectedItem.project_type}</span>
                  </div>
                </div>
              </div>
              <div className="detail-body">
                <div className="ai-highlight-cards">
                  <div className="ai-highlight-card green">
                    <div className="ai-highlight-label">Suggested Range</div>
                    <div className="ai-highlight-value">${Number(selectedItem.suggested_min_price || 0).toLocaleString()} - ${Number(selectedItem.suggested_max_price || 0).toLocaleString()}</div>
                  </div>
                  <div className="ai-highlight-card blue">
                    <div className="ai-highlight-label">Hourly Rate</div>
                    <div className="ai-highlight-value">${selectedItem.suggested_hourly_rate}/hr</div>
                  </div>
                  <div className="ai-highlight-card purple">
                    <div className="ai-highlight-label">Confidence</div>
                    <div className="ai-highlight-value">{selectedItem.confidence_score}%</div>
                  </div>
                </div>
                <div className="detail-section">
                  <h3 className="detail-section-title">Project Details</h3>
                  <div className="detail-grid">
                    <div className="detail-item"><div className="detail-label">Complexity</div><div className="detail-value">{selectedItem.complexity}</div></div>
                    <div className="detail-item"><div className="detail-label">Duration</div><div className="detail-value">{selectedItem.duration_weeks} weeks</div></div>
                    <div className="detail-item"><div className="detail-label">Team Size</div><div className="detail-value">{selectedItem.team_size} people</div></div>
                    <div className="detail-item"><div className="detail-label">Strategy</div><div className="detail-value">{selectedItem.pricing_strategy}</div></div>
                  </div>
                </div>
                {selectedItem.rationale && (
                  <div className="detail-section">
                    <h3 className="detail-section-title">Rationale</h3>
                    <MarkdownText content={selectedItem.rationale} />
                  </div>
                )}
                {selectedItem.market_comparison && (
                  <div className="detail-section">
                    <h3 className="detail-section-title">Market Comparison</h3>
                    <MarkdownText content={selectedItem.market_comparison} />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="empty-state"><DollarSign size={64} /><h3>Select a pricing suggestion</h3><p>Click on an item to view details</p></div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Generate AI Pricing Suggestion</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="example-buttons">
                <span className="example-label">Try Example:</span>
                <button className="btn btn-outline btn-sm" onClick={() => setForm({ projectName: 'E-Commerce Platform Redesign', projectType: 'Web Application', complexity: 'high', durationWeeks: 16, teamSize: 5, requirements: 'Full redesign of existing e-commerce platform with new payment gateway integration, inventory management, customer analytics dashboard, mobile-responsive design, and migration of 50K+ product catalog', clientId: '', projectId: '' })}>E-Commerce</button>
                <button className="btn btn-outline btn-sm" onClick={() => setForm({ projectName: 'Healthcare Patient Portal', projectType: 'Web Application', complexity: 'high', durationWeeks: 24, teamSize: 6, requirements: 'HIPAA-compliant patient portal with appointment scheduling, telemedicine integration, EHR data sync, prescription management, and secure messaging between patients and providers', clientId: '', projectId: '' })}>Healthcare</button>
                <button className="btn btn-outline btn-sm" onClick={() => setForm({ projectName: 'Mobile Banking App', projectType: 'Mobile Application', complexity: 'high', durationWeeks: 20, teamSize: 7, requirements: 'iOS and Android banking app with biometric auth, real-time transaction tracking, bill pay, P2P transfers, spending analytics, and PCI-DSS compliance', clientId: '', projectId: '' })}>FinTech</button>
                <button className="btn btn-outline btn-sm" onClick={() => setForm({ projectName: 'CRM Data Migration', projectType: 'System Integration', complexity: 'medium', durationWeeks: 8, teamSize: 3, requirements: 'Migrate 200K customer records from legacy CRM to Salesforce, including data cleansing, field mapping, workflow automation setup, and user training', clientId: '', projectId: '' })}>CRM Migration</button>
              </div>
              <div className="form-grid">
                <div className="form-group full-width">
                  <label className="form-label">Project Name *</label>
                  <input className="form-input" value={form.projectName} onChange={(e) => setForm({...form, projectName: e.target.value})} placeholder="e.g., E-Commerce Platform" />
                </div>
                <div className="form-group">
                  <label className="form-label">Project Type</label>
                  <select className="form-select" value={form.projectType} onChange={(e) => setForm({...form, projectType: e.target.value})}>
                    <option>Web Application</option>
                    <option>Mobile Application</option>
                    <option>System Integration</option>
                    <option>Cloud Infrastructure</option>
                    <option>Data Analytics</option>
                    <option>Security Assessment</option>
                    <option>Consulting</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Complexity</label>
                  <select className="form-select" value={form.complexity} onChange={(e) => setForm({...form, complexity: e.target.value})}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Duration (weeks)</label>
                  <input type="number" className="form-input" value={form.durationWeeks} onChange={(e) => setForm({...form, durationWeeks: parseInt(e.target.value) || 0})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Team Size</label>
                  <input type="number" className="form-input" value={form.teamSize} onChange={(e) => setForm({...form, teamSize: parseInt(e.target.value) || 0})} />
                </div>
                <div className="form-group full-width">
                  <label className="form-label">Requirements</label>
                  <textarea className="form-textarea" value={form.requirements} onChange={(e) => setForm({...form, requirements: e.target.value})} placeholder="Describe key requirements..." />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleGenerate} disabled={generating || !form.projectName}>
                {generating ? <><Loader size={16} className="spinning" /> Generating...</> : <><Wand2 size={16} /> Generate Pricing</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// AI Win/Loss Analyzer Page
const AIWinLossAnalyzer = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    proposalTitle: '', outcome: 'won', proposalValue: '', competitorName: '', clientFeedback: ''
  });
  const toast = useToast();
  const confirmDialog = useConfirm();

  const fetchItems = () => {
    setLoading(true);
    axios.get(`${API_URL}/win_loss_analyses?limit=100`)
      .then(res => setItems(res.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchItems(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await axios.post(`${API_URL}/ai/analyze-win-loss`, form);
      setItems([res.data.analysis, ...items]);
      setSelectedItem(res.data.analysis);
      setShowModal(false);
      toast.success('Analysis generated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Analysis failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    const ok = await confirmDialog('Delete this analysis?', { title: 'Delete', variant: 'danger' });
    if (!ok) return;
    try {
      await axios.delete(`${API_URL}/win_loss_analyses/${id}`);
      fetchItems();
      if (selectedItem?.id === id) setSelectedItem(null);
      toast.success('Deleted');
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const filtered = items.filter(item => JSON.stringify(item).toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Win/Loss Analyzer</h1>
          <p className="page-subtitle">Analyze proposal outcomes and learn from wins and losses</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> New Analysis
        </button>
      </div>

      <div className="ai-layout">
        <div className="ai-list-panel">
          <div className="table-container">
            <div className="table-header">
              <div className="table-title">Analyses ({filtered.length})</div>
              <input type="text" className="search-input" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {loading ? (
              <div className="loading"><div className="spinner"></div>Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="empty-state"><TrendingUp size={48} /><h3>No analyses yet</h3><p>Create your first win/loss analysis</p></div>
            ) : (
              <div className="ai-item-list">
                {filtered.map(item => (
                  <div key={item.id} className={`ai-item ${selectedItem?.id === item.id ? 'selected' : ''}`} onClick={() => setSelectedItem(item)}>
                    <div className="ai-item-header">
                      <strong>{item.proposal_title}</strong>
                      <button className="btn btn-ghost btn-sm" onClick={(e) => handleDelete(item.id, e)}><Trash2 size={14} /></button>
                    </div>
                    <div className="ai-item-meta">
                      <span className={`status-badge ${item.outcome === 'won' ? 'active' : item.outcome === 'lost' ? 'inactive' : 'pending'}`}>
                        {item.outcome === 'won' ? <><Award size={12} /> Won</> : item.outcome === 'lost' ? <><XCircle size={12} /> Lost</> : <><Clock size={12} /> Pending</>}
                      </span>
                      <span>${Number(item.proposal_value || 0).toLocaleString()}</span>
                    </div>
                    {item.competitor_name && <div className="ai-item-meta"><span>vs {item.competitor_name}</span></div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="ai-detail-panel">
          {selectedItem ? (
            <div className="detail-container">
              <div className="detail-header">
                <div>
                  <h1 className="detail-title">{selectedItem.proposal_title}</h1>
                  <div className="detail-meta">
                    <span className={`status-badge ${selectedItem.outcome === 'won' ? 'active' : selectedItem.outcome === 'lost' ? 'inactive' : 'pending'}`}>
                      {selectedItem.outcome === 'won' ? <><Award size={12} /> Won</> : selectedItem.outcome === 'lost' ? <><XCircle size={12} /> Lost</> : <><Clock size={12} /> Pending</>}
                    </span>
                    <span>${Number(selectedItem.proposal_value || 0).toLocaleString()}</span>
                    {selectedItem.competitor_name && <span>vs {selectedItem.competitor_name}</span>}
                  </div>
                </div>
              </div>
              <div className="detail-body">
                {selectedItem.key_factors && selectedItem.key_factors.length > 0 && (
                  <div className="detail-section">
                    <h3 className="detail-section-title">Key Factors</h3>
                    <div className="ai-tags">{selectedItem.key_factors.map((f, i) => <span key={i} className="ai-tag">{f}</span>)}</div>
                  </div>
                )}
                {selectedItem.strengths && (
                  <div className="detail-section">
                    <h3 className="detail-section-title"><CheckCircle size={16} className="text-success" /> Strengths</h3>
                    <MarkdownText content={selectedItem.strengths} />
                  </div>
                )}
                {selectedItem.weaknesses && (
                  <div className="detail-section">
                    <h3 className="detail-section-title"><AlertTriangle size={16} className="text-warning" /> Weaknesses</h3>
                    <MarkdownText content={selectedItem.weaknesses} />
                  </div>
                )}
                {selectedItem.lessons_learned && (
                  <div className="detail-section">
                    <h3 className="detail-section-title">Lessons Learned</h3>
                    <MarkdownText content={selectedItem.lessons_learned} />
                  </div>
                )}
                {selectedItem.recommendations && (
                  <div className="detail-section">
                    <h3 className="detail-section-title">Recommendations</h3>
                    <MarkdownText content={selectedItem.recommendations} />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="empty-state"><TrendingUp size={64} /><h3>Select an analysis</h3><p>Click on an item to view details</p></div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Analyze Win/Loss</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="example-buttons">
                <span className="example-label">Try Example:</span>
                <button className="btn btn-outline btn-sm" onClick={() => setForm({ proposalTitle: 'Enterprise Cloud Migration for GlobalBank', outcome: 'won', proposalValue: 450000, competitorName: 'Accenture', clientFeedback: 'Strong technical team, competitive pricing, and clear migration roadmap gave us confidence. Response time during Q&A was impressive.' })}>Won - Cloud</button>
                <button className="btn btn-outline btn-sm" onClick={() => setForm({ proposalTitle: 'AI-Powered Customer Service Platform', outcome: 'lost', proposalValue: 280000, competitorName: 'Deloitte Digital', clientFeedback: 'Your proposal was technically strong but lacked industry-specific case studies. Competitor had more healthcare experience and a lower price point.' })}>Lost - AI Platform</button>
                <button className="btn btn-outline btn-sm" onClick={() => setForm({ proposalTitle: 'Supply Chain Analytics Dashboard', outcome: 'won', proposalValue: 175000, competitorName: 'Cognizant', clientFeedback: 'Loved the prototype demo during the pitch. Your agile approach and willingness to start with a pilot phase reduced our perceived risk.' })}>Won - Analytics</button>
                <button className="btn btn-outline btn-sm" onClick={() => setForm({ proposalTitle: 'Legacy ERP Modernization', outcome: 'lost', proposalValue: 850000, competitorName: 'IBM Consulting', clientFeedback: 'Timeline was too aggressive for a system this critical. We needed a partner with SAP S/4HANA migration certifications.' })}>Lost - ERP</button>
              </div>
              <div className="form-grid">
                <div className="form-group full-width">
                  <label className="form-label">Proposal Title *</label>
                  <input className="form-input" value={form.proposalTitle} onChange={(e) => setForm({...form, proposalTitle: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Outcome</label>
                  <select className="form-select" value={form.outcome} onChange={(e) => setForm({...form, outcome: e.target.value})}>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Proposal Value ($)</label>
                  <input type="number" className="form-input" value={form.proposalValue} onChange={(e) => setForm({...form, proposalValue: e.target.value})} />
                </div>
                <div className="form-group full-width">
                  <label className="form-label">Competitor Name</label>
                  <input className="form-input" value={form.competitorName} onChange={(e) => setForm({...form, competitorName: e.target.value})} />
                </div>
                <div className="form-group full-width">
                  <label className="form-label">Client Feedback</label>
                  <textarea className="form-textarea" value={form.clientFeedback} onChange={(e) => setForm({...form, clientFeedback: e.target.value})} placeholder="Any feedback from the client..." />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleGenerate} disabled={generating || !form.proposalTitle}>
                {generating ? <><Loader size={16} className="spinning" /> Analyzing...</> : <><Wand2 size={16} /> Analyze</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// AI Competitor Differentiator Page
const AICompetitorDifferentiator = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ competitorName: '', industry: '', ourServices: '' });
  const toast = useToast();
  const confirmDialog = useConfirm();

  const fetchItems = () => {
    setLoading(true);
    axios.get(`${API_URL}/competitor_differentiators?limit=100`)
      .then(res => setItems(res.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchItems(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await axios.post(`${API_URL}/ai/differentiate-competitor`, form);
      setItems([res.data.differentiator, ...items]);
      setSelectedItem(res.data.differentiator);
      setShowModal(false);
      toast.success('Competitor analysis generated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Analysis failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    const ok = await confirmDialog('Delete this analysis?', { title: 'Delete', variant: 'danger' });
    if (!ok) return;
    try {
      await axios.delete(`${API_URL}/competitor_differentiators/${id}`);
      fetchItems();
      if (selectedItem?.id === id) setSelectedItem(null);
      toast.success('Deleted');
    } catch (err) { toast.error('Failed to delete'); }
  };

  const filtered = items.filter(item => JSON.stringify(item).toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Competitor Differentiator</h1>
          <p className="page-subtitle">Generate competitive positioning and win strategies</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={18} /> New Analysis</button>
      </div>

      <div className="ai-layout">
        <div className="ai-list-panel">
          <div className="table-container">
            <div className="table-header">
              <div className="table-title">Competitor Analyses ({filtered.length})</div>
              <input type="text" className="search-input" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {loading ? (
              <div className="loading"><div className="spinner"></div>Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="empty-state"><Target size={48} /><h3>No analyses yet</h3><p>Analyze your first competitor</p></div>
            ) : (
              <div className="ai-item-list">
                {filtered.map(item => (
                  <div key={item.id} className={`ai-item ${selectedItem?.id === item.id ? 'selected' : ''}`} onClick={() => setSelectedItem(item)}>
                    <div className="ai-item-header">
                      <strong>{item.competitor_name}</strong>
                      <button className="btn btn-ghost btn-sm" onClick={(e) => handleDelete(item.id, e)}><Trash2 size={14} /></button>
                    </div>
                    <div className="ai-item-meta"><span>{item.industry}</span></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="ai-detail-panel">
          {selectedItem ? (
            <div className="detail-container">
              <div className="detail-header">
                <div>
                  <h1 className="detail-title">vs {selectedItem.competitor_name}</h1>
                  <div className="detail-meta"><span>{selectedItem.industry}</span></div>
                </div>
              </div>
              <div className="detail-body">
                <div className="detail-section">
                  <h3 className="detail-section-title"><CheckCircle size={16} className="text-success" /> Our Strengths</h3>
                  <MarkdownText content={selectedItem.our_strengths} />
                </div>
                <div className="detail-section">
                  <h3 className="detail-section-title"><Target size={16} /> Competitor Strengths</h3>
                  <MarkdownText content={selectedItem.competitor_strengths} />
                </div>
                <div className="detail-section">
                  <h3 className="detail-section-title"><AlertTriangle size={16} className="text-warning" /> Our Weaknesses</h3>
                  <MarkdownText content={selectedItem.our_weaknesses} />
                </div>
                <div className="detail-section">
                  <h3 className="detail-section-title">Competitor Weaknesses</h3>
                  <MarkdownText content={selectedItem.competitor_weaknesses} />
                </div>
                <div className="detail-section">
                  <h3 className="detail-section-title"><Award size={16} className="text-primary" /> Key Differentiators</h3>
                  <MarkdownText content={selectedItem.key_differentiators} />
                </div>
                <div className="detail-section">
                  <h3 className="detail-section-title">Positioning Strategy</h3>
                  <MarkdownText content={selectedItem.positioning_strategy} />
                </div>
                <div className="detail-section">
                  <h3 className="detail-section-title">Talking Points</h3>
                  <MarkdownText content={selectedItem.talking_points} />
                </div>
                <div className="detail-section">
                  <h3 className="detail-section-title">Win Themes</h3>
                  <MarkdownText content={selectedItem.win_themes} />
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state"><Target size={64} /><h3>Select an analysis</h3><p>Click on an item to view details</p></div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Analyze Competitor</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="example-buttons">
                <span className="example-label">Try Example:</span>
                <button className="btn btn-outline btn-sm" onClick={() => setForm({ competitorName: 'Accenture', industry: 'Enterprise Technology Consulting', ourServices: 'Custom software development, cloud architecture, AI/ML solutions, and digital transformation for mid-market and enterprise clients' })}>vs Accenture</button>
                <button className="btn btn-outline btn-sm" onClick={() => setForm({ competitorName: 'Deloitte Digital', industry: 'Digital Transformation & Strategy', ourServices: 'Full-stack development, UX/UI design, data engineering, DevOps, and managed services for healthcare and financial services' })}>vs Deloitte</button>
                <button className="btn btn-outline btn-sm" onClick={() => setForm({ competitorName: 'Cognizant', industry: 'IT Services & Outsourcing', ourServices: 'Agile development teams, product engineering, quality assurance, cloud migration, and cybersecurity consulting' })}>vs Cognizant</button>
                <button className="btn btn-outline btn-sm" onClick={() => setForm({ competitorName: 'Local Boutique Agency', industry: 'Web & Mobile Development', ourServices: 'Enterprise-grade solutions, scalable architecture, dedicated project management, 24/7 support SLA, and security-first development practices' })}>vs Boutique</button>
              </div>
              <div className="form-grid">
                <div className="form-group full-width">
                  <label className="form-label">Competitor Name *</label>
                  <input className="form-input" value={form.competitorName} onChange={(e) => setForm({...form, competitorName: e.target.value})} placeholder="e.g., Accenture, Deloitte" />
                </div>
                <div className="form-group full-width">
                  <label className="form-label">Industry</label>
                  <input className="form-input" value={form.industry} onChange={(e) => setForm({...form, industry: e.target.value})} placeholder="e.g., Technology Consulting" />
                </div>
                <div className="form-group full-width">
                  <label className="form-label">Our Services (optional)</label>
                  <textarea className="form-textarea" value={form.ourServices} onChange={(e) => setForm({...form, ourServices: e.target.value})} placeholder="Describe your services..." />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleGenerate} disabled={generating || !form.competitorName}>
                {generating ? <><Loader size={16} className="spinning" /> Analyzing...</> : <><Wand2 size={16} /> Analyze</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// AI Timeline Generator Page
const AITimelineGenerator = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    projectName: '', projectType: 'Web Application', startDate: new Date().toISOString().split('T')[0],
    durationWeeks: 12, teamSize: 3, requirements: ''
  });
  const toast = useToast();
  const confirmDialog = useConfirm();

  const fetchItems = () => {
    setLoading(true);
    axios.get(`${API_URL}/timeline_generations?limit=100`)
      .then(res => setItems(res.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchItems(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await axios.post(`${API_URL}/ai/generate-timeline`, form);
      setItems([res.data.timeline, ...items]);
      setSelectedItem(res.data.timeline);
      setShowModal(false);
      toast.success('Timeline generated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    const ok = await confirmDialog('Delete this timeline?', { title: 'Delete', variant: 'danger' });
    if (!ok) return;
    try {
      await axios.delete(`${API_URL}/timeline_generations/${id}`);
      fetchItems();
      if (selectedItem?.id === id) setSelectedItem(null);
      toast.success('Deleted');
    } catch (err) { toast.error('Failed to delete'); }
  };

  const parsePhases = (phasesData) => {
    try {
      if (typeof phasesData === 'string') phasesData = JSON.parse(phasesData);
      return phasesData?.phases || [];
    } catch { return []; }
  };

  const parseMilestones = (milestonesData) => {
    try {
      if (typeof milestonesData === 'string') milestonesData = JSON.parse(milestonesData);
      return milestonesData?.milestones || [];
    } catch { return []; }
  };

  const filtered = items.filter(item => JSON.stringify(item).toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Timeline Generator</h1>
          <p className="page-subtitle">Create detailed project timelines with AI</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={18} /> Generate Timeline</button>
      </div>

      <div className="ai-layout">
        <div className="ai-list-panel">
          <div className="table-container">
            <div className="table-header">
              <div className="table-title">Timelines ({filtered.length})</div>
              <input type="text" className="search-input" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {loading ? (
              <div className="loading"><div className="spinner"></div>Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="empty-state"><Clock size={48} /><h3>No timelines yet</h3><p>Generate your first project timeline</p></div>
            ) : (
              <div className="ai-item-list">
                {filtered.map(item => (
                  <div key={item.id} className={`ai-item ${selectedItem?.id === item.id ? 'selected' : ''}`} onClick={() => setSelectedItem(item)}>
                    <div className="ai-item-header">
                      <strong>{item.project_name}</strong>
                      <button className="btn btn-ghost btn-sm" onClick={(e) => handleDelete(item.id, e)}><Trash2 size={14} /></button>
                    </div>
                    <div className="ai-item-meta">
                      <span>{item.project_type}</span>
                      <span>{item.total_weeks} weeks</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="ai-detail-panel">
          {selectedItem ? (
            <div className="detail-container">
              <div className="detail-header">
                <div>
                  <h1 className="detail-title">{selectedItem.project_name}</h1>
                  <div className="detail-meta">
                    <span>{selectedItem.project_type}</span>
                    <span>{selectedItem.total_weeks} weeks</span>
                    <span>{selectedItem.start_date} to {selectedItem.end_date}</span>
                  </div>
                </div>
              </div>
              <div className="detail-body">
                {parsePhases(selectedItem.phases).length > 0 && (
                  <div className="detail-section">
                    <h3 className="detail-section-title">Project Phases</h3>
                    <div className="timeline-phases">
                      {parsePhases(selectedItem.phases).map((phase, i) => (
                        <div key={i} className="timeline-phase">
                          <div className="timeline-phase-name">{phase.name}</div>
                          <div className="timeline-phase-weeks">{phase.weeks} weeks</div>
                          <div className="timeline-phase-bar" style={{width: `${(phase.weeks / selectedItem.total_weeks) * 100}%`}}></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {parseMilestones(selectedItem.milestones).length > 0 && (
                  <div className="detail-section">
                    <h3 className="detail-section-title">Milestones</h3>
                    <div className="milestones-list">
                      {parseMilestones(selectedItem.milestones).map((m, i) => (
                        <div key={i} className="milestone-item">
                          <CheckCircle size={16} className="text-success" />
                          <span className="milestone-name">{m.name}</span>
                          <span className="milestone-week">Week {m.week}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {selectedItem.dependencies && <div className="detail-section"><h3 className="detail-section-title">Dependencies</h3><MarkdownText content={selectedItem.dependencies} /></div>}
                {selectedItem.resource_allocation && <div className="detail-section"><h3 className="detail-section-title">Resource Allocation</h3><MarkdownText content={selectedItem.resource_allocation} /></div>}
                {selectedItem.critical_path && <div className="detail-section"><h3 className="detail-section-title">Critical Path</h3><MarkdownText content={selectedItem.critical_path} /></div>}
                {selectedItem.buffer_time && <div className="detail-section"><h3 className="detail-section-title">Buffer Time</h3><MarkdownText content={selectedItem.buffer_time} /></div>}
              </div>
            </div>
          ) : (
            <div className="empty-state"><Clock size={64} /><h3>Select a timeline</h3><p>Click on an item to view details</p></div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Generate Project Timeline</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="example-buttons">
                <span className="example-label">Try Example:</span>
                <button className="btn btn-outline btn-sm" onClick={() => setForm({ projectName: 'E-Commerce Platform MVP', projectType: 'Web Application', startDate: new Date().toISOString().split('T')[0], durationWeeks: 16, teamSize: 5, requirements: 'Build MVP e-commerce platform with product catalog, shopping cart, Stripe payment integration, order management, admin dashboard, and responsive design. Must support 10K concurrent users.' })}>E-Commerce MVP</button>
                <button className="btn btn-outline btn-sm" onClick={() => setForm({ projectName: 'iOS/Android Fitness App', projectType: 'Mobile Application', startDate: new Date().toISOString().split('T')[0], durationWeeks: 20, teamSize: 6, requirements: 'Cross-platform fitness app with workout tracking, meal planning, social features, wearable device integration (Apple Watch, Fitbit), push notifications, and in-app subscription payments.' })}>Fitness App</button>
                <button className="btn btn-outline btn-sm" onClick={() => setForm({ projectName: 'AWS Cloud Migration', projectType: 'Cloud Migration', startDate: new Date().toISOString().split('T')[0], durationWeeks: 12, teamSize: 4, requirements: 'Migrate 15 microservices from on-premise to AWS. Includes containerization with ECS, RDS database migration, CI/CD pipeline setup, monitoring with CloudWatch, and zero-downtime cutover.' })}>Cloud Migration</button>
                <button className="btn btn-outline btn-sm" onClick={() => setForm({ projectName: 'Data Warehouse & BI Platform', projectType: 'Data Analytics', startDate: new Date().toISOString().split('T')[0], durationWeeks: 14, teamSize: 4, requirements: 'Design and build a Snowflake data warehouse with ETL pipelines from 8 data sources, Tableau dashboards for executive reporting, data quality framework, and self-service analytics portal.' })}>Data Warehouse</button>
              </div>
              <div className="form-grid">
                <div className="form-group full-width">
                  <label className="form-label">Project Name *</label>
                  <input className="form-input" value={form.projectName} onChange={(e) => setForm({...form, projectName: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Project Type</label>
                  <select className="form-select" value={form.projectType} onChange={(e) => setForm({...form, projectType: e.target.value})}>
                    <option>Web Application</option>
                    <option>Mobile Application</option>
                    <option>System Integration</option>
                    <option>Cloud Migration</option>
                    <option>Data Analytics</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input type="date" className="form-input" value={form.startDate} onChange={(e) => setForm({...form, startDate: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Duration (weeks)</label>
                  <input type="number" className="form-input" value={form.durationWeeks} onChange={(e) => setForm({...form, durationWeeks: parseInt(e.target.value) || 0})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Team Size</label>
                  <input type="number" className="form-input" value={form.teamSize} onChange={(e) => setForm({...form, teamSize: parseInt(e.target.value) || 0})} />
                </div>
                <div className="form-group full-width">
                  <label className="form-label">Requirements</label>
                  <textarea className="form-textarea" value={form.requirements} onChange={(e) => setForm({...form, requirements: e.target.value})} placeholder="Key project requirements..." />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleGenerate} disabled={generating || !form.projectName}>
                {generating ? <><Loader size={16} className="spinning" /> Generating...</> : <><Wand2 size={16} /> Generate</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// AI Risk Assessment Page
const AIRiskAssessment = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    projectName: '', projectType: 'Web Application', riskCategory: 'Technical', projectDescription: ''
  });
  const toast = useToast();
  const confirmDialog = useConfirm();

  const fetchItems = () => {
    setLoading(true);
    axios.get(`${API_URL}/risk_sections?limit=100`)
      .then(res => setItems(res.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchItems(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await axios.post(`${API_URL}/ai/generate-risk-section`, form);
      setItems([res.data.riskSection, ...items]);
      setSelectedItem(res.data.riskSection);
      setShowModal(false);
      toast.success('Risk assessment generated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    const ok = await confirmDialog('Delete this risk assessment?', { title: 'Delete', variant: 'danger' });
    if (!ok) return;
    try {
      await axios.delete(`${API_URL}/risk_sections/${id}`);
      fetchItems();
      if (selectedItem?.id === id) setSelectedItem(null);
      toast.success('Deleted');
    } catch (err) { toast.error('Failed to delete'); }
  };

  const parseRisks = (risksData) => {
    try {
      if (typeof risksData === 'string') risksData = JSON.parse(risksData);
      return risksData?.risks || [];
    } catch { return []; }
  };

  const getRiskColor = (score) => {
    if (score >= 15) return 'danger';
    if (score >= 9) return 'warning';
    return 'success';
  };

  const filtered = items.filter(item => JSON.stringify(item).toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Risk Assessment</h1>
          <p className="page-subtitle">Generate comprehensive risk analyses for proposals</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={18} /> New Assessment</button>
      </div>

      <div className="ai-layout">
        <div className="ai-list-panel">
          <div className="table-container">
            <div className="table-header">
              <div className="table-title">Risk Assessments ({filtered.length})</div>
              <input type="text" className="search-input" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {loading ? (
              <div className="loading"><div className="spinner"></div>Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="empty-state"><AlertTriangle size={48} /><h3>No assessments yet</h3><p>Generate your first risk assessment</p></div>
            ) : (
              <div className="ai-item-list">
                {filtered.map(item => (
                  <div key={item.id} className={`ai-item ${selectedItem?.id === item.id ? 'selected' : ''}`} onClick={() => setSelectedItem(item)}>
                    <div className="ai-item-header">
                      <strong>{item.project_name}</strong>
                      <button className="btn btn-ghost btn-sm" onClick={(e) => handleDelete(item.id, e)}><Trash2 size={14} /></button>
                    </div>
                    <div className="ai-item-meta">
                      <span className="status-badge pending">{item.risk_category}</span>
                      <span>{item.project_type}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="ai-detail-panel">
          {selectedItem ? (
            <div className="detail-container">
              <div className="detail-header">
                <div>
                  <h1 className="detail-title">{selectedItem.project_name}</h1>
                  <div className="detail-meta">
                    <span className="status-badge pending">{selectedItem.risk_category}</span>
                    <span>{selectedItem.project_type}</span>
                  </div>
                </div>
              </div>
              <div className="detail-body">
                {parseRisks(selectedItem.identified_risks).length > 0 && (
                  <div className="detail-section">
                    <h3 className="detail-section-title">Identified Risks</h3>
                    <div className="risks-grid">
                      {parseRisks(selectedItem.identified_risks).map((risk, i) => (
                        <div key={i} className={`risk-card risk-${getRiskColor(risk.score)}`}>
                          <div className="risk-name">{risk.name}</div>
                          <div className="risk-meta">
                            <span>P: {risk.probability}</span>
                            <span>I: {risk.impact}</span>
                            <span className="risk-score">Score: {risk.score}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {selectedItem.risk_matrix && <div className="detail-section"><h3 className="detail-section-title">Risk Matrix</h3><MarkdownText content={selectedItem.risk_matrix} /></div>}
                {selectedItem.mitigation_strategies && <div className="detail-section"><h3 className="detail-section-title">Mitigation Strategies</h3><MarkdownText content={selectedItem.mitigation_strategies} /></div>}
                {selectedItem.contingency_plans && <div className="detail-section"><h3 className="detail-section-title">Contingency Plans</h3><MarkdownText content={selectedItem.contingency_plans} /></div>}
                {selectedItem.risk_owners && <div className="detail-section"><h3 className="detail-section-title">Risk Owners</h3><MarkdownText content={selectedItem.risk_owners} /></div>}
                {selectedItem.monitoring_approach && <div className="detail-section"><h3 className="detail-section-title">Monitoring Approach</h3><MarkdownText content={selectedItem.monitoring_approach} /></div>}
                {selectedItem.escalation_process && <div className="detail-section"><h3 className="detail-section-title">Escalation Process</h3><MarkdownText content={selectedItem.escalation_process} /></div>}
              </div>
            </div>
          ) : (
            <div className="empty-state"><AlertTriangle size={64} /><h3>Select an assessment</h3><p>Click on an item to view details</p></div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Generate Risk Assessment</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="example-buttons">
                <span className="example-label">Try Example:</span>
                <button className="btn btn-outline btn-sm" onClick={() => setForm({ projectName: 'Patient Records System Migration', projectType: 'Healthcare Technology', riskCategory: 'Compliance', projectDescription: 'Migrating 2M+ patient records from legacy system to cloud-based EHR. Must maintain HIPAA compliance throughout, zero data loss tolerance, and 99.9% uptime during transition. Integration with 12 hospital departments.' })}>Healthcare</button>
                <button className="btn btn-outline btn-sm" onClick={() => setForm({ projectName: 'Online Banking Platform Overhaul', projectType: 'Financial Services', riskCategory: 'Security', projectDescription: 'Complete rebuild of customer-facing banking platform handling $500M+ daily transactions. PCI-DSS compliance, real-time fraud detection, biometric authentication, and integration with SWIFT network.' })}>FinTech</button>
                <button className="btn btn-outline btn-sm" onClick={() => setForm({ projectName: 'Multi-Cloud Infrastructure Setup', projectType: 'Cloud Migration', riskCategory: 'Technical', projectDescription: 'Deploying hybrid cloud infrastructure across AWS and Azure for a 500-employee company. Includes Kubernetes orchestration, service mesh, data replication across regions, and disaster recovery with 15-minute RPO.' })}>Cloud Infra</button>
                <button className="btn btn-outline btn-sm" onClick={() => setForm({ projectName: 'Enterprise ERP Implementation', projectType: 'System Integration', riskCategory: 'All Categories', projectDescription: 'SAP S/4HANA implementation for manufacturing company with 3 factories, 2000 employees. Includes finance, HR, supply chain, and production modules. 18-month timeline with phased rollout.' })}>ERP System</button>
              </div>
              <div className="form-grid">
                <div className="form-group full-width">
                  <label className="form-label">Project Name *</label>
                  <input className="form-input" value={form.projectName} onChange={(e) => setForm({...form, projectName: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Project Type</label>
                  <select className="form-select" value={form.projectType} onChange={(e) => setForm({...form, projectType: e.target.value})}>
                    <option>Web Application</option>
                    <option>Mobile Application</option>
                    <option>System Integration</option>
                    <option>Cloud Migration</option>
                    <option>Healthcare Technology</option>
                    <option>Financial Services</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Risk Category Focus</label>
                  <select className="form-select" value={form.riskCategory} onChange={(e) => setForm({...form, riskCategory: e.target.value})}>
                    <option>Technical</option>
                    <option>Security</option>
                    <option>Compliance</option>
                    <option>Operational</option>
                    <option>Financial</option>
                    <option>All Categories</option>
                  </select>
                </div>
                <div className="form-group full-width">
                  <label className="form-label">Project Description</label>
                  <textarea className="form-textarea" value={form.projectDescription} onChange={(e) => setForm({...form, projectDescription: e.target.value})} placeholder="Describe the project..." />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleGenerate} disabled={generating || !form.projectName}>
                {generating ? <><Loader size={16} className="spinning" /> Generating...</> : <><Wand2 size={16} /> Generate</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Settings
const SettingsList = () => (
  <GenericList
    title="Settings"
    endpoint="settings"
    columns={[
      { label: 'Key', field: 'key' },
      { label: 'Value', field: 'value' },
      { label: 'Category', field: 'category' },
    ]}
    renderRow={(item) => (
      <>
        <td><strong>{item.key}</strong><br/><small style={{color: 'var(--text-secondary)'}}>{item.description}</small></td>
        <td>{item.value}</td>
        <td>{item.category}</td>
      </>
    )}
    FormComponent={SettingForm}
  />
);

// Profile Page
const ProfilePage = () => {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    first_name: user?.firstName || '',
    last_name: user?.lastName || '',
    email: user?.email || '',
  });
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await axios.put(`${API_URL}/auth/profile`, form);
      setUser(res.data.user);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }
    setSaving(true);
    try {
      await axios.put(`${API_URL}/auth/profile`, {
        ...form,
        current_password: passwordForm.current_password,
        password: passwordForm.new_password,
      });
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      toast.success('Password changed');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Password change failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Profile</h1>
          <p className="page-subtitle">Manage your account settings</p>
        </div>
      </div>
      <div className="profile-container">
        <div className="profile-section">
          <h3>Personal Information</h3>
          <form onSubmit={handleSave}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">First Name</label>
                <input className="form-input" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name</label>
                <input className="form-input" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
              </div>
              <div className="form-group full-width">
                <label className="form-label">Email</label>
                <input type="email" className="form-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: 16 }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
        <div className="profile-section">
          <h3>Change Password</h3>
          <form onSubmit={handlePasswordChange}>
            <div className="form-grid">
              <div className="form-group full-width">
                <label className="form-label">Current Password</label>
                <input type="password" className="form-input" value={passwordForm.current_password}
                  onChange={e => setPasswordForm({ ...passwordForm, current_password: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input type="password" className="form-input" value={passwordForm.new_password}
                  onChange={e => setPasswordForm({ ...passwordForm, new_password: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input type="password" className="form-input" value={passwordForm.confirm_password}
                  onChange={e => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })} required />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: 16 }}>
              {saving ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// Protected Route
const ProtectedRoute = ({ children, roles }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  return (
    <Layout>
      <ErrorBoundary>{children}</ErrorBoundary>
    </Layout>
  );
};

// Main App
const App = () => {
  return (
    <BrowserRouter>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
              <Route path="/clients" element={<ProtectedRoute><ClientList /></ProtectedRoute>} />
              <Route path="/clients/:id" element={<ProtectedRoute><ClientDetail /></ProtectedRoute>} />
              <Route path="/projects" element={<ProtectedRoute><ProjectList /></ProtectedRoute>} />
              <Route path="/projects/:id" element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />
              <Route path="/proposals" element={<ProtectedRoute><ProposalList /></ProtectedRoute>} />
              <Route path="/proposals/:id" element={<ProtectedRoute><ProposalDetail /></ProtectedRoute>} />
              <Route path="/sows" element={<ProtectedRoute><SOWList /></ProtectedRoute>} />
              <Route path="/sows/:id" element={<ProtectedRoute><SOWDetail /></ProtectedRoute>} />
              <Route path="/services" element={<ProtectedRoute><ServiceList /></ProtectedRoute>} />
              <Route path="/services/:id" element={<ProtectedRoute><ServiceDetail /></ProtectedRoute>} />
              <Route path="/pricing" element={<ProtectedRoute><PricingList /></ProtectedRoute>} />
              <Route path="/pricing/:id" element={<ProtectedRoute><PricingDetail /></ProtectedRoute>} />
              <Route path="/templates" element={<ProtectedRoute><TemplateList /></ProtectedRoute>} />
              <Route path="/templates/:id" element={<ProtectedRoute><TemplateDetail /></ProtectedRoute>} />
              <Route path="/team" element={<ProtectedRoute roles={['admin', 'manager']}><TeamList /></ProtectedRoute>} />
              <Route path="/team/:id" element={<ProtectedRoute roles={['admin', 'manager']}><TeamDetail /></ProtectedRoute>} />
              <Route path="/ai-generator" element={<ProtectedRoute><AIGenerator /></ProtectedRoute>} />
              <Route path="/ai-pricing" element={<ProtectedRoute><AIPricingSuggester /></ProtectedRoute>} />
              <Route path="/ai-win-loss" element={<ProtectedRoute><AIWinLossAnalyzer /></ProtectedRoute>} />
              <Route path="/ai-competitors" element={<ProtectedRoute><AICompetitorDifferentiator /></ProtectedRoute>} />
              <Route path="/ai-timeline" element={<ProtectedRoute><AITimelineGenerator /></ProtectedRoute>} />
              <Route path="/ai-risk" element={<ProtectedRoute><AIRiskAssessment /></ProtectedRoute>} />
              <Route path="/documents" element={<ProtectedRoute><DocumentList /></ProtectedRoute>} />
              <Route path="/documents/:id" element={<ProtectedRoute><DocumentDetail /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute roles={['admin']}><SettingsList /></ProtectedRoute>} />
            </Routes>
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </BrowserRouter>
  );
};

export default App;
