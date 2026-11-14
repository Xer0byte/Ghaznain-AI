export interface StarterTemplate {
  id: string;
  title: string;
  category: 'Commerce' | 'Operations' | 'Finance' | 'Customer' | 'Developer';
  description: string;
  language: string;
  code: string;
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'crossborder-store',
    title: 'Cross-Border E-Commerce Storefront',
    category: 'Commerce',
    description: 'Multi-currency catalog (USD/PKR/EUR/CNY), slide-out cart drawer, live totals, and checkout flow.',
    language: 'html',
    code: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Storefront — Multi-Currency Commerce</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    .tabular { font-variant-numeric: tabular-nums; }
  </style>
</head>
<body class="bg-neutral-950 text-neutral-100 min-h-screen">
  <header class="border-b border-neutral-800 px-6 py-4 flex items-center justify-between gap-6 sticky top-0 bg-neutral-950/90 backdrop-blur z-30">
    <span class="text-lg font-bold tracking-tight text-white whitespace-nowrap">Atelier Hardware</span>
    <nav class="hidden md:flex items-center gap-6 text-sm text-neutral-400">
      <a href="#catalog" class="hover:text-white transition-colors">Catalog</a>
      <a href="#shipping" class="hover:text-white transition-colors">Global Shipping</a>
    </nav>
    <div class="flex items-center gap-3">
      <select id="currencySelect" onchange="renderAll()" class="bg-neutral-900 border border-neutral-800 text-xs rounded-lg px-2.5 py-2 text-neutral-200 outline-none">
        <option value="USD">USD ($)</option>
        <option value="PKR">PKR (Rs)</option>
        <option value="EUR">EUR (€)</option>
        <option value="CNY">CNY (¥)</option>
      </select>
      <button onclick="toggleCart(true)" class="px-4 py-2 rounded-lg bg-[#00ff9d] text-black text-xs font-bold hover:opacity-90 transition tabular">
        Cart (<span id="cartCount">0</span>)
      </button>
    </div>
  </header>

  <main class="max-w-6xl mx-auto px-6 py-12">
    <section class="mb-12">
      <p class="text-xs font-medium text-neutral-400 mb-2">Direct Factory · Global Dispatch · 14-Day Returns</p>
      <h1 class="text-3xl md:text-5xl font-bold tracking-tight text-white max-w-2xl">Precision workspace tools built for daily operators.</h1>
    </section>

    <section id="catalog" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"></section>

    <section id="shipping" class="mt-16 border-t border-neutral-800 pt-10 grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
      <div>
        <h3 class="font-semibold text-white mb-1">Cross-Border Clearance</h3>
        <p class="text-neutral-400">Duties calculated upfront for US, EU, ASEAN, and Pakistan routes.</p>
      </div>
      <div>
        <h3 class="font-semibold text-white mb-1">Bulk SME Pricing</h3>
        <p class="text-neutral-400">Automated tier discounts for wholesale orders of 10+ units.</p>
      </div>
      <div>
        <h3 class="font-semibold text-white mb-1">24-Hour Dispatch</h3>
        <p class="text-neutral-400">Real-time warehouse inventory sync across regional fulfillment hubs.</p>
      </div>
    </section>
  </main>

  <div id="cartDrawer" class="fixed inset-0 bg-black/70 hidden z-50 justify-end">
    <div class="w-full max-w-md bg-neutral-900 border-l border-neutral-800 h-full flex flex-col p-6">
      <div class="flex items-center justify-between pb-4 border-b border-neutral-800">
        <h2 class="text-lg font-bold">Order Summary</h2>
        <button onclick="toggleCart(false)" class="text-sm text-neutral-400 hover:text-white">Close</button>
      </div>
      <div id="cartItems" class="flex-1 overflow-y-auto py-4 space-y-3"></div>
      <div class="border-t border-neutral-800 pt-4 space-y-3">
        <div class="flex justify-between text-sm">
          <span class="text-neutral-400">Subtotal</span>
          <span id="cartSubtotal" class="font-bold tabular text-white">$0.00</span>
        </div>
        <button onclick="checkout()" class="w-full py-3 rounded-lg bg-[#00ff9d] text-black font-bold text-sm hover:opacity-90 transition">Complete Order</button>
        <p id="checkoutMsg" class="text-xs text-[#00ff9d] hidden text-center">Order reference created and logged locally.</p>
      </div>
    </div>
  </div>

  <script>
    const rates = { USD: { s: '$', m: 1 }, PKR: { s: 'Rs ', m: 278 }, EUR: { s: '€', m: 0.92 }, CNY: { s: '¥', m: 7.2 } };
    const products = [
      { id: 1, name: 'Anodized Aluminum Desk Dock', sku: 'AT-01', priceUsd: 89, stock: 24, desc: 'Dual 4K USB-C hub with machined aluminum enclosure.' },
      { id: 2, name: 'Low-Profile Tactile Keyboard', sku: 'AT-02', priceUsd: 139, stock: 12, desc: 'Wireless tri-mode mechanical board with hot-swap switches.' },
      { id: 3, name: 'Thermal Label Printer Pro', sku: 'AT-03', priceUsd: 165, stock: 9, desc: 'High-speed 4x6 shipping label printer for warehouse counters.' },
      { id: 4, name: 'Portable Studio Light Bar', sku: 'AT-04', priceUsd: 64, stock: 31, desc: 'High-CRI asymmetric monitor illumination with wireless dial.' },
      { id: 5, name: 'Braided Magnetic Power Bank', sku: 'AT-05', priceUsd: 78, stock: 18, desc: '20,000mAh 100W PD fast charge pack for field teams.' },
      { id: 6, name: 'Matte Ceramic Desk Tray', sku: 'AT-06', priceUsd: 38, stock: 45, desc: 'Modular organizer tray for cables, drives, and cards.' }
    ];
    let cart = [];

    function fmt(usd) {
      const c = document.getElementById('currencySelect').value;
      const r = rates[c];
      return r.s + (usd * r.m).toLocaleString(undefined, { maximumFractionDigits: c === 'PKR' ? 0 : 2 });
    }

    function addToCart(id) {
      const existing = cart.find(x => x.id === id);
      if (existing) existing.qty++;
      else {
        const p = products.find(x => x.id === id);
        cart.push({ ...p, qty: 1 });
      }
      renderCart();
      toggleCart(true);
    }

    function updateQty(id, delta) {
      const item = cart.find(x => x.id === id);
      if (!item) return;
      item.qty += delta;
      if (item.qty <= 0) cart = cart.filter(x => x.id !== id);
      renderCart();
    }

    function renderCatalog() {
      const el = document.getElementById('catalog');
      el.innerHTML = products.map(p => \`
        <article class="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between text-xs text-neutral-500 mb-2">
              <span>\${p.sku}</span>
              <span>\${p.stock} in stock</span>
            </div>
            <h2 class="text-base font-semibold text-white mb-1">\${p.name}</h2>
            <p class="text-sm text-neutral-400 mb-5">\${p.desc}</p>
          </div>
          <div class="flex items-center justify-between pt-3 border-t border-neutral-800">
            <span class="text-lg font-bold tabular text-white">\${fmt(p.priceUsd)}</span>
            <button onclick="addToCart(\${p.id})" class="px-3.5 py-2 rounded-lg bg-white text-black text-xs font-bold hover:bg-neutral-200 transition">Add to Cart</button>
          </div>
        </article>
      \`).join('');
    }

    function renderCart() {
      const count = cart.reduce((a, b) => a + b.qty, 0);
      const sub = cart.reduce((a, b) => a + b.priceUsd * b.qty, 0);
      document.getElementById('cartCount').textContent = count;
      document.getElementById('cartSubtotal').textContent = fmt(sub);
      const list = document.getElementById('cartItems');
      if (cart.length === 0) {
        list.innerHTML = '<p class="text-sm text-neutral-500 text-center py-12">Your cart is empty.</p>';
        return;
      }
      list.innerHTML = cart.map(item => \`
        <div class="flex items-center justify-between bg-neutral-950 border border-neutral-800 rounded-lg p-3">
          <div>
            <div class="text-sm font-medium text-white">\${item.name}</div>
            <div class="text-xs text-neutral-400 tabular">\${fmt(item.priceUsd)} each</div>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="updateQty(\${item.id}, -1)" class="w-7 h-7 rounded bg-neutral-800 text-xs font-bold">-</button>
            <span class="text-xs font-bold tabular w-5 text-center">\${item.qty}</span>
            <button onclick="updateQty(\${item.id}, 1)" class="w-7 h-7 rounded bg-neutral-800 text-xs font-bold">+</button>
          </div>
        </div>
      \`).join('');
    }

    function toggleCart(open) {
      const d = document.getElementById('cartDrawer');
      d.classList.toggle('hidden', !open);
      d.classList.toggle('flex', open);
    }

    function checkout() {
      if (cart.length === 0) return;
      document.getElementById('checkoutMsg').classList.remove('hidden');
      cart = [];
      renderCart();
    }

    function renderAll() { renderCatalog(); renderCart(); }
    renderAll();
  </script>
</body>
</html>`
  },
  {
    id: 'quick-pos',
    title: 'Quick-Tap Retail & Café POS',
    category: 'Commerce',
    description: 'Fast counter POS terminal with category filters, quantity controls, tax calc, and instant receipt.',
    language: 'html',
    code: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Quick-Tap POS Terminal</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>.tabular { font-variant-numeric: tabular-nums; }</style>
</head>
<body class="bg-neutral-950 text-neutral-100 h-screen flex flex-col md:flex-row overflow-hidden">
  <section class="flex-1 flex flex-col p-6 overflow-y-auto">
    <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div>
        <h1 class="text-xl font-bold text-white">Counter POS</h1>
        <p class="text-xs text-neutral-400">Tap items to build ticket · Cash or Card settlement</p>
      </div>
      <div class="flex gap-1 bg-neutral-900 p-1 rounded-lg border border-neutral-800">
        <button onclick="setCat('All')" class="cat-btn px-3 py-1.5 text-xs font-medium rounded-md bg-white text-black">All</button>
        <button onclick="setCat('Drinks')" class="cat-btn px-3 py-1.5 text-xs font-medium rounded-md text-neutral-400">Drinks</button>
        <button onclick="setCat('Bakery')" class="cat-btn px-3 py-1.5 text-xs font-medium rounded-md text-neutral-400">Bakery</button>
        <button onclick="setCat('Retail')" class="cat-btn px-3 py-1.5 text-xs font-medium rounded-md text-neutral-400">Retail</button>
      </div>
    </div>
    <div id="menuGrid" class="grid grid-cols-2 lg:grid-cols-3 gap-4"></div>
  </section>

  <aside class="w-full md:w-96 bg-neutral-900 border-t md:border-t-0 md:border-l border-neutral-800 p-6 flex flex-col">
    <div class="flex items-center justify-between pb-4 border-b border-neutral-800">
      <h2 class="font-bold">Current Ticket</h2>
      <button onclick="ticket=[];renderTicket()" class="text-xs text-red-400 hover:underline">Clear</button>
    </div>
    <div id="ticketList" class="flex-1 overflow-y-auto py-4 space-y-2.5"></div>
    <div class="border-t border-neutral-800 pt-4 space-y-2 text-sm">
      <div class="flex justify-between text-neutral-400"><span>Subtotal</span><span id="subVal" class="tabular">$0.00</span></div>
      <div class="flex justify-between text-neutral-400"><span>Tax (8%)</span><span id="taxVal" class="tabular">$0.00</span></div>
      <div class="flex justify-between text-lg font-bold text-white pt-1"><span>Total</span><span id="totVal" class="tabular text-[#00ff9d]">$0.00</span></div>
      <div class="grid grid-cols-2 gap-2 pt-3">
        <button onclick="settle('Cash')" class="py-3 rounded-lg border border-neutral-700 font-semibold text-xs hover:bg-neutral-800">Cash</button>
        <button onclick="settle('Card')" class="py-3 rounded-lg bg-[#00ff9d] text-black font-bold text-xs hover:opacity-90">Charge Card</button>
      </div>
      <div id="receiptBox" class="hidden mt-3 p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-[#00ff9d] font-mono"></div>
    </div>
  </aside>

  <script>
    const items = [
      { id: 1, name: 'Espresso Double', cat: 'Drinks', price: 3.5 },
      { id: 2, name: 'Iced Matcha Latte', cat: 'Drinks', price: 5.25 },
      { id: 3, name: 'Cold Brew Reserve', cat: 'Drinks', price: 4.75 },
      { id: 4, name: 'Butter Croissant', cat: 'Bakery', price: 4.0 },
      { id: 5, name: 'Cardamom Bun', cat: 'Bakery', price: 4.5 },
      { id: 6, name: 'House Roast Beans 250g', cat: 'Retail', price: 16.0 }
    ];
    let activeCat = 'All';
    let ticket = [];

    function setCat(c) {
      activeCat = c;
      document.querySelectorAll('.cat-btn').forEach(b => {
        const active = b.textContent === c;
        b.className = 'cat-btn px-3 py-1.5 text-xs font-medium rounded-md ' + (active ? 'bg-white text-black' : 'text-neutral-400 hover:text-white');
      });
      renderMenu();
    }

    function addItem(id) {
      const found = ticket.find(t => t.id === id);
      if (found) found.qty++;
      else ticket.push({ ...items.find(i => i.id === id), qty: 1 });
      renderTicket();
    }

    function renderMenu() {
      const list = activeCat === 'All' ? items : items.filter(i => i.cat === activeCat);
      document.getElementById('menuGrid').innerHTML = list.map(i => \`
        <button onclick="addItem(\${i.id})" class="p-4 text-left bg-neutral-900 border border-neutral-800 rounded-xl hover:border-neutral-600 transition flex flex-col justify-between min-h-[110px]">
          <span class="text-xs text-neutral-500">\${i.cat}</span>
          <div>
            <div class="font-semibold text-white text-sm">\${i.name}</div>
            <div class="text-sm font-bold text-[#00ff9d] tabular mt-1">$\${i.price.toFixed(2)}</div>
          </div>
        </button>
      \`).join('');
    }

    function renderTicket() {
      const list = document.getElementById('ticketList');
      if (!ticket.length) list.innerHTML = '<p class="text-xs text-neutral-500 text-center py-10">Tap items on the left to start an order.</p>';
      else list.innerHTML = ticket.map((t, idx) => \`
        <div class="flex items-center justify-between bg-neutral-950 border border-neutral-800 px-3 py-2 rounded-lg text-xs">
          <div><div class="font-medium text-white">\${t.name}</div><div class="text-neutral-400 tabular">\${t.qty} x $\${t.price.toFixed(2)}</div></div>
          <div class="flex items-center gap-2">
            <span class="font-bold tabular">$\${(t.qty * t.price).toFixed(2)}</span>
            <button onclick="ticket.splice(\${idx},1);renderTicket()" class="text-neutral-500 hover:text-red-400">x</button>
          </div>
        </div>
      \`).join('');
      const sub = ticket.reduce((a, b) => a + b.qty * b.price, 0);
      const tax = sub * 0.08;
      document.getElementById('subVal').textContent = '$' + sub.toFixed(2);
      document.getElementById('taxVal').textContent = '$' + tax.toFixed(2);
      document.getElementById('totVal').textContent = '$' + (sub + tax).toFixed(2);
    }

    function settle(method) {
      if (!ticket.length) return;
      const tot = document.getElementById('totVal').textContent;
      const box = document.getElementById('receiptBox');
      box.classList.remove('hidden');
      box.textContent = 'Paid ' + tot + ' via ' + method + ' · Receipt #' + Math.floor(1000 + Math.random() * 9000);
      ticket = [];
      renderTicket();
    }
    renderMenu(); renderTicket();
  </script>
</body>
</html>`
  },
  {
    id: 'inventory-tracker',
    title: 'Inventory & Supplier Tracker',
    category: 'Operations',
    description: 'Live SKU stock control, low-stock threshold alerts, quick restock actions, and CSV export.',
    language: 'html',
    code: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Inventory & Supplier Control</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>.tabular { font-variant-numeric: tabular-nums; }</style>
</head>
<body class="bg-neutral-950 text-neutral-100 p-6 md:p-10 min-h-screen">
  <div class="max-w-5xl mx-auto">
    <div class="flex flex-wrap items-center justify-between gap-4 mb-8">
      <div>
        <h1 class="text-2xl font-bold text-white">Inventory Tracker</h1>
        <p class="text-xs text-neutral-400">Monitor stock thresholds and generate supplier reorder CSVs</p>
      </div>
      <div class="flex gap-2">
        <input id="searchBox" oninput="render()" placeholder="Search SKU or item..." class="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white outline-none" />
        <button onclick="exportCsv()" class="px-4 py-2 rounded-lg bg-[#00ff9d] text-black text-xs font-bold">Export CSV</button>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="bg-neutral-900 border border-neutral-800 rounded-xl p-4"><div class="text-xs text-neutral-400">Total SKUs</div><div id="kpiSkus" class="text-2xl font-bold tabular mt-1">0</div></div>
      <div class="bg-neutral-900 border border-neutral-800 rounded-xl p-4"><div class="text-xs text-neutral-400">Low Stock Alerts</div><div id="kpiLow" class="text-2xl font-bold tabular text-amber-400 mt-1">0</div></div>
      <div class="bg-neutral-900 border border-neutral-800 rounded-xl p-4"><div class="text-xs text-neutral-400">Inventory Value</div><div id="kpiVal" class="text-2xl font-bold tabular text-[#00ff9d] mt-1">$0</div></div>
    </div>

    <div class="bg-neutral-900 border border-neutral-800 rounded-xl overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="border-b border-neutral-800 text-xs text-neutral-400">
          <tr><th class="p-4">SKU</th><th class="p-4">Product</th><th class="p-4">Supplier</th><th class="p-4 text-right">Stock</th><th class="p-4 text-right">Reorder At</th><th class="p-4 text-right">Unit Cost</th><th class="p-4 text-right">Adjust</th></tr>
        </thead>
        <tbody id="rows" class="divide-y divide-neutral-800/80"></tbody>
      </table>
    </div>
  </div>
  <script>
    const skus = [
      { sku: 'XR-101', name: 'Smart Thermal Printer', supplier: 'Shenzhen TechCo', stock: 7, min: 15, cost: 68 },
      { sku: 'XR-102', name: 'USB-C Hub Pro', supplier: 'Apex Components', stock: 42, min: 20, cost: 24 },
      { sku: 'XR-103', name: 'Mechanical Keycap Set', supplier: 'KBD Works', stock: 5, min: 10, cost: 19 },
      { sku: 'XR-104', name: 'Magnetic Desk Charger', supplier: 'Shenzhen TechCo', stock: 29, min: 12, cost: 31 }
    ];
    function adj(i, d) { skus[i].stock = Math.max(0, skus[i].stock + d); render(); }
    function exportCsv() {
      const csv = ['SKU,Name,Supplier,Stock,Min,UnitCost', ...skus.map(s => [s.sku,s.name,s.supplier,s.stock,s.min,s.cost].join(','))].join('\\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'})); a.download='inventory.csv'; a.click();
    }
    function render() {
      const q = document.getElementById('searchBox').value.toLowerCase();
      const filtered = skus.filter(s => s.sku.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
      document.getElementById('kpiSkus').textContent = skus.length;
      document.getElementById('kpiLow').textContent = skus.filter(s => s.stock <= s.min).length;
      document.getElementById('kpiVal').textContent = '$' + skus.reduce((a, s) => a + s.stock * s.cost, 0).toLocaleString();
      document.getElementById('rows').innerHTML = filtered.map((s) => {
        const idx = skus.indexOf(s);
        const low = s.stock <= s.min;
        return \`<tr class="hover:bg-neutral-800/40">
          <td class="p-4 font-mono text-xs text-neutral-400">\${s.sku}</td>
          <td class="p-4 font-medium text-white">\${s.name}</td>
          <td class="p-4 text-neutral-400 text-xs">\${s.supplier}</td>
          <td class="p-4 text-right tabular font-bold \${low ? 'text-amber-400' : 'text-white'}">\${s.stock} \${low ? '(Reorder)' : ''}</td>
          <td class="p-4 text-right tabular text-neutral-400">\${s.min}</td>
          <td class="p-4 text-right tabular">$\${s.cost}</td>
          <td class="p-4 text-right space-x-1">
            <button onclick="adj(\${idx},-1)" class="px-2 py-1 rounded bg-neutral-800 text-xs">-1</button>
            <button onclick="adj(\${idx},10)" class="px-2 py-1 rounded bg-neutral-800 text-xs text-[#00ff9d]">+10</button>
          </td>
        </tr>\`;
      }).join('');
    }
    render();
  </script>
</body>
</html>`
  },
  {
    id: 'invoice-studio',
    title: 'Invoice Studio & Billing Generator',
    category: 'Finance',
    description: 'Branded invoice builder with live line-item calculation, tax/discount control, and printable PDF.',
    language: 'html',
    code: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice Studio</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>.tabular { font-variant-numeric: tabular-nums; } @media print { .no-print { display: none; } body { background: white; color: black; } }</style>
</head>
<body class="bg-neutral-950 text-neutral-100 p-6 md:p-10 min-h-screen">
  <div class="max-w-4xl mx-auto">
    <div class="no-print flex justify-between items-center mb-6">
      <h1 class="text-xl font-bold">Invoice Studio</h1>
      <div class="flex gap-2">
        <button onclick="addLine()" class="px-3.5 py-2 rounded-lg border border-neutral-800 text-xs font-semibold hover:bg-neutral-900">+ Add Line Item</button>
        <button onclick="window.print()" class="px-4 py-2 rounded-lg bg-[#00ff9d] text-black text-xs font-bold">Print / Save PDF</button>
      </div>
    </div>
    <div class="bg-neutral-900 border border-neutral-800 rounded-xl p-8 space-y-6">
      <div class="flex flex-wrap justify-between gap-4 border-b border-neutral-800 pb-6">
        <div>
          <input value="Xer0byte Solutions" class="bg-transparent text-2xl font-bold text-white outline-none" />
          <input value="billing@xer0byte.dev" class="block bg-transparent text-xs text-neutral-400 outline-none mt-1" />
        </div>
        <div class="text-right">
          <div class="text-xs text-neutral-400 uppercase tracking-wider">Invoice Number</div>
          <input value="INV-2026-041" class="bg-transparent text-right font-mono font-bold text-white outline-none" />
        </div>
      </div>
      <div id="lines" class="space-y-2"></div>
      <div class="border-t border-neutral-800 pt-4 flex flex-col items-end space-y-1 text-sm">
        <div class="flex justify-between w-56"><span class="text-neutral-400">Subtotal</span><span id="sub" class="tabular font-semibold">$0.00</span></div>
        <div class="flex justify-between w-56"><span class="text-neutral-400">Tax (10%)</span><span id="tax" class="tabular font-semibold">$0.00</span></div>
        <div class="flex justify-between w-56 text-lg font-bold pt-2 border-t border-neutral-800"><span>Total Due</span><span id="tot" class="tabular text-[#00ff9d]">$0.00</span></div>
      </div>
    </div>
  </div>
  <script>
    let items = [
      { desc: 'AI Workflow Automation Setup', qty: 1, rate: 1200 },
      { desc: 'Custom Storefront Integration', qty: 1, rate: 650 }
    ];
    function addLine() { items.push({ desc: 'Consulting Hours', qty: 2, rate: 125 }); render(); }
    function upd(i, k, v) { items[i][k] = k === 'desc' ? v : Number(v) || 0; calc(); }
    function calc() {
      const sub = items.reduce((a, b) => a + b.qty * b.rate, 0);
      const tax = sub * 0.1;
      document.getElementById('sub').textContent = '$' + sub.toFixed(2);
      document.getElementById('tax').textContent = '$' + tax.toFixed(2);
      document.getElementById('tot').textContent = '$' + (sub + tax).toFixed(2);
    }
    function render() {
      document.getElementById('lines').innerHTML = items.map((it, i) => \`
        <div class="grid grid-cols-12 gap-2 items-center">
          <input oninput="upd(\${i},'desc',this.value)" value="\${it.desc}" class="col-span-6 bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-xs text-white" />
          <input type="number" oninput="upd(\${i},'qty',this.value)" value="\${it.qty}" class="col-span-2 bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-xs text-right tabular" />
          <input type="number" oninput="upd(\${i},'rate',this.value)" value="\${it.rate}" class="col-span-3 bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-xs text-right tabular" />
          <button onclick="items.splice(\${i},1);render()" class="col-span-1 text-xs text-neutral-500 hover:text-red-400">x</button>
        </div>
      \`).join('');
      calc();
    }
    render();
  </script>
</body>
</html>`
  },
  {
    id: 'crm-pipeline',
    title: 'SME CRM & Deal Pipeline',
    category: 'Operations',
    description: 'Lightweight contacts, deal stage switcher, pipeline value totals, and quick deal creation.',
    language: 'html',
    code: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>CRM Deal Pipeline</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>.tabular { font-variant-numeric: tabular-nums; }</style>
</head>
<body class="bg-neutral-950 text-neutral-100 p-6 md:p-10 min-h-screen">
  <div class="max-w-5xl mx-auto">
    <div class="flex flex-wrap justify-between items-center gap-4 mb-8">
      <div><h1 class="text-2xl font-bold">CRM Pipeline</h1><p class="text-xs text-neutral-400">Total Open Pipeline: <span id="pipeTotal" class="text-[#00ff9d] font-bold tabular">$0</span></p></div>
      <div class="flex gap-2">
        <input id="leadName" placeholder="Company / Lead..." class="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs outline-none" />
        <input id="leadVal" type="number" placeholder="Value $" class="w-24 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs outline-none tabular" />
        <button onclick="addDeal()" class="px-4 py-2 rounded-lg bg-[#00ff9d] text-black text-xs font-bold">Add Deal</button>
      </div>
    </div>
    <div id="board" class="grid grid-cols-1 md:grid-cols-3 gap-5"></div>
  </div>
  <script>
    const stages = ['Qualified', 'Proposal Sent', 'Closed Won'];
    let deals = [
      { id: 1, name: 'Kowloon Roasters POS', val: 2400, stage: 'Qualified' },
      { id: 2, name: 'Lahore Apparel Storefront', val: 3800, stage: 'Proposal Sent' },
      { id: 3, name: 'Marina Bay Logistics Sync', val: 5200, stage: 'Closed Won' }
    ];
    function addDeal() {
      const name = document.getElementById('leadName').value.trim();
      const val = Number(document.getElementById('leadVal').value) || 1000;
      if (!name) return;
      deals.push({ id: Date.now(), name, val, stage: 'Qualified' });
      document.getElementById('leadName').value = '';
      render();
    }
    function advance(id) {
      const d = deals.find(x => x.id === id);
      const idx = stages.indexOf(d.stage);
      d.stage = stages[(idx + 1) % stages.length];
      render();
    }
    function render() {
      document.getElementById('pipeTotal').textContent = '$' + deals.reduce((a,b) => a + b.val, 0).toLocaleString();
      document.getElementById('board').innerHTML = stages.map(st => \`
        <div class="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
          <div class="flex justify-between text-xs font-semibold text-neutral-300 border-b border-neutral-800 pb-2">
            <span>\${st}</span>
            <span class="tabular text-neutral-500">\${deals.filter(d=>d.stage===st).length}</span>
          </div>
          \${deals.filter(d=>d.stage===st).map(d => \`
            <div class="bg-neutral-950 border border-neutral-800 rounded-lg p-3 space-y-2">
              <div class="text-sm font-semibold text-white">\${d.name}</div>
              <div class="flex justify-between items-center text-xs">
                <span class="tabular text-[#00ff9d] font-bold">$\${d.val.toLocaleString()}</span>
                <button onclick="advance(\${d.id})" class="text-neutral-400 hover:text-white underline">Move Stage &rarr;</button>
              </div>
            </div>
          \`).join('')}
        </div>
      \`).join('');
    }
    render();
  </script>
</body>
</html>`
  },
  {
    id: 'booking-hub',
    title: 'Booking Hub & Appointment Scheduler',
    category: 'Customer',
    description: 'Clean service booking flow with duration selection, time slot picker, and booking confirmation.',
    language: 'html',
    code: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Booking Hub</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-neutral-950 text-neutral-100 p-6 md:p-12 min-h-screen flex items-center justify-center">
  <div class="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-5">
    <div><h1 class="text-xl font-bold">Book a Strategy Session</h1><p class="text-xs text-neutral-400 mt-1">Select service, slot, and enter contact info.</p></div>
    <select id="svc" class="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm">
      <option>AI Storefront Architecture (45 min)</option>
      <option>Python Automation Audit (30 min)</option>
      <option>Cross-Border Checkout Setup (60 min)</option>
    </select>
    <div class="grid grid-cols-3 gap-2" id="slots"></div>
    <input id="guestEmail" type="email" placeholder="you@company.com" class="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm outline-none" />
    <button onclick="book()" class="w-full py-3 rounded-lg bg-[#00ff9d] text-black font-bold text-sm">Confirm Appointment</button>
    <div id="status" class="text-xs text-[#00ff9d] hidden"></div>
  </div>
  <script>
    const times = ['09:30 AM', '11:00 AM', '01:30 PM', '03:00 PM', '04:30 PM', '06:00 PM'];
    let selected = times[0];
    function renderSlots() {
      document.getElementById('slots').innerHTML = times.map(t => \`
        <button onclick="selected='\${t}';renderSlots()" class="py-2 rounded-lg text-xs font-medium border \${selected===t ? 'bg-white text-black border-white font-bold' : 'border-neutral-800 text-neutral-400'}">\${t}</button>
      \`).join('');
    }
    function book() {
      const email = document.getElementById('guestEmail').value.trim() || 'guest';
      const s = document.getElementById('status');
      s.classList.remove('hidden');
      s.textContent = 'Confirmed: ' + document.getElementById('svc').value + ' at ' + selected + ' for ' + email;
    }
    renderSlots();
  </script>
</body>
</html>`
  },
  {
    id: 'customer-portal',
    title: 'Customer Self-Serve Portal',
    category: 'Customer',
    description: 'Order status lookup, support ticket submission, and digital document access.',
    language: 'html',
    code: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Customer Portal</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-neutral-950 text-neutral-100 p-6 md:p-10 min-h-screen">
  <div class="max-w-3xl mx-auto space-y-6">
    <h1 class="text-2xl font-bold">Customer Self-Serve Portal</h1>
    <div class="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex gap-2">
      <input id="orderInput" value="ORD-8821" placeholder="Enter Order ID..." class="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none" />
      <button onclick="lookup()" class="px-4 py-2 rounded-lg bg-[#00ff9d] text-black text-xs font-bold">Track Order</button>
    </div>
    <div id="orderResult" class="bg-neutral-900 border border-neutral-800 rounded-xl p-5 text-sm space-y-2">
      <div class="flex justify-between font-semibold"><span>Order #ORD-8821</span><span class="text-[#00ff9d]">In Transit · Hub HKG-02</span></div>
      <p class="text-xs text-neutral-400">Customs cleared. Estimated local courier delivery: 2 business days.</p>
    </div>
    <div class="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-3">
      <h2 class="font-semibold text-sm">Submit Support Request</h2>
      <textarea id="ticketText" placeholder="Describe your order issue or exchange request..." class="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-sm h-24 outline-none"></textarea>
      <button onclick="document.getElementById('ticketAck').classList.remove('hidden')" class="px-4 py-2 rounded-lg bg-white text-black text-xs font-bold">Submit Ticket</button>
      <p id="ticketAck" class="hidden text-xs text-[#00ff9d]">Ticket #TKT-409 logged and assigned to Haven Customer Service.</p>
    </div>
  </div>
  <script>
    function lookup() {
      const id = document.getElementById('orderInput').value.trim() || 'ORD-8821';
      document.getElementById('orderResult').innerHTML = '<div class="flex justify-between font-semibold"><span>Order #' + id + '</span><span class="text-[#00ff9d]">Processing · Verified</span></div><p class="text-xs text-neutral-400">Warehouse dispatch scheduled within 24 hours.</p>';
    }
  </script>
</body>
</html>`
  },
  {
    id: 'loyalty-stamps',
    title: 'Loyalty Stamps & Rewards Card',
    category: 'Customer',
    description: 'Interactive digital stamp card with progress tracking and instant reward redemption.',
    language: 'html',
    code: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Loyalty Stamps</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-neutral-950 text-neutral-100 p-6 min-h-screen flex items-center justify-center">
  <div class="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-5 text-center">
    <h1 class="text-xl font-bold">Member Loyalty Card</h1>
    <p class="text-xs text-neutral-400">Collect 8 stamps to unlock a complimentary reward.</p>
    <div id="grid" class="grid grid-cols-4 gap-3 py-2"></div>
    <div class="flex gap-2">
      <button onclick="stamp()" class="flex-1 py-2.5 rounded-lg bg-[#00ff9d] text-black text-xs font-bold">Add Visit Stamp</button>
      <button onclick="redeem()" class="px-4 py-2.5 rounded-lg border border-neutral-700 text-xs font-semibold">Redeem</button>
    </div>
    <p id="msg" class="text-xs text-neutral-400"></p>
  </div>
  <script>
    let count = 5;
    function render() {
      document.getElementById('grid').innerHTML = Array.from({length: 8}, (_, i) => \`
        <div class="h-14 rounded-xl border flex items-center justify-center text-sm font-bold \${i < count ? 'bg-[#00ff9d]/20 border-[#00ff9d] text-[#00ff9d]' : 'bg-neutral-950 border-neutral-800 text-neutral-600'}">\${i < count ? '✓' : i + 1}</div>
      \`).join('');
      document.getElementById('msg').textContent = count + ' / 8 stamps collected';
    }
    function stamp() { if (count < 8) count++; render(); }
    function redeem() { if (count >= 8) { count = 0; render(); document.getElementById('msg').textContent = 'Reward redeemed! Card reset.'; } }
    render();
  </script>
</body>
</html>`
  },
  {
    id: 'dashboard',
    title: 'SaaS Analytics Dashboard',
    category: 'Developer',
    description: 'Modern analytical summary card with clean metric blocks and efficiency bars.',
    language: 'html',
    code: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        body { font-family: 'Plus Jakarta Sans', sans-serif; }
        .tabular { font-variant-numeric: tabular-nums; }
    </style>
</head>
<body class="bg-neutral-950 text-white min-h-screen flex items-center justify-center p-6">
    <div class="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-6">
        <div>
            <span class="text-xs font-medium text-[#00ff9d]">Operations Summary</span>
            <h3 class="text-2xl font-bold mt-1">Monthly Store Output</h3>
        </div>
        <div class="grid grid-cols-2 gap-4">
            <div class="bg-neutral-950 p-4 rounded-xl border border-neutral-800">
                <span class="text-xs text-neutral-400">Net Revenue</span>
                <div class="text-lg font-bold mt-1 tabular text-white">$48,920</div>
            </div>
            <div class="bg-neutral-950 p-4 rounded-xl border border-neutral-800">
                <span class="text-xs text-neutral-400">Fulfillment Rate</span>
                <div class="text-lg font-bold mt-1 tabular text-[#00ff9d]">98.4%</div>
            </div>
        </div>
        <div>
            <div class="flex justify-between text-xs mb-2">
                <span class="text-neutral-400">Weekly Order Target</span>
                <span class="text-[#00ff9d] tabular font-semibold">76%</span>
            </div>
            <div class="h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div class="h-full bg-[#00ff9d] rounded-full" style="width: 76%"></div>
            </div>
        </div>
    </div>
</body>
</html>`
  }
];
