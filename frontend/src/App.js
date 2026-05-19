import React, { useState, useEffect, useCallback, createContext, useContext, Component } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';

// === Batch 07 Gaps & Frontend Mounts ===
import CfMultisectionSowGeneration from './pages/CfMultisectionSowGeneration';
import CfProposalTemplateLibrary from './pages/CfProposalTemplateLibrary';
import CfPricingIntelligence from './pages/CfPricingIntelligence';
import CfRiskAllocation from './pages/CfRiskAllocation';
import CfContractClauseRecommender from './pages/CfContractClauseRecommender';
import CfPostsignatureTracking from './pages/CfPostsignatureTracking';
import GapNoAiSowGenerationEndpoint from './pages/GapNoAiSowGenerationEndpoint';
import GapNoAiProposalfrombriefGeneration from './pages/GapNoAiProposalfrombriefGeneration';
import GapNoAiClausetermRecommendation from './pages/GapNoAiClausetermRecommendation';
import GapNoAiPricingIntelligence from './pages/GapNoAiPricingIntelligence';
import GapNoAiRiskAllocationGeneration from './pages/GapNoAiRiskAllocationGeneration';
import GapNoClientProjectOrProposalCrud from './pages/GapNoClientProjectOrProposalCrud';
import GapNoTemplateLibraryOrSectionSnippets from './pages/GapNoTemplateLibraryOrSectionSnippets';
import GapNoPricingratecardManagement from './pages/GapNoPricingratecardManagement';
import GapNoPdfExportRouteCodebaseImportsPdfLib from './pages/GapNoPdfExportRouteCodebaseImportsPdfLib';
import GapNoEsignatureWorkflow from './pages/GapNoEsignatureWorkflow';
import GapNoChangeorderTracking from './pages/GapNoChangeorderTracking';
import GapNoNotificationsAuditLogOrRbac from './pages/GapNoNotificationsAuditLogOrRbac';
import CustomViewsPage from './pages/CustomViewsPage';
// === End Batch 07 ===

import {
  LayoutDashboard, Users, Building2, FolderKanban, FileText, FileCheck,
  DollarSign, Briefcase, FileCode, Sparkles, Files, BarChart3,
  Settings, LogOut, Plus, Search, X, ChevronRight, ChevronLeft, ArrowLeft,
  Edit, Trash2, Copy, Wand2, RefreshCw, UserCircle, TrendingUp,
  Target, Clock, AlertTriangle, Award, CheckCircle, XCircle, Loader,
  Menu, Download, Printer, ChevronDown, ChevronUp
} from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

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
      { icon: Files, label: 'Proposal Templates', path: '/proposal-templates' },
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
      { icon: BarChart3, label: 'Proposal Views', path: '/custom-views' },
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

// Proposal Detail (enhanced with PDF export, client portal, revision history, AI scope refiner, pricing analysis, contract generator)
const ProposalDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [portalLink, setPortalLink] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [revisions, setRevisions] = useState([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [scopeRefine, setScopeRefine] = useState(null);
  const [scopeLoading, setScopeLoading] = useState(false);
  const [priceCheck, setPriceCheck] = useState(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [contract, setContract] = useState(null);
  const [contractLoading, setContractLoading] = useState(false);

  useEffect(() => {
    axios.get(`${API_URL}/proposals/${id}`)
      .then(res => setItem(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleExportPDF = async () => {
    setPdfLoading(true);
    try {
      const response = await axios.get(`${API_URL}/proposals/${id}/export-pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `proposal-${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded successfully');
    } catch (err) { toast.error('PDF export failed: ' + (err.response?.data?.error || err.message)); }
    setPdfLoading(false);
  };

  const handleCreatePortalLink = async () => {
    setPortalLoading(true);
    try {
      const { data } = await axios.post(`${API_URL}/proposals/${id}/create-link`);
      setPortalLink(data.portalUrl);
      toast.success('Client portal link created!');
    } catch (err) { toast.error('Failed to create portal link'); }
    setPortalLoading(false);
  };

  const handleLoadRevisions = async () => {
    setRevisionsLoading(true); setActiveTab('revisions');
    try {
      const { data } = await axios.get(`${API_URL}/proposals/${id}/revisions`);
      setRevisions(data);
    } catch (err) { toast.error('Failed to load revisions'); }
    setRevisionsLoading(false);
  };

  const handleRefineScope = async () => {
    setScopeLoading(true); setActiveTab('ai-refine'); setScopeRefine(null);
    try {
      const { data } = await axios.post(`${API_URL}/proposals/${id}/ai-refine-scope`);
      setScopeRefine(data.refinement);
      toast.success('Scope analysis complete');
    } catch (err) { toast.error('AI scope refiner failed: ' + (err.response?.data?.error || err.message)); }
    setScopeLoading(false);
  };

  const handlePriceCheck = async () => {
    setPriceLoading(true); setActiveTab('ai-price'); setPriceCheck(null);
    try {
      const { data } = await axios.post(`${API_URL}/proposals/${id}/ai-price-check`);
      setPriceCheck(data.priceCheck);
      toast.success('Pricing analysis complete');
    } catch (err) { toast.error('Pricing analysis failed: ' + (err.response?.data?.error || err.message)); }
    setPriceLoading(false);
  };

  const handleGenerateContract = async () => {
    setContractLoading(true); setActiveTab('contract'); setContract(null);
    try {
      const { data } = await axios.post(`${API_URL}/proposals/${id}/generate-contract`);
      setContract(data.contract);
      toast.success('Contract generated');
    } catch (err) { toast.error('Contract generation failed: ' + (err.response?.data?.error || err.message)); }
    setContractLoading(false);
  };

  if (loading) return <div className="loading"><div className="spinner"></div>Loading...</div>;
  if (!item) return <div className="empty-state"><h3>Proposal not found</h3></div>;

  const tabs = ['details', 'revisions', 'portal', 'ai-refine', 'ai-price', 'contract'];
  const tabLabels = { details: 'Details', revisions: 'Revisions', portal: 'Client Portal', 'ai-refine': 'AI Scope Refiner', 'ai-price': 'Pricing Analysis', contract: 'Contract Generator' };
  const assessmentColor = { under_market: '#0d904f', fair: '#1a73e8', over_market: '#d93025' };

  return (
    <div>
      <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
        <ArrowLeft size={18} /> Back
      </button>
      <div className="detail-container">
        <div className="detail-header">
          <div>
            <h1 className="detail-title">{item.title}</h1>
            <div className="detail-meta">
              <span className={`status-badge ${item.status}`}>{item.status}</span>
              <span style={{fontWeight:600,color:'#0d904f'}}>${(item.total_amount || 0).toLocaleString()}</span>
              {item.portal_approved_at && <span className="status-badge accepted">Client Approved</span>}
            </div>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <button className="btn btn-secondary" onClick={handleExportPDF} disabled={pdfLoading}>
              <Download size={16} /> {pdfLoading ? 'Generating...' : 'Export PDF'}
            </button>
            <button className="btn btn-secondary" onClick={handleCreatePortalLink} disabled={portalLoading} style={{background:'#e8f5e9',color:'#2e7d32'}}>
              {portalLoading ? 'Creating...' : 'Create Portal Link'}
            </button>
            <button className="btn btn-secondary" onClick={handleLoadRevisions}>
              <Clock size={16} /> Revisions
            </button>
            <button className="btn btn-ai" onClick={handleRefineScope} disabled={scopeLoading}>
              <Wand2 size={16} /> AI Refine Scope
            </button>
            <button className="btn btn-ai" onClick={handlePriceCheck} disabled={priceLoading}>
              <DollarSign size={16} /> Price Check
            </button>
            <button className="btn btn-ai" onClick={handleGenerateContract} disabled={contractLoading}>
              <Award size={16} /> Generate Contract
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:'flex',gap:4,borderBottom:'2px solid #e0e0e0',marginBottom:16,flexWrap:'wrap'}}>
          {tabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{padding:'8px 14px',border:'none',background:'none',cursor:'pointer',fontSize:13,
                borderBottom: activeTab===tab ? '2px solid #1a73e8' : '2px solid transparent',
                color: activeTab===tab ? '#1a73e8' : '#5f6368', fontWeight: activeTab===tab ? 600 : 400,
                marginBottom:-2}}>
              {tabLabels[tab]}
            </button>
          ))}
        </div>

        {/* Details Tab */}
        {activeTab === 'details' && (
          <div className="detail-body">
            {item.executive_summary && (<div className="detail-section"><h3 className="detail-section-title">Executive Summary</h3><MarkdownText content={item.executive_summary} /></div>)}
            {item.scope_of_work && (<div className="detail-section"><h3 className="detail-section-title">Scope of Work</h3><MarkdownText content={item.scope_of_work} /></div>)}
            {item.deliverables && (<div className="detail-section"><h3 className="detail-section-title">Deliverables</h3><MarkdownText content={item.deliverables} /></div>)}
            {item.timeline && (<div className="detail-section"><h3 className="detail-section-title">Timeline</h3><MarkdownText content={item.timeline} /></div>)}
            {item.pricing_summary && (<div className="detail-section"><h3 className="detail-section-title">Pricing</h3><MarkdownText content={item.pricing_summary} /></div>)}
            {item.terms_conditions && (<div className="detail-section"><h3 className="detail-section-title">Terms & Conditions</h3><MarkdownText content={item.terms_conditions} /></div>)}
          </div>
        )}

        {/* Client Portal Tab */}
        {activeTab === 'portal' && (
          <div>
            <h3 style={{marginBottom:16}}>Client Portal</h3>
            {item.portal_approved_at && (
              <div style={{background:'#e6f4ea',borderRadius:8,padding:16,marginBottom:16,border:'1px solid #4caf50'}}>
                <strong style={{color:'#2e7d32'}}>Approved by client</strong>
                <div style={{fontSize:13,marginTop:4}}>Approved by: {item.portal_approved_by || 'Client'} on {new Date(item.portal_approved_at).toLocaleString()}</div>
              </div>
            )}
            {item.public_token && (
              <div style={{background:'#e8f0fe',borderRadius:8,padding:16,marginBottom:16}}>
                <div style={{fontSize:13,fontWeight:600,marginBottom:8}}>Existing portal link:</div>
                <div style={{background:'#fff',padding:10,borderRadius:6,fontFamily:'monospace',fontSize:12,wordBreak:'break-all'}}>
                  {window.location.origin}/portal/proposals/{item.public_token}
                </div>
                <button className="btn btn-secondary btn-sm" style={{marginTop:8}}
                  onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/portal/proposals/${item.public_token}`); toast.success('Copied!'); }}>
                  Copy Link
                </button>
              </div>
            )}
            {portalLink && (
              <div style={{background:'#e8f0fe',borderRadius:8,padding:16}}>
                <div style={{fontSize:13,fontWeight:600,marginBottom:8}}>New portal link created:</div>
                <div style={{background:'#fff',padding:10,borderRadius:6,fontFamily:'monospace',fontSize:12,wordBreak:'break-all'}}>{portalLink}</div>
                <button className="btn btn-secondary btn-sm" style={{marginTop:8}}
                  onClick={() => { navigator.clipboard.writeText(portalLink); toast.success('Copied!'); }}>
                  Copy Link
                </button>
              </div>
            )}
            {!portalLink && !item.public_token && (
              <div style={{textAlign:'center',padding:32,color:'#5f6368'}}>
                <p>No portal link exists yet. Click "Create Portal Link" to generate a shareable link for the client.</p>
              </div>
            )}
          </div>
        )}

        {/* Revision History Tab */}
        {activeTab === 'revisions' && (
          <div>
            <h3 style={{marginBottom:16}}>Revision History</h3>
            {revisionsLoading && <div style={{textAlign:'center',padding:24}}>Loading revisions...</div>}
            {!revisionsLoading && revisions.length === 0 && (
              <div style={{textAlign:'center',padding:32,color:'#5f6368'}}>No revision history found. Revisions are created automatically on updates.</div>
            )}
            {!revisionsLoading && revisions.map((rev, i) => (
              <div key={rev.id} style={{display:'flex',gap:12,marginBottom:20}}>
                <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
                  <div style={{width:36,height:36,borderRadius:'50%',background:'#1a73e8',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:13}}>{rev.version}</div>
                  {i < revisions.length - 1 && <div style={{width:2,flex:1,background:'#e0e0e0',marginTop:4}}></div>}
                </div>
                <div style={{flex:1,paddingBottom:20}}>
                  <div style={{fontWeight:600,fontSize:14}}>Version {rev.version}</div>
                  <div style={{fontSize:12,color:'#5f6368',marginBottom:4}}>{new Date(rev.created_at).toLocaleString()} by {rev.changed_by_name || 'System'}</div>
                  {rev.change_summary && <div style={{fontSize:13,color:'#3c4043'}}>{rev.change_summary}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* AI Scope Refiner Tab */}
        {activeTab === 'ai-refine' && (
          <div>
            <h3 style={{marginBottom:16}}>AI Scope Refiner</h3>
            {scopeLoading && <div style={{textAlign:'center',padding:32}}>AI is analyzing your proposal scope...</div>}
            {!scopeLoading && !scopeRefine && (
              <div style={{textAlign:'center',padding:32,color:'#5f6368'}}>Click "AI Refine Scope" to get AI suggestions for improving clarity, identifying risks, and finding missing deliverables.</div>
            )}
            {!scopeLoading && scopeRefine && (
              <div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
                  <div style={{background:'#e8f0fe',borderRadius:8,padding:16,textAlign:'center'}}>
                    <div style={{fontSize:11,color:'#5f6368'}}>Overall Score</div>
                    <div style={{fontSize:32,fontWeight:700,color:scopeRefine.overallScore>=75?'#0d904f':scopeRefine.overallScore>=50?'#e37400':'#d93025'}}>{scopeRefine.overallScore}/100</div>
                  </div>
                  {scopeRefine.identifiedRisks && (
                    <div style={{background:'#fce8e6',borderRadius:8,padding:16,textAlign:'center'}}>
                      <div style={{fontSize:11,color:'#5f6368'}}>Risks Found</div>
                      <div style={{fontSize:32,fontWeight:700,color:'#d93025'}}>{scopeRefine.identifiedRisks.length}</div>
                    </div>
                  )}
                  {scopeRefine.missingDeliverables && (
                    <div style={{background:'#fef7e0',borderRadius:8,padding:16,textAlign:'center'}}>
                      <div style={{fontSize:11,color:'#5f6368'}}>Missing Deliverables</div>
                      <div style={{fontSize:32,fontWeight:700,color:'#e37400'}}>{scopeRefine.missingDeliverables.length}</div>
                    </div>
                  )}
                </div>
                {scopeRefine.priorityActions?.length > 0 && (
                  <div style={{background:'#f8f9fa',borderRadius:8,padding:16,marginBottom:16,border:'1px solid #e0e0e0'}}>
                    <strong style={{fontSize:14}}>Priority Actions</strong>
                    {scopeRefine.priorityActions.map((a,i) => (
                      <div key={i} style={{display:'flex',gap:8,marginTop:8,fontSize:13}}>
                        <span style={{color:'#1a73e8',fontWeight:700}}>{i+1}.</span><span>{a}</span>
                      </div>
                    ))}
                  </div>
                )}
                {scopeRefine.clarityIssues?.length > 0 && (
                  <div style={{marginBottom:16}}>
                    <strong style={{fontSize:14}}>Clarity Issues</strong>
                    {scopeRefine.clarityIssues.map((issue,i) => (
                      <div key={i} style={{background:'#fff3e0',borderRadius:8,padding:12,marginTop:8,border:'1px solid #ff9800'}}>
                        <div style={{fontSize:12,color:'#e65100',fontWeight:600}}>{issue.section}</div>
                        <div style={{fontSize:13,marginTop:4}}>{issue.issue}</div>
                        <div style={{fontSize:12,color:'#0d904f',marginTop:4}}>Suggestion: {issue.suggestion}</div>
                      </div>
                    ))}
                  </div>
                )}
                {scopeRefine.identifiedRisks?.length > 0 && (
                  <div style={{marginBottom:16}}>
                    <strong style={{fontSize:14}}>Identified Risks</strong>
                    {scopeRefine.identifiedRisks.map((r,i) => (
                      <div key={i} style={{background:'#fce8e6',borderRadius:8,padding:12,marginTop:8,border:'1px solid #f44336'}}>
                        <div style={{display:'flex',justifyContent:'space-between'}}>
                          <strong style={{fontSize:13}}>{r.risk}</strong>
                          <span className={`status-badge ${r.severity}`}>{r.severity}</span>
                        </div>
                        {r.mitigation && <div style={{fontSize:12,color:'#5f6368',marginTop:4}}>Mitigation: {r.mitigation}</div>}
                      </div>
                    ))}
                  </div>
                )}
                {scopeRefine.improvedScopeSuggestion && (
                  <div style={{background:'#e6f4ea',borderRadius:8,padding:16,border:'1px solid #4caf50'}}>
                    <strong style={{fontSize:14}}>Improved Scope Suggestion</strong>
                    <p style={{fontSize:13,marginTop:8,lineHeight:1.6}}>{scopeRefine.improvedScopeSuggestion}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* AI Pricing Analysis Tab */}
        {activeTab === 'ai-price' && (
          <div>
            <h3 style={{marginBottom:16}}>AI Pricing Analysis</h3>
            {priceLoading && <div style={{textAlign:'center',padding:32}}>AI is analyzing pricing against market benchmarks...</div>}
            {!priceLoading && !priceCheck && (
              <div style={{textAlign:'center',padding:32,color:'#5f6368'}}>Click "Price Check" to compare your pricing against industry benchmarks.</div>
            )}
            {!priceLoading && priceCheck && (
              <div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
                  <div style={{background:'#e8f0fe',borderRadius:8,padding:16,textAlign:'center'}}>
                    <div style={{fontSize:11,color:'#5f6368'}}>Assessment</div>
                    <div style={{fontSize:14,fontWeight:700,color:assessmentColor[priceCheck.pricingAssessment],textTransform:'capitalize'}}>{priceCheck.pricingAssessment?.replace(/_/g,' ') || '-'}</div>
                  </div>
                  <div style={{background:'#f8f9fa',borderRadius:8,padding:16,textAlign:'center'}}>
                    <div style={{fontSize:11,color:'#5f6368'}}>Market Mid-Point</div>
                    <div style={{fontSize:18,fontWeight:700}}>{priceCheck.marketRate?.mid ? `$${Number(priceCheck.marketRate.mid).toLocaleString()}` : '-'}</div>
                  </div>
                  <div style={{background:'#f8f9fa',borderRadius:8,padding:16,textAlign:'center'}}>
                    <div style={{fontSize:11,color:'#5f6368'}}>Confidence</div>
                    <div style={{fontSize:18,fontWeight:700}}>{priceCheck.confidence || '-'}%</div>
                  </div>
                </div>
                {priceCheck.marketRate && (
                  <div style={{background:'#e8f0fe',borderRadius:8,padding:16,marginBottom:16}}>
                    <strong style={{fontSize:14}}>Market Rate Range</strong>
                    <div style={{display:'flex',gap:24,marginTop:8,fontSize:13}}>
                      <span>Low: <strong>${Number(priceCheck.marketRate.low||0).toLocaleString()}</strong></span>
                      <span>Mid: <strong>${Number(priceCheck.marketRate.mid||0).toLocaleString()}</strong></span>
                      <span>High: <strong>${Number(priceCheck.marketRate.high||0).toLocaleString()}</strong></span>
                    </div>
                  </div>
                )}
                {priceCheck.flags?.length > 0 && (
                  <div style={{marginBottom:16}}>
                    <strong style={{fontSize:14}}>Pricing Flags</strong>
                    {priceCheck.flags.map((f,i) => (
                      <div key={i} style={{background: f.severity==='high'?'#fce8e6':'#fef7e0',borderRadius:8,padding:12,marginTop:8,border:`1px solid ${f.severity==='high'?'#f44336':'#ff9800'}`}}>
                        <div style={{display:'flex',justifyContent:'space-between'}}>
                          <strong style={{fontSize:13}}>{f.issue}</strong>
                          <span className={`status-badge ${f.severity}`}>{f.severity}</span>
                        </div>
                        {f.detail && <div style={{fontSize:12,marginTop:4}}>{f.detail}</div>}
                      </div>
                    ))}
                  </div>
                )}
                {priceCheck.recommendations?.length > 0 && (
                  <div style={{background:'#f8f9fa',borderRadius:8,padding:16,border:'1px solid #e0e0e0'}}>
                    <strong style={{fontSize:14}}>Recommendations</strong>
                    {priceCheck.recommendations.map((r,i) => (
                      <div key={i} style={{fontSize:13,marginTop:8,display:'flex',gap:8}}>
                        <span style={{color:'#1a73e8'}}>•</span>{r}
                      </div>
                    ))}
                  </div>
                )}
                {priceCheck.analysis && (
                  <div style={{background:'#f8f9fa',borderRadius:8,padding:16,marginTop:16,border:'1px solid #e0e0e0'}}>
                    <strong style={{fontSize:14}}>Analysis Narrative</strong>
                    <p style={{fontSize:13,marginTop:8,lineHeight:1.6}}>{priceCheck.analysis}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Contract Generator Tab */}
        {activeTab === 'contract' && (
          <div>
            <h3 style={{marginBottom:16}}>Contract Generator</h3>
            {contractLoading && <div style={{textAlign:'center',padding:32}}>AI is generating your contract...</div>}
            {!contractLoading && !contract && (
              <div style={{textAlign:'center',padding:32,color:'#5f6368'}}>Click "Generate Contract" to transform this proposal into a formal contract with IP clauses, liability limitations, and payment terms.</div>
            )}
            {!contractLoading && contract && (
              <div>
                <div style={{background:'#e8f0fe',borderRadius:8,padding:16,marginBottom:16}}>
                  <strong>{contract.contractTitle || 'Service Agreement'}</strong>
                  <div style={{fontSize:13,marginTop:4}}>Effective: {contract.effectiveDate || 'Upon signature'}</div>
                  {contract.governingLaw && <div style={{fontSize:13,marginTop:4}}>Governing Law: {contract.governingLaw}</div>}
                </div>
                {[
                  ['Scope', contract.scope],
                  ['Deliverables', contract.deliverables],
                  ['Payment Terms', contract.paymentTerms],
                  ['IP Clauses', contract.ipClauses],
                  ['Liability Limitations', contract.liabilityLimitations],
                  ['Confidentiality', contract.confidentiality],
                  ['Termination', contract.termination],
                  ['Dispute Resolution', contract.disputeResolution],
                ].filter(([,v]) => v).map(([label, value]) => (
                  <div key={label} style={{marginBottom:12,padding:12,background:'#f8f9fa',borderRadius:8,border:'1px solid #e0e0e0'}}>
                    <strong style={{fontSize:13,color:'#1a73e8'}}>{label}</strong>
                    <p style={{fontSize:13,marginTop:6,lineHeight:1.6}}>{value}</p>
                  </div>
                ))}
                {contract.fullContractText && (
                  <div style={{marginTop:16}}>
                    <strong style={{fontSize:14}}>Full Contract Text</strong>
                    <pre style={{background:'#f8f9fa',padding:16,borderRadius:8,fontSize:12,lineHeight:1.6,whiteSpace:'pre-wrap',marginTop:8,border:'1px solid #e0e0e0',maxHeight:500,overflow:'auto'}}>{contract.fullContractText}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

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
// Enhanced SOW Detail with Export PDF
const SOWDetail = () => {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    axios.get(`${API_URL}/sows/${id}`)
      .then(res => setItem(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleExportPdf = async () => {
    setPdfLoading(true);
    try {
      const res = await axios.get(`${API_URL}/sows/${id}/export-pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `sow-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('SOW PDF exported successfully');
    } catch (err) {
      toast.error('Failed to export PDF');
    }
    setPdfLoading(false);
  };

  if (loading) return <div className="loading"><div className="spinner"></div>Loading...</div>;
  if (!item) return <div className="empty-state"><h3>SOW not found</h3></div>;

  const tabs = [
    { key: 'details', label: 'Details' },
    { key: 'scope', label: 'Scope & Deliverables' },
    { key: 'timeline', label: 'Timeline & Milestones' },
    { key: 'governance', label: 'Governance' },
  ];

  return (
    <div>
      <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
        <ArrowLeft size={18} /> Back
      </button>
      <div className="detail-container">
        <div className="detail-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="detail-title">{item.title}</h1>
            <div className="detail-meta">
              <span className={`status-badge ${item.status}`}>{item.status}</span>
              {item.version && <span>v{item.version}</span>}
              <span>${(item.total_amount || 0).toLocaleString()}</span>
              {item.signed_at && <span style={{ color: '#0d904f', fontWeight: 600 }}>Signed {new Date(item.signed_at).toLocaleDateString()}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleExportPdf} disabled={pdfLoading}>
              <Download size={14} /> {pdfLoading ? 'Exporting...' : 'Export PDF'}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e0e0e0', marginBottom: 24, marginTop: 16 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
              padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: activeTab === t.key ? 700 : 400,
              color: activeTab === t.key ? '#1a73e8' : '#5f6368',
              borderBottom: activeTab === t.key ? '2px solid #1a73e8' : '2px solid transparent',
              marginBottom: -2, fontSize: 14
            }}>{t.label}</button>
          ))}
        </div>

        <div className="detail-body">
          {activeTab === 'details' && (
            <>
              <div className="detail-section">
                <h3 className="detail-section-title">Overview</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                  {[
                    ['Title', item.title],
                    ['Status', item.status],
                    ['Version', item.version ? `v${item.version}` : '-'],
                    ['Total Amount', `$${(item.total_amount || 0).toLocaleString()}`],
                    ['Signed At', item.signed_at ? new Date(item.signed_at).toLocaleDateString() : 'Not signed'],
                    ['Created At', item.created_at ? new Date(item.created_at).toLocaleDateString() : '-'],
                  ].map(([label, value]) => (
                    <div key={label} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#9aa0a6', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontWeight: 500 }}>{value || '-'}</div>
                    </div>
                  ))}
                </div>
              </div>
              {item.introduction && (
                <div className="detail-section">
                  <h3 className="detail-section-title">Introduction</h3>
                  <MarkdownText content={item.introduction} />
                </div>
              )}
              {item.objectives && (
                <div className="detail-section">
                  <h3 className="detail-section-title">Objectives</h3>
                  <MarkdownText content={item.objectives} />
                </div>
              )}
            </>
          )}

          {activeTab === 'scope' && (
            <>
              {item.scope && (
                <div className="detail-section">
                  <h3 className="detail-section-title">Scope of Work</h3>
                  <MarkdownText content={item.scope} />
                </div>
              )}
              {item.deliverables && (
                <div className="detail-section">
                  <h3 className="detail-section-title">Deliverables</h3>
                  <MarkdownText content={item.deliverables} />
                </div>
              )}
              {item.assumptions && (
                <div className="detail-section">
                  <h3 className="detail-section-title">Assumptions</h3>
                  <MarkdownText content={item.assumptions} />
                </div>
              )}
              {item.constraints && (
                <div className="detail-section">
                  <h3 className="detail-section-title">Constraints</h3>
                  <MarkdownText content={item.constraints} />
                </div>
              )}
              {item.acceptance_criteria && (
                <div className="detail-section">
                  <h3 className="detail-section-title">Acceptance Criteria</h3>
                  <MarkdownText content={item.acceptance_criteria} />
                </div>
              )}
            </>
          )}

          {activeTab === 'timeline' && (
            <>
              {item.timeline && (
                <div className="detail-section">
                  <h3 className="detail-section-title">Timeline</h3>
                  <MarkdownText content={item.timeline} />
                </div>
              )}
              {item.milestones && (
                <div className="detail-section">
                  <h3 className="detail-section-title">Milestones</h3>
                  <MarkdownText content={item.milestones} />
                </div>
              )}
            </>
          )}

          {activeTab === 'governance' && (
            <>
              {item.payment_terms && (
                <div className="detail-section">
                  <h3 className="detail-section-title">Payment Terms</h3>
                  <MarkdownText content={item.payment_terms} />
                </div>
              )}
              {item.change_management && (
                <div className="detail-section">
                  <h3 className="detail-section-title">Change Management</h3>
                  <MarkdownText content={item.change_management} />
                </div>
              )}
              {item.governance && (
                <div className="detail-section">
                  <h3 className="detail-section-title">Governance</h3>
                  <MarkdownText content={item.governance} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

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
  // Improve Text — POSTs to /api/ai/improve-text. Operates on the current output OR
  // user-pasted text; result replaces the output area so it can be copied like other AI runs.
  const [improveStyle, setImproveStyle] = useState('professional');
  const [improving, setImproving] = useState(false);
  const [improveError, setImproveError] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [showPaste, setShowPaste] = useState(false);

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

  const improveText = async (sourceText) => {
    const text = (sourceText ?? output ?? '').trim();
    if (!text) {
      setImproveError('No text to improve. Generate or paste content first.');
      return;
    }
    setImproving(true);
    setImproveError('');
    try {
      const res = await axios.post(`${API_URL}/ai/improve-text`, { text, style: improveStyle });
      setOutput(res.data.content);
      setShowPaste(false);
      setPasteText('');
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Improve failed';
      // Backend throws if OPENROUTER_API_KEY missing — surface that explicitly.
      if (/api key/i.test(msg) || err.response?.status === 503) {
        setImproveError('AI not configured (503). Set OPENROUTER_API_KEY in backend .env.');
      } else {
        setImproveError(msg);
      }
    } finally {
      setImproving(false);
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

        {/* Improve Text — POSTs current output (or pasted text) to /api/ai/improve-text */}
        <div className="ai-improve" style={{ marginTop: 24, padding: 16, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fafafa' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Sparkles size={18} />
            <strong>Improve Text</strong>
            <span style={{ color: '#6b7280', fontSize: 13 }}>
              Rewrite the output above (or your own text) in a chosen voice.
            </span>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <label className="form-label" style={{ marginBottom: 0 }}>Style</label>
            <select className="form-select" style={{ maxWidth: 220 }} value={improveStyle} onChange={(e) => setImproveStyle(e.target.value)}>
              <option value="professional">Professional</option>
              <option value="concise">Concise (40–60% shorter)</option>
              <option value="persuasive">Persuasive</option>
              <option value="technical">Technical</option>
              <option value="friendly">Friendly</option>
            </select>
            <button
              className="btn btn-primary"
              onClick={() => improveText()}
              disabled={improving || !output.trim()}
              title={!output.trim() ? 'Generate or paste text first' : 'Improve current output in place'}
            >
              <Wand2 size={16} /> {improving ? 'Improving...' : 'Improve Output'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setShowPaste((v) => !v)}
              type="button"
            >
              <Edit size={16} /> {showPaste ? 'Hide Paste' : 'Improve Pasted Text'}
            </button>
          </div>
          {showPaste && (
            <div style={{ marginTop: 12 }}>
              <textarea
                className="form-textarea"
                rows={4}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste any draft text to rewrite (replaces output area on success)…"
              />
              <button
                className="btn btn-primary"
                style={{ marginTop: 8 }}
                onClick={() => improveText(pasteText)}
                disabled={improving || !pasteText.trim()}
              >
                <Wand2 size={16} /> {improving ? 'Improving...' : 'Improve Pasted Text'}
              </button>
            </div>
          )}
          {improveError && (
            <div className="alert alert-error" style={{ marginTop: 12 }}>{improveError}</div>
          )}
        </div>
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

// ============ Proposal Templates Page ============
const ProposalTemplatesPage = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', type: 'proposal', description: '', sections: '', variables: '' });
  const [saving, setSaving] = useState(false);
  const [useTemplate, setUseTemplate] = useState(null);
  const [mergeVars, setMergeVars] = useState({});
  const [mergeLoading, setMergeLoading] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const limit = 20;

  const load = useCallback(() => {
    setLoading(true);
    axios.get(`${API_URL}/proposal-templates?page=${page}&limit=${limit}`)
      .then(res => {
        const d = res.data;
        setTemplates(d.data || d || []);
        setTotal(d.pagination?.total || d.total || 0);
        setTotalPages(d.pagination?.totalPages || d.totalPages || 1);
      })
      .catch(() => toast.error('Failed to load templates'))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        sections: form.sections ? JSON.parse(form.sections) : [],
        variables: form.variables ? JSON.parse(form.variables) : {},
      };
      if (editItem) {
        await axios.put(`${API_URL}/proposal-templates/${editItem.id}`, payload);
        toast.success('Template updated');
      } else {
        await axios.post(`${API_URL}/proposal-templates`, payload);
        toast.success('Template created');
      }
      setShowForm(false);
      setEditItem(null);
      setForm({ name: '', type: 'proposal', description: '', sections: '', variables: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save template');
    }
    setSaving(false);
  };

  const handleEdit = (t) => {
    setEditItem(t);
    setForm({
      name: t.name || '',
      type: t.type || 'proposal',
      description: t.description || '',
      sections: t.sections ? JSON.stringify(t.sections, null, 2) : '',
      variables: t.variables ? JSON.stringify(t.variables, null, 2) : '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    const ok = await confirm('Delete this template?', { title: 'Delete Template', variant: 'danger' });
    if (!ok) return;
    try {
      await axios.delete(`${API_URL}/proposal-templates/${id}`);
      toast.success('Template deleted');
      load();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleUseTemplate = async (t) => {
    setUseTemplate(t);
    // Pre-populate merge vars from template variables definition
    const vars = t.variables || {};
    const initial = {};
    Object.keys(vars).forEach(k => { initial[k] = vars[k]?.default || ''; });
    setMergeVars(initial);
  };

  const handleMerge = async (e) => {
    e.preventDefault();
    setMergeLoading(true);
    try {
      const res = await axios.post(`${API_URL}/proposals/from-template`, {
        templateId: useTemplate.id,
        variables: mergeVars,
      });
      toast.success('Proposal created from template!');
      setUseTemplate(null);
      navigate(`/proposals/${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create proposal');
    }
    setMergeLoading(false);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Proposal Templates</h1>
          <p className="page-subtitle">Reusable proposal templates with merge variables ({total} total)</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditItem(null); setForm({ name: '', type: 'proposal', description: '', sections: '', variables: '' }); setShowForm(true); }}>
          <Plus size={18} /> New Template
        </button>
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : templates.length === 0 ? (
        <div className="empty-state">
          <FileText size={48} />
          <h3>No templates yet</h3>
          <p>Create your first proposal template to speed up your workflow.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Description</th>
                <th>Usage Count</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map(t => (
                <tr key={t.id}>
                  <td><strong>{t.name}</strong></td>
                  <td><span className="status-badge">{t.type}</span></td>
                  <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description || '-'}</td>
                  <td>{t.usage_count || 0}</td>
                  <td><span className={`status-badge ${t.status}`}>{t.status}</span></td>
                  <td>
                    <button className="btn btn-primary btn-sm" onClick={() => handleUseTemplate(t)} style={{ marginRight: 4 }}>
                      <Wand2 size={14} /> Use Template
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(t)} style={{ marginRight: 4 }}>
                      <Edit size={14} />
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(t.id)}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationControls page={page} totalPages={totalPages} total={total} limit={limit}
            onPageChange={setPage} onLimitChange={() => {}} />
        </div>
      )}

      {/* Create/Edit Template Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editItem ? 'Edit Template' : 'New Template'}</h2>
              <button className="modal-close" onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group full-width">
                    <label className="form-label">Template Name *</label>
                    <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g., Standard Web Development Proposal" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Type</label>
                    <select className="form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                      <option value="proposal">Proposal</option>
                      <option value="sow">SOW</option>
                      <option value="contract">Contract</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <input className="form-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brief description" />
                  </div>
                  <div className="form-group full-width">
                    <label className="form-label">Sections (JSON array)</label>
                    <textarea className="form-textarea" rows={6} value={form.sections} onChange={e => setForm({ ...form, sections: e.target.value })}
                      placeholder='[{"title": "Executive Summary", "content": "{{executive_summary}}"}, ...]' />
                    <small style={{ color: '#9aa0a6' }}>JSON array of section objects with title and content fields. Use {"{{variable_name}}"} for merge variables.</small>
                  </div>
                  <div className="form-group full-width">
                    <label className="form-label">Variables (JSON object)</label>
                    <textarea className="form-textarea" rows={4} value={form.variables} onChange={e => setForm({ ...form, variables: e.target.value })}
                      placeholder='{"client_name": {"label": "Client Name", "default": ""}, "project_scope": {"label": "Project Scope"}}' />
                    <small style={{ color: '#9aa0a6' }}>Define variables used in sections. Each key maps to its label and optional default value.</small>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Template'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Use Template / Merge Variables Modal */}
      {useTemplate && (
        <div className="modal-overlay" onClick={() => setUseTemplate(null)}>
          <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create Proposal from Template</h2>
              <button className="modal-close" onClick={() => setUseTemplate(null)}><X size={20} /></button>
            </div>
            <form onSubmit={handleMerge}>
              <div className="modal-body">
                <div style={{ background: '#f8f9fa', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                  <strong>{useTemplate.name}</strong>
                  {useTemplate.description && <p style={{ margin: '4px 0 0', color: '#5f6368', fontSize: 13 }}>{useTemplate.description}</p>}
                </div>
                {Object.keys(useTemplate.variables || {}).length === 0 ? (
                  <div className="empty-state" style={{ padding: 24 }}>
                    <p>This template has no variables. A proposal will be created with the template content as-is.</p>
                  </div>
                ) : (
                  Object.entries(useTemplate.variables || {}).map(([key, meta]) => (
                    <div className="form-group" key={key}>
                      <label className="form-label">{meta.label || key}</label>
                      <textarea className="form-textarea" rows={3} value={mergeVars[key] || ''}
                        onChange={e => setMergeVars({ ...mergeVars, [key]: e.target.value })}
                        placeholder={`Enter ${meta.label || key}...`} />
                    </div>
                  ))
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setUseTemplate(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={mergeLoading}>
                  <Wand2 size={14} /> {mergeLoading ? 'Creating...' : 'Create Proposal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ Public Client Portal Page ============
const PublicPortalPage = () => {
  const { token } = useParams();
  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [approving, setApproving] = useState(false);
  const [approverName, setApproverName] = useState('');
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    axios.get(`${API_URL}/public/proposals/${token}`)
      .then(res => setProposal(res.data))
      .catch(err => setError(err.response?.data?.error || 'Proposal not found or link expired'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleApprove = async (e) => {
    e.preventDefault();
    setApproving(true);
    try {
      await axios.post(`${API_URL}/public/proposals/${token}/approve`, { approverName });
      setApproved(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Approval failed');
    }
    setApproving(false);
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8f9fa' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
        <p style={{ color: '#5f6368' }}>Loading proposal...</p>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8f9fa' }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <XCircle size={64} style={{ color: '#d93025', marginBottom: 16 }} />
        <h2 style={{ marginBottom: 8 }}>Proposal Unavailable</h2>
        <p style={{ color: '#5f6368' }}>{error}</p>
      </div>
    </div>
  );

  if (approved || proposal?.portal_approved_at) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8f9fa' }}>
      <div style={{ textAlign: 'center', maxWidth: 500, padding: 40, background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}>
        <CheckCircle size={64} style={{ color: '#0d904f', marginBottom: 16 }} />
        <h2 style={{ marginBottom: 8 }}>Proposal Approved!</h2>
        <p style={{ color: '#5f6368', marginBottom: 8 }}>Thank you for approving this proposal. Our team will be in touch shortly.</p>
        {proposal?.portal_approved_by && <p style={{ color: '#9aa0a6', fontSize: 13 }}>Approved by: {proposal.portal_approved_by}</p>}
        {proposal?.portal_approved_at && <p style={{ color: '#9aa0a6', fontSize: 13 }}>Approved on: {new Date(proposal.portal_approved_at).toLocaleDateString()}</p>}
      </div>
    </div>
  );

  return (
    <div style={{ background: '#f8f9fa', minHeight: '100vh', padding: '32px 16px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ background: '#1a73e8', color: '#fff', borderRadius: '16px 16px 0 0', padding: '32px 40px' }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8, opacity: 0.8 }}>Proposal</div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>{proposal.title}</h1>
          {proposal.valid_until && (
            <div style={{ marginTop: 12, fontSize: 14, opacity: 0.85 }}>
              Valid until: {new Date(proposal.valid_until).toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ background: '#fff', padding: '32px 40px', borderRadius: '0 0 16px 16px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          {/* Amount */}
          {proposal.total_amount && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32, padding: '16px 20px', background: '#f0f7ff', borderRadius: 12, border: '1px solid #1a73e8' }}>
              <DollarSign size={24} style={{ color: '#1a73e8' }} />
              <div>
                <div style={{ fontSize: 11, color: '#5f6368', textTransform: 'uppercase', letterSpacing: 1 }}>Total Amount</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#1a73e8' }}>${Number(proposal.total_amount).toLocaleString()}</div>
              </div>
            </div>
          )}

          {/* Status */}
          <div style={{ marginBottom: 24 }}>
            <span className={`status-badge ${proposal.status}`}>{proposal.status}</span>
          </div>

          {/* Sections */}
          {proposal.executive_summary && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#1a1a1a', borderBottom: '2px solid #e0e0e0', paddingBottom: 8 }}>Executive Summary</h3>
              <div style={{ color: '#333', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{proposal.executive_summary}</div>
            </div>
          )}

          {proposal.scope_of_work && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#1a1a1a', borderBottom: '2px solid #e0e0e0', paddingBottom: 8 }}>Scope of Work</h3>
              <div style={{ color: '#333', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{proposal.scope_of_work}</div>
            </div>
          )}

          {proposal.deliverables && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#1a1a1a', borderBottom: '2px solid #e0e0e0', paddingBottom: 8 }}>Deliverables</h3>
              <div style={{ color: '#333', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{proposal.deliverables}</div>
            </div>
          )}

          {proposal.timeline && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#1a1a1a', borderBottom: '2px solid #e0e0e0', paddingBottom: 8 }}>Timeline</h3>
              <div style={{ color: '#333', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{proposal.timeline}</div>
            </div>
          )}

          {proposal.pricing_summary && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#1a1a1a', borderBottom: '2px solid #e0e0e0', paddingBottom: 8 }}>Pricing Summary</h3>
              <div style={{ color: '#333', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{proposal.pricing_summary}</div>
            </div>
          )}

          {proposal.terms_conditions && (
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#1a1a1a', borderBottom: '2px solid #e0e0e0', paddingBottom: 8 }}>Terms & Conditions</h3>
              <div style={{ color: '#666', lineHeight: 1.7, fontSize: 13, whiteSpace: 'pre-wrap' }}>{proposal.terms_conditions}</div>
            </div>
          )}

          {/* Approval Form */}
          {proposal.status !== 'accepted' && (
            <div style={{ background: '#f0f7ff', border: '2px solid #1a73e8', borderRadius: 12, padding: 24 }}>
              <h3 style={{ margin: '0 0 16px', color: '#1a73e8', fontSize: 18 }}>Approve This Proposal</h3>
              <p style={{ color: '#5f6368', marginBottom: 16, fontSize: 14 }}>
                By approving, you confirm acceptance of the terms and conditions outlined above.
              </p>
              <form onSubmit={handleApprove}>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">Your Name *</label>
                  <input className="form-input" value={approverName} onChange={e => setApproverName(e.target.value)}
                    placeholder="Enter your full name" required />
                </div>
                <button type="submit" className="btn btn-primary" disabled={approving} style={{ width: '100%', padding: '14px', fontSize: 16 }}>
                  <CheckCircle size={18} /> {approving ? 'Processing...' : 'I Approve This Proposal'}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 24, color: '#9aa0a6', fontSize: 13 }}>
          Powered by ProposalGen AI
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
              <Route path="/portal/proposals/:token" element={<PublicPortalPage />} />
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
              <Route path="/proposal-templates" element={<ProtectedRoute><ProposalTemplatesPage /></ProtectedRoute>} />
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
              <Route path="/custom-views" element={<ProtectedRoute><CustomViewsPage /></ProtectedRoute>} />
          // === Batch 07 Gaps & Frontend Mounts ===
          <Route path='/cf-multisection-sow-generation' element={<CfMultisectionSowGeneration />} />
          <Route path='/cf-proposal-template-library' element={<CfProposalTemplateLibrary />} />
          <Route path='/cf-pricing-intelligence' element={<CfPricingIntelligence />} />
          <Route path='/cf-risk-allocation' element={<CfRiskAllocation />} />
          <Route path='/cf-contract-clause-recommender' element={<CfContractClauseRecommender />} />
          <Route path='/cf-postsignature-tracking' element={<CfPostsignatureTracking />} />
          <Route path='/gap-no-ai-sow-generation-endpoint' element={<GapNoAiSowGenerationEndpoint />} />
          <Route path='/gap-no-ai-proposalfrombrief-generation' element={<GapNoAiProposalfrombriefGeneration />} />
          <Route path='/gap-no-ai-clauseterm-recommendation' element={<GapNoAiClausetermRecommendation />} />
          <Route path='/gap-no-ai-pricing-intelligence' element={<GapNoAiPricingIntelligence />} />
          <Route path='/gap-no-ai-risk-allocation-generation' element={<GapNoAiRiskAllocationGeneration />} />
          <Route path='/gap-no-client-project-or-proposal-crud' element={<GapNoClientProjectOrProposalCrud />} />
          <Route path='/gap-no-template-library-or-section-snippets' element={<GapNoTemplateLibraryOrSectionSnippets />} />
          <Route path='/gap-no-pricingratecard-management' element={<GapNoPricingratecardManagement />} />
          <Route path='/gap-no-pdf-export-route-codebase-imports-pdf-lib' element={<GapNoPdfExportRouteCodebaseImportsPdfLib />} />
          <Route path='/gap-no-esignature-workflow' element={<GapNoEsignatureWorkflow />} />
          <Route path='/gap-no-changeorder-tracking' element={<GapNoChangeorderTracking />} />
          <Route path='/gap-no-notifications-audit-log-or-rbac' element={<GapNoNotificationsAuditLogOrRbac />} />
          // === End Batch 07 ===
            </Routes>
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </BrowserRouter>
  );
};

export default App;
