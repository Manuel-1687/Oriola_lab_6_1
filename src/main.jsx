import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const SESSION_KEY = 'ocampo-products-session';
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
      setNotice(editingId ? 'Product updated.' : 'Product added.');
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
    if (!window.confirm(`Delete ${product.product_name}?`)) return;
    setError('');
    try {
      await request(`/api/products/${product.id}`, { method: 'DELETE' });
      setProducts((current) => current.filter((item) => item.id !== product.id));
      setNotice('Product deleted.');
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
      // Clear the local session even if the API is temporarily unreachable.
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
        <section className="login-panel">
          <div className="brand-mark" aria-hidden="true">O</div>
          <p className="eyebrow">OCAMPO · INVENTORY</p>
          <h1>Sign in</h1>
          <p className="intro">Manage your product catalog.</p>
          {error && <p className="message error" role="alert">{error}</p>}
          <form className="stack-form" onSubmit={submitLogin}>
            <label>Username or email<input autoComplete="username" value={login.identifier} onChange={(event) => setLogin({ ...login, identifier: event.target.value })} required /></label>
            <label>Password<input type="password" autoComplete="current-password" value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} required /></label>
            <button className="button primary full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#products"><span className="brand-mark small" aria-hidden="true">O</span><span>Ocampo<span className="brand-light"> / Inventory</span></span></a>
        <div className="account"><span className="account-name">{session.user?.username || 'Account'}</span><button className="button quiet" onClick={logout}>Log out</button></div>
      </header>

      <section className="content" id="products">
        <div className="heading-row">
          <div><p className="eyebrow">CATALOG</p><h1>Products</h1><p className="intro">{products.length} {products.length === 1 ? 'item' : 'items'}</p></div>
          <button className="button primary" onClick={openNewProduct}>Add product</button>
        </div>

        {notice && <p className="message success" role="status">{notice}</p>}
        {error && <p className="message error" role="alert">{error}</p>}

        {showForm && (
          <form className="product-form" onSubmit={submitProduct}>
            <div className="form-heading"><h2>{editingId ? 'Edit product' : 'New product'}</h2><button className="button quiet" type="button" onClick={() => setShowForm(false)}>Cancel</button></div>
            <label>Product name<input maxLength="100" value={form.product_name} onChange={(event) => setForm({ ...form, product_name: event.target.value })} required /></label>
            <label>Description<textarea rows="3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
            <div className="form-grid">
              <label>Price<input type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required /></label>
              <label>Quantity<input type="number" min="0" step="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} required /></label>
            </div>
            <button className="button primary" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Create product'}</button>
          </form>
        )}

        <div className="table-wrap">
          <table>
            <thead><tr><th>Product</th><th>Price</th><th>Quantity</th><th>Created</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td><strong>{product.product_name}</strong>{product.description && <span className="description">{product.description}</span>}</td>
                  <td>${Number(product.price).toFixed(2)}</td>
                  <td><span className={Number(product.quantity) === 0 ? 'quantity empty' : 'quantity'}>{product.quantity}</span></td>
                  <td>{product.created_at ? new Date(product.created_at).toLocaleDateString() : '—'}</td>
                  <td className="actions"><button className="button quiet" onClick={() => editProduct(product)}>Edit</button><button className="button danger" onClick={() => deleteProduct(product)}>Delete</button></td>
                </tr>
              ))}
              {products.length === 0 && <tr><td className="empty-state" colSpan="5">No products yet. Add one to get started.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
