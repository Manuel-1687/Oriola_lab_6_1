import { useEffect, useState } from 'react'
import {
  ArrowDownToLine,
  Box,
  CircleDollarSign,
  LogOut,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import './App.css'

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const TOKEN_KEY = 'stockroom_access_token'
const USER_KEY = 'stockroom_user'
const emptyDraft = { product_name: '', description: '', price: '', quantity: '' }

async function request(path, { token, ...options } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  const text = await response.text()
  const contentType = response.headers.get('content-type') || ''
  let result = {}
  if (contentType.includes('application/json')) {
    try {
      result = text ? JSON.parse(text) : {}
    } catch {
      result = {
        error: text.trimStart().startsWith('<')
          ? 'The API returned an HTML error page. Check its environment settings and database connection.'
          : 'The API returned invalid JSON.',
      }
    }
  } else {
    result = {
      error: contentType.includes('text/html')
        ? 'The API returned an HTML error page. Check its environment settings and database connection.'
        : text || 'The API returned an unreadable response.',
    }
  }

  if (!response.ok) {
    throw new Error(result.error || result.message || `Request failed (${response.status}).`)
  }
  return result
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0))
}

function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || '')
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null')
    } catch {
      return null
    }
  })
  const [products, setProducts] = useState([])
  const [setupRequired, setSetupRequired] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authBusy, setAuthBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (token) return

    let active = true
    request('/api/auth/setup-status')
      .then((result) => {
        if (active) setSetupRequired(result.setup_required)
      })
      .catch((reason) => {
        if (active) setError(reason.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [token])

  useEffect(() => {
    if (!token) return

    let active = true
    request('/api/products', { token })
      .then((result) => {
        if (active) setProducts(result.data || [])
      })
      .catch((reason) => {
        if (!active) return
        setError(reason.message)
        if (reason.message.toLowerCase().includes('unauthorized')) signOut()
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [token])

  function signOut() {
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(USER_KEY)
    setToken('')
    setUser(null)
    setProducts([])
    setNotice('')
    setError('')
  }

  async function submitAuth(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setAuthBusy(true)
    setError('')

    try {
      const isSetup = authMode === 'setup'
      const body = isSetup
        ? Object.fromEntries(['username', 'email', 'password'].map((key) => [key, form.get(key)]))
        : { login: form.get('login'), password: form.get('password') }
      const result = await request(isSetup ? '/api/auth/bootstrap' : '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      sessionStorage.setItem(TOKEN_KEY, result.token)
      sessionStorage.setItem(USER_KEY, JSON.stringify(result.user))
      setUser(result.user)
      setLoading(true)
      setToken(result.token)
      setSetupRequired(false)
      setNotice(isSetup ? 'Administrator account created.' : '')
    } catch (reason) {
      setError(reason.message)
    } finally {
      setAuthBusy(false)
    }
  }

  function openEditor(product = null) {
    setEditingProduct(product)
    setDraft(product ? {
      product_name: product.product_name,
      description: product.description || '',
      price: product.price,
      quantity: product.quantity,
    } : emptyDraft)
    setEditorOpen(true)
    setError('')
  }

  async function saveProduct(event) {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const path = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products'
      const result = await request(path, {
        token,
        method: editingProduct ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...draft,
          price: Number(draft.price),
          quantity: Number(draft.quantity),
        }),
      })
      setProducts((current) => editingProduct
        ? current.map((product) => product.id === editingProduct.id ? result.data : product)
        : [result.data, ...current])
      setNotice(editingProduct ? 'Product updated.' : 'Product added.')
      setEditorOpen(false)
    } catch (reason) {
      setError(reason.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteProduct(product) {
    if (!window.confirm(`Delete “${product.product_name}”? This cannot be undone.`)) return
    setError('')

    try {
      await request(`/api/products/${product.id}`, { token, method: 'DELETE' })
      setProducts((current) => current.filter((item) => item.id !== product.id))
      setNotice('Product deleted.')
    } catch (reason) {
      setError(reason.message)
    }
  }

  const visibleProducts = products.filter((product) =>
    `${product.product_name} ${product.description || ''}`.toLowerCase().includes(search.toLowerCase()),
  )
  const units = products.reduce((total, product) => total + Number(product.quantity), 0)
  const inventoryValue = products.reduce((total, product) => total + Number(product.price) * Number(product.quantity), 0)

  if (!token) {
    return (
      <main className="auth-shell">
        <section className="auth-brand" aria-label="Stockroom">
          <div className="brand-lockup"><span className="brand-mark"><Box size={20} /></span><span>Stockroom</span></div>
          <div className="auth-brand-copy">
            <span className="eyebrow">PRODUCT OPERATIONS</span>
            <h1>Keep your inventory in motion.</h1>
            <p>One clear view of what you have, what it is worth, and what needs attention.</p>
          </div>
          <span className="auth-footnote">LAVALUST API · INVENTORY CONSOLE</span>
        </section>
        <section className="auth-panel">
          <div className="auth-form-wrap">
            <span className="eyebrow">{authMode === 'setup' ? 'FIRST-TIME SETUP' : 'SECURE WORKSPACE'}</span>
            <h2>{authMode === 'setup' ? 'Create your admin account' : 'Welcome back'}</h2>
            <p className="auth-intro">{authMode === 'setup' ? 'Set up the first administrator to begin managing products.' : 'Sign in to manage your product inventory.'}</p>
            {error && <div className="alert alert-error" role="alert">{error}</div>}
            {loading && <div className="alert alert-neutral">Checking workspace status…</div>}
            <form className="auth-form" onSubmit={submitAuth}>
              {authMode === 'setup' ? (
                <>
                  <label>Username<input name="username" autoComplete="username" required maxLength="100" /></label>
                  <label>Email<input name="email" type="email" autoComplete="email" required maxLength="255" /></label>
                </>
              ) : (
                <label>Email or username<input name="login" autoComplete="username" required /></label>
              )}
              <label>Password<input name="password" type="password" autoComplete={authMode === 'setup' ? 'new-password' : 'current-password'} required minLength={authMode === 'setup' ? 12 : undefined} /></label>
              <button className="button button-primary auth-submit" type="submit" disabled={authBusy || loading}>
                {authBusy ? 'Please wait…' : authMode === 'setup' ? 'Create administrator' : 'Sign in'}
                <ArrowDownToLine size={17} aria-hidden="true" />
              </button>
            </form>
            {setupRequired && authMode !== 'setup' && (
              <button className="text-button setup-link" type="button" onClick={() => { setAuthMode('setup'); setError('') }}>
                Set up the first administrator
              </button>
            )}
            {authMode === 'setup' && (
              <button className="text-button setup-link" type="button" onClick={() => { setAuthMode('login'); setError('') }}>
                Back to sign in
              </button>
            )}
            <p className="api-caption">Connected to <span>{API_URL || 'Local Vite proxy to LavaLust'}</span></p>
          </div>
        </section>
      </main>
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand-lockup" href="#top" aria-label="Stockroom home"><span className="brand-mark"><Box size={20} /></span><span>Stockroom</span></a>
        <div className="sidebar-label">WORKSPACE</div>
        <div className="nav-item nav-item-active"><PackagePlus size={17} /><span>Products</span><span className="nav-count">{products.length}</span></div>
        <div className="sidebar-bottom">
          <div className="connection-state"><span className="status-dot" />API connected</div>
          <div className="user-chip"><span className="avatar">{(user?.username || 'U').slice(0, 1).toUpperCase()}</span><span className="user-meta"><strong>{user?.username || 'Account'}</strong><small>{user?.email || 'Signed in'}</small></span><button className="icon-button signout-button" type="button" title="Sign out" aria-label="Sign out" onClick={signOut}><LogOut size={17} /></button></div>
        </div>
      </aside>

      <main className="main-content" id="top">
        <header className="topbar"><div className="breadcrumb">Inventory <span>/</span> <strong>Products</strong></div><button className="icon-button mobile-signout" type="button" title="Sign out" aria-label="Sign out" onClick={signOut}><LogOut size={18} /></button><span className="topbar-date">PRODUCT CATALOG</span></header>
        <div className="page-content">
          <section className="page-heading">
            <div><span className="eyebrow">INVENTORY OVERVIEW</span><h1>Products</h1><p>Manage the items in your catalog.</p></div>
            <button className="button button-primary add-button" type="button" onClick={() => openEditor()}><Plus size={18} />Add product</button>
          </section>

          {error && <div className="alert alert-error page-alert" role="alert"><span>{error}</span><button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}><X size={16} /></button></div>}
          {notice && <div className="alert alert-success page-alert" role="status"><span>{notice}</span><button className="icon-button" aria-label="Dismiss message" onClick={() => setNotice('')}><X size={16} /></button></div>}

          <section className="metric-grid" aria-label="Inventory summary">
            <article className="metric"><span className="metric-icon metric-icon-green"><Box size={18} /></span><span className="metric-label">PRODUCTS</span><strong>{products.length}</strong><small>items in catalog</small></article>
            <article className="metric"><span className="metric-icon metric-icon-cyan"><PackagePlus size={18} /></span><span className="metric-label">UNITS IN STOCK</span><strong>{units.toLocaleString()}</strong><small>across all products</small></article>
            <article className="metric"><span className="metric-icon metric-icon-coral"><CircleDollarSign size={18} /></span><span className="metric-label">INVENTORY VALUE</span><strong>{formatMoney(inventoryValue)}</strong><small>based on current quantity</small></article>
          </section>

          <section className="catalog-section">
            <div className="catalog-toolbar"><div><h2>Product catalog</h2><p>{visibleProducts.length} {visibleProducts.length === 1 ? 'result' : 'results'}</p></div><label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" aria-label="Search products" /></label></div>
            {loading ? <div className="empty-state"><span className="loader" />Loading products…</div> : visibleProducts.length === 0 ? (
              <div className="empty-state"><span className="empty-icon"><Box size={22} /></span><strong>{search ? 'No matching products' : 'Your catalog is empty'}</strong><p>{search ? 'Try a different product name or description.' : 'Add a product to start building your inventory.'}</p>{!search && <button className="button button-secondary" type="button" onClick={() => openEditor()}><Plus size={17} />Add your first product</button>}</div>
            ) : (
              <div className="table-scroll"><table className="product-table"><thead><tr><th>PRODUCT</th><th>PRICE</th><th>QUANTITY</th><th>VALUE</th><th>ADDED</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
                {visibleProducts.map((product) => <tr key={product.id}>
                  <td><div className="product-cell"><span className="product-icon"><Box size={18} /></span><span><strong>{product.product_name}</strong><small>{product.description || 'No description'}</small></span></div></td>
                  <td className="money-cell">{formatMoney(product.price)}</td>
                  <td><span className={`quantity-pill ${Number(product.quantity) < 5 ? 'quantity-low' : ''}`}>{Number(product.quantity)} <small>units</small></span></td>
                  <td className="money-cell">{formatMoney(Number(product.price) * Number(product.quantity))}</td>
                  <td className="date-cell">{product.created_at ? new Date(product.created_at.replace(' ', 'T')).toLocaleDateString() : '—'}</td>
                  <td><div className="row-actions"><button className="icon-button" type="button" title={`Edit ${product.product_name}`} aria-label={`Edit ${product.product_name}`} onClick={() => openEditor(product)}><Pencil size={16} /></button><button className="icon-button icon-button-danger" type="button" title={`Delete ${product.product_name}`} aria-label={`Delete ${product.product_name}`} onClick={() => deleteProduct(product)}><Trash2 size={16} /></button></div></td>
                </tr>)}
              </tbody></table></div>
            )}
          </section>
          <footer className="page-footer"><span>STOCKROOM INVENTORY</span><span>All changes are saved to the API</span></footer>
        </div>
      </main>

      {editorOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditorOpen(false) }}>
        <section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="editor-title">
          <header className="modal-header"><div><span className="eyebrow">PRODUCT DETAILS</span><h2 id="editor-title">{editingProduct ? 'Edit product' : 'Add product'}</h2></div><button className="icon-button" type="button" aria-label="Close" onClick={() => setEditorOpen(false)}><X size={19} /></button></header>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <form className="product-form" onSubmit={saveProduct}>
            <label>Product name<input autoFocus required maxLength="100" value={draft.product_name} onChange={(event) => setDraft({ ...draft, product_name: event.target.value })} placeholder="e.g. Ceramic pour-over" /></label>
            <label>Description <span className="optional-label">OPTIONAL</span><textarea rows="3" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="A short product description" /></label>
            <div className="form-row"><label>Price<input type="number" min="0" step="0.01" required value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} placeholder="0.00" /></label><label>Quantity<input type="number" min="0" step="1" required value={draft.quantity} onChange={(event) => setDraft({ ...draft, quantity: event.target.value })} placeholder="0" /></label></div>
            <div className="modal-actions"><button className="button button-secondary" type="button" onClick={() => setEditorOpen(false)}>Cancel</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : editingProduct ? 'Save changes' : 'Add product'}</button></div>
          </form>
        </section>
      </div>}
    </div>
  )
}

export default App