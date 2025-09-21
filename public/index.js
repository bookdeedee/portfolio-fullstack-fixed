import React from 'react';
import { createRoot } from 'react-dom/client';
const h = React.createElement;

/* ---------- constants ---------- */
const LINE_OA_ID = '@084ltcnl';
const LINE_CHAT_URL = 'https://line.me/R/ti/p/%40084ltcnl'; // %40 = @

/* ---------- helpers ---------- */
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const dTH = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const load = (k, fb) => {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : fb;
  } catch {
    return fb;
  }
};

// สำหรับแปลงไฟล์เป็น dataURL (ยังใช้กับ avatar โปรไฟล์ในเครื่อง)
const toDataURL = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

// อัปโหลดรูปไปที่ /api/upload (ใช้ cookie auth)
async function uploadImage(file) {
  const fd = new FormData();
  fd.append('image', file);
  const r = await fetch('/api/upload', {
    method: 'POST',
    credentials: 'include',
    body: fd,
  });
  if (!r.ok) throw new Error('Upload failed: ' + (await r.text()));
  return r.json(); // { url }
}

function App() {
  /* ---------- states ---------- */
  const [tab, setTab] = React.useState(load('ui.tab', 'projects'));
  const [view, setView] = React.useState(load('ui.view', 'grid'));
  const [q, setQ] = React.useState('');

  const [projects, setProjects] = React.useState([]);
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [editProject, setEditProject] = React.useState(null);
  const [editItem, setEditItem] = React.useState(null);

  // Marketplace
  const [cart, setCart] = React.useState(load('cart', [])); // [{id, qty}]
  const [cartOpen, setCartOpen] = React.useState(false);
  const [checkoutOpen, setCheckoutOpen] = React.useState(false);

  // Admin auth (JWT cookie)
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [loginOpen, setLoginOpen] = React.useState(false);
  const [loginEmail, setLoginEmail] = React.useState('');
  const [loginPassword, setLoginPassword] = React.useState('');

  const [profile, setProfile] = React.useState(
    load('profile', {
      name: '<TONGDEE>',
      bio: 'ความพยายามครั้งที่ร้อย ดีกว่าคิดท้อถอยก่อนที่จะทำ',
      avatarDataUrl: '',
      links: {
        youtube: 'https://www.youtube.com/@TongDEEMelody',
        facebook: 'https://www.facebook.com/tong.tong.tong.375006',
        line: LINE_CHAT_URL,
      },
    })
  );
  const [toasts, setToasts] = React.useState([]);

  /* ---------- API ---------- */
  const api = {
    async me() {
      const r = await fetch('/api/admin/me', { credentials: 'include' });
      return r.json();
    },
    async login(email, password) {
      const r = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      if (!r.ok) throw new Error('เข้าสู่ระบบไม่สำเร็จ');
      return r.json();
    },
    async logout() {
      await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
    },

    async listProjects() {
      const r = await fetch('/api/projects');
      return r.json();
    },
    async createProject(p) {
      const r = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(p),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    async updateProject(p) {
      const r = await fetch('/api/projects/' + p.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(p),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    async deleteProject(id) {
      const r = await fetch('/api/projects/' + id, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!r.ok) throw new Error(await r.text());
    },

    async listItems() {
      const r = await fetch('/api/items');
      return r.json();
    },
    async createItem(p) {
      const r = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(p),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    async updateItem(p) {
      const r = await fetch('/api/items/' + p.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(p),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    async deleteItem(id) {
      const r = await fetch('/api/items/' + id, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!r.ok) throw new Error(await r.text());
    },
    async toggleMarket(type, id, enabled) {
      const r = await fetch('/api/market/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type, id, enabled }),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  };

  /* ---------- effects ---------- */
  React.useEffect(() => {
    (async () => {
      try {
        const [ps, it, me] = await Promise.all([
          api.listProjects(),
          api.listItems(),
          api.me().catch(() => ({ authenticated: false })),
        ]);
        setProjects(ps);
        setItems(it);
        setIsAdmin(!!me.authenticated);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  React.useEffect(() => save('ui.view', view), [view]);
  React.useEffect(() => save('ui.tab', tab), [tab]);
  React.useEffect(() => save('profile', profile), [profile]);
  React.useEffect(() => save('cart', cart), [cart]);

  /* ---------- derived ---------- */
  const filteredProjects = React.useMemo(() => {
    const kw = q.trim().toLowerCase();
    return !kw
      ? projects
      : projects.filter((p) =>
          [p.title, p.description, (p.tags || []).join(' ')]
            .join(' ')
            .toLowerCase()
            .includes(kw)
        );
  }, [projects, q]);

  const filteredItems = React.useMemo(() => {
    const kw = q.trim().toLowerCase();
    return !kw
      ? items
      : items.filter((p) =>
          [p.title, p.description, String(p.price || '')]
            .join(' ')
            .toLowerCase()
            .includes(kw)
        );
  }, [items, q]);

  const cartCount = React.useMemo(() => cart.reduce((s, x) => s + x.qty, 0), [cart]);
  const cartLines = React.useMemo(
    () =>
      cart
        .map((c) => {
          const it = items.find((x) => x.id === c.id);
          if (!it) return null;
          return { ...it, qty: c.qty, lineTotal: (it.price || 0) * c.qty };
        })
        .filter(Boolean),
    [cart, items]
  );
  const cartTotal = React.useMemo(
    () => cartLines.reduce((s, x) => s + (x.lineTotal || 0), 0),
    [cartLines]
  );

  /* ---------- ui helpers ---------- */
  function toast(msg) {
    const id = uid();
    setToasts((v) => [...v, { id, msg }]);
    setTimeout(() => setToasts((v) => v.filter((t) => t.id !== id)), 2500);
  }

  // เปิดฟอร์มเพิ่มโครงการ
  function openNewProject() {
    const now = new Date().toISOString().slice(0, 10);
    setEditProject({
      id: uid(),
      title: '',
      description: '',
      dateISO: now,
      imageDataUrl: '',
      tags: [],
      links: [
        { label: 'ดูโปรเจกต์', url: '' },
        { label: 'GitHub', url: '' },
      ],
      _isNew: true,
    });
  }
  // เปิดฟอร์มเพิ่มสินค้า
  function openNewItem(prefill) {
    const now = new Date().toISOString().slice(0, 10);
    setEditItem({
      id: uid(),
      title: prefill?.title || '',
      description: prefill?.description || '',
      price: prefill?.price ?? 0,
      dateISO: now,
      imageDataUrl: prefill?.imageDataUrl || '',
      _isNew: true,
    });
  }

  // แปลงโครงการ -> เตรียมลงตลาด (เปิดฟอร์มสินค้า)
  function listProjectToMarket(p) {
    openNewItem({
      title: p.title,
      description: p.description || '',
      imageDataUrl: p.imageDataUrl || '',
      price: 0,
    });
    toast('เตรียมลงขายจากโครงการ: ' + (p.title || ''));
  }

  async function delProject(id) {
    if (!confirm('ลบโปรเจกต์นี้?')) return;
    await api.deleteProject(id);
    setProjects((v) => v.filter((x) => x.id !== id));
    toast('ลบแล้ว');
  }
  async function delItem(id) {
    if (!confirm('ลบรายการนี้?')) return;
    await api.deleteItem(id);
    setItems((v) => v.filter((x) => x.id !== id));
    setCart((c) => c.filter((l) => l.id !== id));
    toast('ลบแล้ว');
  }

  /* ---------- cart actions ---------- */
  function addToCart(item, qty = 1) {
    if (!item || !item.id) return;
    if (!item.price && item.price !== 0) {
      toast('สินค้าไม่มีราคา');
      return;
    }
    setCart((c) => {
      const i = c.findIndex((x) => x.id === item.id);
      if (i >= 0) {
        const copy = c.slice();
        copy[i] = { ...copy[i], qty: copy[i].qty + qty };
        return copy;
      }
      return [...c, { id: item.id, qty }];
    });
    toast('ใส่ตะกร้าแล้ว');
  }
  function buyNow(item) {
    addToCart(item, 1);
    setCartOpen(true);
  }
  function incCart(id) {
    setCart((c) => c.map((x) => (x.id === id ? { ...x, qty: x.qty + 1 } : x)));
  }
  function decCart(id) {
    setCart((c) =>
      c
        .map((x) => (x.id === id ? { ...x, qty: Math.max(1, x.qty - 1) } : x))
        .filter((x) => x.qty > 0)
    );
  }
  function removeCart(id) {
    setCart((c) => c.filter((x) => x.id !== id));
  }
  function clearCart() {
    setCart([]);
  }

  /* ---------- auth actions ---------- */
  async function doLogin() {
    try {
      await api.login(loginEmail.trim(), loginPassword);
      setLoginOpen(false);
      setLoginEmail('');
      setLoginPassword('');
      const me = await api.me();
      setIsAdmin(!!me.authenticated);
      toast('เข้าสู่ระบบสำเร็จ');
    } catch (e) {
      alert(e.message || 'เข้าสู่ระบบไม่สำเร็จ');
    }
  }
  async function doLogout() {
    await api.logout();
    setIsAdmin(false);
    toast('ออกจากระบบแล้ว');
  }

  /* ---------- Header / Profile ---------- */
  const Header = h('div', { className: 'header' }, [
    h('div', { className: 'brand' }, [
      h(
        'div',
        {
          className: 'logo',
          style: profile.avatarDataUrl
            ? { backgroundImage: `url(${profile.avatarDataUrl})` }
            : {},
        },
        null
      ),
      h('div', { className: 'title' }, 'My Portfolio'),
    ]),
    h('div', { className: 'contact-row' }, [
      profile.links?.youtube
        ? h('a', {
            className: 'yt',
            href: profile.links.youtube,
            target: '_blank',
            rel: 'noreferrer',
            title: 'YouTube',
          })
        : null,
      profile.links?.facebook
        ? h('a', {
            className: 'fb',
            href: profile.links.facebook,
            target: '_blank',
            rel: 'noreferrer',
            title: 'Facebook',
          })
        : null,
      // LINE OA
      h(
        'a',
        {
          className: 'line',
          href: profile.links?.line || LINE_CHAT_URL,
          target: '_blank',
          rel: 'noreferrer',
          title: `LINE ${LINE_OA_ID}`,
        },
        'LINE'
      ),

      // ปุ่มตะกร้า
      h(
        'button',
        { className: 'btn btn-cart', onClick: () => setCartOpen(true), title: 'ตะกร้า' },
        ['🛒', cartCount ? h('span', { className: 'badge' }, String(cartCount)) : null]
      ),

      // ปุ่มเข้าสู่ระบบ/ออกจากระบบ และ การตั้งค่า (เฉพาะแอดมิน)
      isAdmin
        ? h('button', { className: 'btn', onClick: () => setSettingsOpen(true) }, 'การตั้งค่า')
        : null,
      isAdmin
        ? h('button', { className: 'btn', onClick: doLogout }, 'ออกจากระบบ')
        : h('button', { className: 'btn', onClick: () => setLoginOpen(true) }, 'เข้าสู่ระบบ'),
    ]),
  ]);

  const ProfileRow = h('div', { className: 'profile' }, [
    h('div', {
      className: 'avatar',
      style: profile.avatarDataUrl
        ? { backgroundImage: `url(${profile.avatarDataUrl})` }
        : {},
    }),
    h('div', { className: 'title' }, [h('h1', null, profile.name), h('p', null, profile.bio)]),
  ]);

  const Tabs = h('div', { className: 'tabs' }, [
    h(
      'button',
      { className: 'tab ' + (tab === 'projects' ? 'active' : ''), onClick: () => setTab('projects') },
      'โครงการต่างๆ'
    ),
    h(
      'button',
      { className: 'tab ' + (tab === 'market' ? 'active' : ''), onClick: () => setTab('market') },
      'ตลาดซื้อขาย'
    ),
  ]);

  const Toolbar = h('div', { className: 'toolbar' }, [
    h('label', { className: 'search' }, [
      h('div', { className: 'icon' }, '🔎'),
      h('input', {
        placeholder: 'Search…',
        value: q,
        onChange: (e) => setQ(e.target.value),
      }),
    ]),
    h('div', { className: 'view-toggle' }, [
      h(
        'button',
        { className: view === 'grid' ? 'active' : '', onClick: () => setView('grid') },
        'Grid'
      ),
      h(
        'button',
        { className: view === 'table' ? 'active' : '', onClick: () => setView('table') },
        'List'
      ),
    ]),
  ]);

  /* ---------- Projects UI ---------- */
  const ProjectCards = h(
    'div',
    { className: 'grid' },
    filteredProjects.map((p) => {
      const primaryLink = (p.links || [])[0]?.url || '';
      const githubLink =
        (p.links || []).find((l) => /github\.com/i.test(l.url || ''))?.url || '';

      return h('article', { key: p.id, className: 'card card-elevated', tabIndex: 0 }, [
        p.imageDataUrl
          ? h('div', { className: 'card-hero' }, h('img', { src: p.imageDataUrl, alt: p.title || '', loading: 'lazy' }))
          : h('div', { className: 'card-hero skeleton' }),
        h('div', { className: 'card-body' }, [
          h('div', { className: 'card-date' }, dTH(p.dateISO || '')),
          h('h3', { className: 'card-title' }, p.title),
          h('p', { className: 'card-desc' }, p.description),
          p.tags?.length
            ? h(
                'div',
                { className: 'chips' },
                p.tags.map((t, i) => h('span', { key: i, className: 'chip' }, t))
              )
            : null,
        ]),
        h('div', { className: 'card-footer' }, [
          primaryLink
            ? h(
                'a',
                { className: 'btn btn-primary btn-cta', href: primaryLink, target: '_blank', rel: 'noreferrer' },
                'ดูโปรเจกต์'
              )
            : h('button', { className: 'btn btn-primary btn-cta', disabled: true }, 'ดูโปรเจกต์'),
          h('div', { className: 'card-actions' }, [
            githubLink
              ? h('a', { className: 'btn btn-ghost', href: githubLink, target: '_blank', rel: 'noreferrer' }, 'GitHub')
              : null,
            isAdmin && h('button', { className: 'btn btn-ghost', onClick: () => listProjectToMarket(p) }, 'ลงขาย'),
            isAdmin && h('button', { className: 'btn btn-ghost', onClick: () => setEditProject(p) }, 'แก้ไข'),
            isAdmin && h('button', { className: 'btn btn-ghost', onClick: () => delProject(p.id) }, 'ลบ'),
          ].filter(Boolean)),
        ]),
      ]);
    })
  );

  const ProjectTable = h('div', { className: 'table' }, [
    h('table', null, [
      h(
        'thead',
        null,
        h('tr', null, [h('th', null, 'วันที่'), h('th', null, 'ชื่อ'), h('th', null, 'คำอธิบาย'), h('th', null, 'แท็ก'), h('th', null, '')])
      ),
      h(
        'tbody',
        null,
        filteredProjects.map((p) =>
          h('tr', { key: p.id }, [
            h('td', null, dTH(p.dateISO || '')),
            h('td', null, p.title),
            h('td', null, p.description),
            h('td', null, (p.tags || []).join(', ')),
            h('td', null, [
              h(
                'a',
                { href: p.links?.[0]?.url || '#', target: '_blank', rel: 'noreferrer', className: 'btn' },
                'ดูโปรเจกต์'
              ),
              ' ',
              isAdmin && h('button', { className: 'btn', onClick: () => listProjectToMarket(p) }, 'ลงขาย'),
              ' ',
              isAdmin && h('button', { className: 'btn', onClick: () => setEditProject(p) }, 'แก้ไข'),
              ' ',
              isAdmin && h('button', { className: 'btn', onClick: () => delProject(p.id) }, 'ลบ'),
            ].filter(Boolean)),
          ])
        )
      ),
    ]),
  ]);

  /* ---------- Items UI (Marketplace) ---------- */
  const ItemCards = h(
    'div',
    { className: 'grid' },
    filteredItems
      .slice()
      .sort((a, b) => String(b.dateISO || '').localeCompare(String(a.dateISO || '')))
      .map((it) =>
        h('article', { key: it.id, className: 'card card-elevated' }, [
          it.imageDataUrl
            ? h('div', { className: 'card-hero' }, h('img', { src: it.imageDataUrl, alt: it.title || '', loading: 'lazy' }))
            : h('div', { className: 'card-hero skeleton' }),
          h('div', { className: 'card-body' }, [
            h('div', { className: 'card-date' }, dTH(it.dateISO || '')),
            h('h3', { className: 'card-title' }, it.title),
            h('p', { className: 'card-desc' }, it.description),
            h('div', { className: 'chips' }, [
              h('span', { className: 'chip price' }, it.price != null ? it.price.toFixed(2) + ' THB' : '—'),
            ]),
          ]),
          h('div', { className: 'card-footer' }, [
            h('div', { className: 'buy-actions' }, [
              h(
                'button',
                {
                  className: 'btn btn-primary',
                  disabled: it.price == null,
                  onClick: () => buyNow(it),
                  title: 'ซื้อเลย',
                },
                'ซื้อเลย'
              ),
              h(
                'button',
                {
                  className: 'btn btn-ghost',
                  disabled: it.price == null,
                  onClick: () => addToCart(it, 1),
                  title: 'ใส่ตะกร้า',
                },
                'ใส่ตะกร้า'
              ),
            ]),
            h('div', { className: 'card-actions' }, [
              isAdmin && h('button', { className: 'btn btn-ghost', onClick: () => setEditItem(it) }, 'แก้ไข'),
              isAdmin && h('button', { className: 'btn btn-ghost', onClick: () => delItem(it.id) }, 'ลบ'),
            ].filter(Boolean)),
          ]),
        ])
      )
  );

  const ItemTable = h('div', { className: 'table' }, [
    h('table', null, [
      h(
        'thead',
        null,
        h('tr', null, [h('th', null, 'วันที่'), h('th', null, 'ชื่อสินค้า'), h('th', null, 'คำอธิบาย'), h('th', null, 'ราคา'), h('th', null, '')])
      ),
      h(
        'tbody',
        null,
        filteredItems.map((it) =>
          h('tr', { key: it.id }, [
            h('td', null, dTH(it.dateISO || '')),
            h('td', null, it.title),
            h('td', null, it.description),
            h('td', null, it.price != null ? it.price.toFixed(2) : '-'),
            h('td', null, [
              h(
                'button',
                { className: 'btn', disabled: it.price == null, onClick: () => buyNow(it) },
                'ซื้อเลย'
              ),
              ' ',
              h(
                'button',
                { className: 'btn', disabled: it.price == null, onClick: () => addToCart(it, 1) },
                'ใส่ตะกร้า'
              ),
              ' ',
              isAdmin && h('button', { className: 'btn', onClick: () => setEditItem(it) }, 'แก้ไข'),
              ' ',
              isAdmin && h('button', { className: 'btn', onClick: () => delItem(it.id) }, 'ลบ'),
            ].filter(Boolean)),
          ])
        )
      ),
    ]),
  ]);

  /* ---------- Modals: Settings / Project / Item ---------- */
  const SettingsModal = !settingsOpen
    ? null
    : h(
        'div',
        { className: 'modal-overlay' },
        h('div', { className: 'modal' }, [
          h('div', { className: 'modal-header' }, [
            h('div', { className: 'modal-title' }, 'การตั้งค่า'),
            h('button', { className: 'btn', onClick: () => setSettingsOpen(false) }, '✕'),
          ]),
          h('div', { className: 'modal-content' }, [
            h('div', { className: 'form-row' }, [
              h('label', null, 'ชื่อที่แสดง'),
              h('input', {
                className: 'input',
                value: profile.name,
                onChange: (e) => setProfile({ ...profile, name: e.target.value }),
              }),
            ]),
            h('div', { className: 'form-row' }, [
              h('label', null, 'ประวัติย่อ'),
              h('textarea', {
                className: 'input',
                rows: 3,
                value: profile.bio,
                onChange: (e) => setProfile({ ...profile, bio: e.target.value }),
              }),
            ]),
            h('div', { className: 'form-row' }, [
              h('label', null, 'รูปโปรไฟล์'),
              h('div', null, [
                h('div', {
                  className: 'avatar-preview',
                  style: profile.avatarDataUrl ? { backgroundImage: `url(${profile.avatarDataUrl})` } : {},
                }),
                h('div', { style: { height: 8 } }),
                h(
                  'label',
                  { className: 'file' },
                  [
                    'เลือกไฟล์ ',
                    h('input', {
                      type: 'file',
                      accept: 'image/*',
                      style: { display: 'none' },
                      onChange: async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const data = await toDataURL(f);
                        setProfile((p) => ({ ...p, avatarDataUrl: data }));
                      },
                    }),
                  ]
                ),
                h('button', { className: 'btn', onClick: () => setProfile((p) => ({ ...p, avatarDataUrl: '' })) }, 'ไม่ได้เลือกไฟล์'),
              ]),
            ]),
            h('div', { className: 'form-row' }, [
              h('label', null, 'URL ของ YouTube'),
              h('input', {
                className: 'input',
                type: 'url',
                value: profile.links?.youtube || '',
                onChange: (e) => setProfile({ ...profile, links: { ...profile.links, youtube: e.target.value } }),
              }),
            ]),
            h('div', { className: 'form-row' }, [
              h('label', null, 'URL ของ Facebook'),
              h('input', {
                className: 'input',
                type: 'url',
                value: profile.links?.facebook || '',
                onChange: (e) => setProfile({ ...profile, links: { ...profile.links, facebook: e.target.value } }),
              }),
            ]),
            h('div', { className: 'form-row' }, [
              h('label', null, `URL ของ LINE (${LINE_OA_ID})`),
              h('input', {
                className: 'input',
                type: 'url',
                value: profile.links?.line || LINE_CHAT_URL,
                onChange: (e) => setProfile({ ...profile, links: { ...profile.links, line: e.target.value } }),
              }),
            ]),
          ]),
          h('div', { className: 'modal-actions' }, [
            h('button', { className: 'btn', onClick: () => setSettingsOpen(false) }, 'ยกเลิก'),
            h(
              'button',
              {
                className: 'btn-primary',
                onClick: () => {
                  setSettingsOpen(false);
                  toast('บันทึกการตั้งค่าแล้ว');
                },
              },
              'บันทึกการตั้งค่า'
            ),
          ]),
        ])
      );

  const ProjectModal = !editProject
    ? null
    : h(
        'div',
        { className: 'modal-overlay' },
        h('div', { className: 'modal' }, [
          h('div', { className: 'modal-header' }, [
            h('div', { className: 'modal-title' }, editProject._isNew ? 'เพิ่มโครงการใหม่' : 'แก้ไขโครงการ'),
            h('button', { className: 'btn', onClick: () => setEditProject(null) }, '✕'),
          ]),
          h('div', { className: 'modal-content' }, [
            h('div', { className: 'form-row' }, [
              h('label', null, 'ชื่อโครงการ'),
              h('input', {
                className: 'input',
                value: editProject.title,
                onChange: (e) => setEditProject({ ...editProject, title: e.target.value }),
              }),
            ]),
            h('div', { className: 'form-row' }, [
              h('label', null, 'คำอธิบาย'),
              h('textarea', {
                className: 'input',
                rows: 4,
                value: editProject.description || '',
                onChange: (e) => setEditProject({ ...editProject, description: e.target.value }),
              }),
            ]),
            h('div', { className: 'form-row' }, [
              h('label', null, 'URL ของโครงการ'),
              h('input', {
                className: 'input',
                type: 'url',
                value: editProject.links?.[0]?.url || '',
                onChange: (e) => {
                  const l = [{ label: 'ดูโปรเจกต์', url: e.target.value }, ...(editProject.links?.slice(1) || [])];
                  setEditProject({ ...editProject, links: l });
                },
              }),
            ]),
            h('div', { className: 'form-row' }, [
              h('label', null, 'ภาพโครงการ'),
              h('div', null, [
                editProject.imageDataUrl
                  ? h('img', { className: 'avatar-preview', src: editProject.imageDataUrl, alt: 'preview' })
                  : h('div', { className: 'avatar-preview' }),
                h('div', { style: { height: 8 } }),
                h(
                  'label',
                  { className: 'file' },
                  [
                    'เลือกไฟล์ ',
                    h('input', {
                      type: 'file',
                      accept: 'image/*',
                      style: { display: 'none' },
                      onChange: async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        try {
                          const { url } = await uploadImage(f);
                          setEditProject({ ...editProject, imageDataUrl: url });
                        } catch (err) {
                          alert(err.message);
                        }
                      },
                    }),
                  ]
                ),
                h('button', { className: 'btn', onClick: () => setEditProject({ ...editProject, imageDataUrl: '' }) }, 'ไม่ได้เลือกไฟล์'),
              ]),
            ]),
            h('div', { className: 'form-row' }, [
              h('label', null, 'URL ของ GitHub (ทางเลือก)'),
              h('input', {
                className: 'input',
                type: 'url',
                value: editProject.links?.[1]?.url || '',
                onChange: (e) => {
                  const l = [editProject.links?.[0] || { label: 'ดูโปรเจกต์', url: '' }, { label: 'GitHub', url: e.target.value }];
                  setEditProject({ ...editProject, links: l });
                },
              }),
            ]),
            h('div', { className: 'form-row' }, [
              h('label', null, 'แท็ก (คั่นด้วยจุลภาค)'),
              h('input', {
                className: 'input',
                value: (editProject.tags || []).join(', '),
                onChange: (e) =>
                  setEditProject({
                    ...editProject,
                    tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  }),
              }),
            ]),
            h('div', { className: 'form-row' }, [
              h('label', null, 'วันที่'),
              h('input', {
                className: 'input',
                type: 'date',
                value: editProject.dateISO || '',
                onChange: (e) => setEditProject({ ...editProject, dateISO: e.target.value }),
              }),
            ]),
          ]),
          h('div', { className: 'modal-actions' }, [
            h('button', { className: 'btn', onClick: () => setEditProject(null) }, 'ยกเลิก'),
            h(
              'button',
              {
                className: 'btn-primary',
                onClick: async () => {
                  if (!editProject.title?.trim()) {
                    alert('กรุณากรอกชื่อโครงการ');
                    return;
                  }
                  let saved;
                  if (editProject._isNew) {
                    saved = await api.createProject({ ...editProject, _isNew: undefined });
                    setProjects((v) => [saved, ...v]);
                  } else {
                    saved = await api.updateProject({ ...editProject, _isNew: undefined });
                    setProjects((v) => v.map((x) => (x.id === saved.id ? saved : x)));
                  }
                  setEditProject(null);
                  toast(editProject._isNew ? 'เพิ่มโครงการแล้ว' : 'บันทึกโครงการ');
                },
              },
              'บันทึกโครงการ'
            ),
          ]),
        ])
      );

  const ItemModal = !editItem
    ? null
    : h(
        'div',
        { className: 'modal-overlay' },
        h('div', { className: 'modal' }, [
          h('div', { className: 'modal-header' }, [
            h('div', { className: 'modal-title' }, editItem._isNew ? 'เพิ่มรายการใหม่' : 'แก้ไขรายการ'),
            h('button', { className: 'btn', onClick: () => setEditItem(null) }, '✕'),
          ]),
          h('div', { className: 'modal-content' }, [
            h('div', { className: 'form-row' }, [
              h('label', null, 'ชื่อสินค้า'),
              h('input', {
                className: 'input',
                value: editItem.title,
                onChange: (e) => setEditItem({ ...editItem, title: e.target.value }),
              }),
            ]),
            h('div', { className: 'form-row' }, [
              h('label', null, 'คำอธิบาย'),
              h('textarea', {
                className: 'input',
                rows: 4,
                value: editItem.description || '',
                onChange: (e) => setEditItem({ ...editItem, description: e.target.value }),
              }),
            ]),
            h('div', { className: 'form-row' }, [
              h('label', null, 'ราคา (THB)'),
              h('input', {
                className: 'input',
                type: 'number',
                step: '0.01',
                value: editItem.price == null ? '' : editItem.price,
                onChange: (e) =>
                  setEditItem({ ...editItem, price: e.target.value === '' ? null : Number(e.target.value) }),
              }),
            ]),
            h('div', { className: 'form-row' }, [
              h('label', null, 'รูปภาพสินค้า'),
              h('div', null, [
                editItem.imageDataUrl
                  ? h('img', { className: 'avatar-preview', src: editItem.imageDataUrl, alt: 'preview' })
                  : h('div', { className: 'avatar-preview' }),
                h('div', { style: { height: 8 } }), /* <-- แก้บรรทัดนี้ */
                h(
                  'label',
                  { className: 'file' },
                  [
                    'เลือกไฟล์ ',
                    h('input', {
                      type: 'file',
                      accept: 'image/*',
                      style: { display: 'none' },
                      onChange: async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        try {
                          const { url } = await uploadImage(f);
                          setEditItem({ ...editItem, imageDataUrl: url });
                        } catch (err) {
                          alert(err.message);
                        }
                      },
                    }),
                  ]
                ),
                h('button', { className: 'btn', onClick: () => setEditItem({ ...editItem, imageDataUrl: '' }) }, 'ไม่ได้เลือกไฟล์'),
              ]),
            ]),
          ]), // modal-content
          h('div', { className: 'modal-actions' }, [
            h('button', { className: 'btn', onClick: () => setEditItem(null) }, 'ยกเลิก'),
            h(
              'button',
              {
                className: 'btn-primary',
                onClick: async () => {
                  if (!editItem.title?.trim()) {
                    alert('กรุณากรอกชื่อสินค้า');
                    return;
                  }
                  let saved;
                  if (editItem._isNew) {
                    saved = await api.createItem({ ...editItem, _isNew: undefined });
                    setItems((v) => [saved, ...v]);
                  } else {
                    saved = await api.updateItem({ ...editItem, _isNew: undefined });
                    setItems((v) => v.map((x) => (x.id === saved.id ? saved : x)));
                  }
                  setEditItem(null);
                  toast(editItem._isNew ? 'เพิ่มรายการแล้ว' : 'บันทึกรายการ');
                },
              },
              'บันทึกรายการ'
            ),
          ]),
        ])
      );

  /* ---------- Cart Modal & Checkout ---------- */
  const CartModal = !cartOpen
    ? null
    : h(
        'div',
        { className: 'modal-overlay' },
        h('div', { className: 'modal cart-modal' }, [
          h('div', { className: 'modal-header' }, [
            h('div', { className: 'modal-title' }, 'ตะกร้าสินค้า'),
            h('button', { className: 'btn', onClick: () => setCartOpen(false) }, '✕'),
          ]),
          h(
            'div',
            { className: 'modal-content' },
            cartLines.length
              ? cartLines.map((line) =>
                  h('div', { key: line.id, className: 'cart-line' }, [
                    line.imageDataUrl
                      ? h('img', { className: 'cart-thumb', src: line.imageDataUrl, alt: line.title || '' })
                      : h('div', { className: 'cart-thumb skeleton' }),
                    h('div', { className: 'cart-info' }, [
                      h('div', { className: 'cart-title' }, line.title),
                      h('div', { className: 'cart-price' }, (line.price || 0).toFixed(2) + ' THB'),
                      h('div', { className: 'cart-qty' }, [
                        h('button', { className: 'btn btn-sm', onClick: () => decCart(line.id) }, '−'),
                        h('span', { className: 'qty' }, String(line.qty)),
                        h('button', { className: 'btn btn-sm', onClick: () => incCart(line.id) }, '+'),
                        h('button', { className: 'btn btn-ghost btn-sm', onClick: () => removeCart(line.id) }, 'ลบ'),
                      ]),
                    ]),
                    h('div', { className: 'cart-line-total' }, line.lineTotal.toFixed(2) + ' THB'),
                  ])
                )
              : h('div', { className: 'empty' }, 'ยังไม่มีสินค้าในตะกร้า')
          ),
          h('div', { className: 'modal-actions cart-actions' }, [
            h('div', { className: 'cart-sum' }, 'รวมทั้งหมด: ' + cartTotal.toFixed(2) + ' THB'),
            h('div', null, [
              h('button', { className: 'btn', onClick: clearCart, disabled: !cartLines.length }, 'ล้างตะกร้า'),
              ' ',
              // ปุ่มชำระเงิน -> เปิดแชต LINE
              h(
                'a',
                {
                  className: 'btn-primary',
                  href: profile.links?.line || LINE_CHAT_URL,
                  target: '_blank',
                  rel: 'noreferrer',
                },
                'ชำระเงิน (แชต LINE)'
              ),
            ]),
          ]),
        ])
      );

  const CheckoutModal = !checkoutOpen
    ? null
    : null; // ไม่ใช้แล้ว (เราไป LINE โดยตรงจากตะกร้า)

  /* ---------- Login Modal ---------- */
  const LoginModal = !loginOpen
    ? null
    : h(
        'div',
        { className: 'modal-overlay' },
        h('div', { className: 'modal' }, [
          h('div', { className: 'modal-header' }, [
            h('div', { className: 'modal-title' }, 'เข้าสู่ระบบแอดมิน'),
            h('button', { className: 'btn', onClick: () => setLoginOpen(false) }, '✕'),
          ]),
          h('div', { className: 'modal-content' }, [
            h('div', { className: 'form-row' }, [
              h('label', null, 'อีเมล'),
              h('input', {
                className: 'input',
                type: 'email',
                value: loginEmail,
                onChange: (e) => setLoginEmail(e.target.value),
                placeholder: 'bookdeedee.tong@gmail.com',
              }),
            ]),
            h('div', { className: 'form-row' }, [
              h('label', null, 'รหัสผ่าน'),
              h('input', {
                className: 'input',
                type: 'password',
                value: loginPassword,
                onChange: (e) => setLoginPassword(e.target.value),
                placeholder: '••••••',
              }),
            ]),
          ]),
          h('div', { className: 'modal-actions' }, [
            h('button', { className: 'btn', onClick: () => setLoginOpen(false) }, 'ยกเลิก'),
            h('button', { className: 'btn-primary', onClick: doLogin }, 'เข้าสู่ระบบ'),
          ]),
        ])
      );

  /* ---------- assemble ---------- */
  const Body =
    tab === 'projects'
      ? view === 'grid'
        ? ProjectCards
        : ProjectTable
      : view === 'grid'
      ? ItemCards
      : ItemTable;

  // FAB: เฉพาะแอดมินเท่านั้นที่เห็นปุ่มเพิ่ม
  const AddButton =
    isAdmin &&
    h(
      'button',
      {
        className: 'fab',
        title: 'เพิ่ม',
        onClick: () => (tab === 'projects' ? openNewProject() : openNewItem()),
      },
      '+'
    );

  const Toasts = h(
    'div',
    { className: 'toast-wrap' },
    toasts.map((t) => h('div', { key: t.id, className: 'toast' }, t.msg))
  );

  return h('div', { className: 'container' }, [
    Header,
    ProfileRow,
    Tabs,
    Toolbar,
    tab === 'projects'
      ? filteredProjects.length
        ? Body
        : h('div', { className: 'empty' }, loading ? 'กำลังโหลด…' : 'ไม่พบโครงการ')
      : filteredItems.length
      ? Body
      : h('div', { className: 'empty' }, loading ? 'กำลังโหลด…' : 'ไม่พบรายการ'),
    h('div', { className: 'footerpad' }),
    AddButton,
    SettingsModal,
    ProjectModal,
    ItemModal,
    CartModal,
    CheckoutModal,
    LoginModal,
    Toasts,
  ]);
}

/* ---------- mount ---------- */
const root = createRoot(document.getElementById('root'));
root.render(h(App));
