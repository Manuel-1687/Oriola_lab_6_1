import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const SESSION_KEY = 'oriola-products-session';
const emptyForm = { product_name: '', description: '', price: '', quantity: '' };

function App() {
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    } catch {
      return null;
    }
  });
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [login, setLogin] = useState({ identifier: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function request(path, options = {}, token = session?.access_token) {
    const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || result.message || 'Request failed.');
    return result;
  }

  useEffect(() => {
    if (!session?.access_token) return;
    let active = true;
    request('/api/products')
      .then((result) => {
        if (active) {
          setProducts(result.data || []);
          setError('');
        }
      })
      .catch((reason) => {
        if (!active) return;
        if (reason.message === 'Unauthorized') clearSession();
        else setError(reason.message);
      });
    return () => { active = false; };
  }, [session?.access_token]);

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setProducts([]);
  }

  async function submitLogin(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(login),
      }, null);
      const nextSession = { ...result.tokens, user: result.user };
      localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
      setNotice('');
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitProduct(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const path = editingId ? `/api/products/${editingId}` : '/api/products';
      await request(path, {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify({ ...form, price: Number(form.price), quantity: Number(form.quantity) }),
      });
      const result = await request('/api/products');
      setProducts(result.data || []);
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      setNotice(editingId ? 'Product updated successfully.' : 'Product created successfully.');
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  function editProduct(product) {
    setEditingId(product.id);
    setForm({
      product_name: product.product_name,
      description: product.description || '',
      price: product.price,
      quantity: product.quantity,
    });
    setShowForm(true);
    setNotice('');
  }

  async function deleteProduct(product) {
    if (!window.confirm(`Are you sure you want to delete "${product.product_name}"?`)) return;
    setError('');
    try {
      await request(`/api/products/${product.id}`, { method: 'DELETE' });
      setProducts((current) => current.filter((item) => item.id !== product.id));
      setNotice('Product removed from catalog.');
    } catch (reason) {
      setError(reason.message);
    }
  }

  async function logout() {
    try {
      await request('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: session?.refresh_token }),
      });
    } catch {
      // Clear local session even if unreachable
    }
    clearSession();
    setNotice('');
  }

  function openNewProduct() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setNotice('');
    setError('');
  }

  if (!session?.access_token) {
    return (
      <main className="login-layout">
        <div className="login-card">
          <header className="auth-header">
            <div className="brand-badge">
              <span className="brand-symbol">Oriola</span>
            </div>
            <h1>Welcome back</h1>
            <p className="subtitle">Sign in to access your inventory workspace</p>
          </header>

          {error && <div className="alert alert-error" role="alert">{error}</div>}

          <form className="auth-form" onSubmit={submitLogin}>
            <div className="field-group">
              <label htmlFor="identifier">Username or Email</label>
              <input
                id="identifier"
                type="text"
                autoComplete="username"
                placeholder="e.g. oriola_admin"
                value={login.identifier}
                onChange={(event) => setLogin({ ...login, identifier: event.target.value })}
                required
              />
            </div>

            <div className="field-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={login.password}
                onChange={(event) => setLogin({ ...login, password: event.target.value })}
                required
              />
            </div>

            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Authenticating…' : 'Sign In'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <div className="app-layout">
      <header className="app-navbar">
        <div className="navbar-container">
          <div className="brand-group">
            <div className="brand-icon">O</div>
            <span className="brand-text">Oriola <span className="brand-sub">Inventory Suite</span></span>
          </div>
          <div className="user-profile">
            <span className="user-name">{session.user?.username || 'User Workspace'}</span>
            <button className="btn btn-secondary btn-sm" onClick={logout}>Log out</button>
          </div>
        </div>
      </header>

      <main className="app-container">
        <header className="page-header">
          <div>
            <span className="badge-tag">CATALOG MANAGEMENT</span>
            <h2>Product Directory</h2>
            <p className="page-meta">{products.length} {products.length === 1 ? 'total product' : 'total products'} listed</p>
          </div>
          <button className="btn btn-primary" onClick={openNewProduct}>+ New Product</button>
        </header>

        {notice && <div className="alert alert-success" role="status">{notice}</div>}
        {error && <div className="alert alert-error" role="alert">{error}</div>}

        {showForm && (
          <div className="modal-card">
            <div className="card-header">
              <h3>{editingId ? 'Edit Product Details' : 'Add New Catalog Item'}</h3>
              <button className="btn-close" type="button" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form className="modal-form" onSubmit={submitProduct}>
              <div className="field-group">
                <label>Product Name</label>
                <input
                  maxLength="100"
                  placeholder="e.g. Ergonomic Desk Chair"
                  value={form.product_name}
                  onChange={(event) => setForm({ ...form, product_name: event.target.value })}
                  required
                />
              </div>

              <div className="field-group">
                <label>Description</label>
                <textarea
                  rows="3"
                  placeholder="Enter detailed description..."
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </div>

              <div className="field-grid">
                <div className="field-group">
                  <label>Price ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.price}
                    onChange={(event) => setForm({ ...form, price: event.target.value })}
                    required
                  />
                </div>

                <div className="field-group">
                  <label>Quantity</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={form.quantity}
                    onChange={(event) => setForm({ ...form, quantity: event.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-actions">
                <button className="btn btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
                <button className="btn btn-primary" disabled={busy}>
                  {busy ? 'Saving...' : editingId ? 'Update Item' : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="data-card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product Details</th>
                  <th>Price</th>
                  <th>Stock Level</th>
                  <th>Date Added</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <span className="product-title">{product.product_name}</span>
                      {product.description && <span className="product-desc">{product.description}</span>}
                    </td>
                    <td className="price-tag">${Number(product.price).toFixed(2)}</td>
                    <td>
                      <span className={Number(product.quantity) === 0 ? 'stock-pill out' : 'stock-pill'}>
                        {Number(product.quantity) === 0 ? 'Out of Stock' : `${product.quantity} units`}
                      </span>
                    </td>
                    <td className="date-cell">{product.created_at ? new Date(product.created_at).toLocaleDateString() : '—'}</td>
                    <td className="text-right">
                      <div className="action-group">
                        <button className="btn-icon edit" title="Edit" onClick={() => editProduct(product)}>Edit</button>
                        <button className="btn-icon delete" title="Delete" onClick={() => deleteProduct(product)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td className="empty-row" colSpan="5">No products in directory yet. Click "+ New Product" to populate your catalog.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
