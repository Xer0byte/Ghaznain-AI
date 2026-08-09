import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

users_ui_replacement = r"""      {activeTab === 'users' && (
        <div className={`flex-1 rounded-2xl border overflow-hidden flex flex-col ${theme === 'dark' ? 'bg-[#111] border-[#333]' : 'bg-white border-[#ddd]'}`}>
          <div className={`p-4 md:p-6 font-bold border-b text-base md:text-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${theme === 'dark' ? 'border-[#333]' : 'border-[#ddd]'}`}>
            <span>Manage Users</span>
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto font-normal">
              <div className={`flex items-center px-3 py-1.5 rounded-lg border flex-1 md:w-64 ${theme === 'dark' ? 'bg-[#222] border-[#444]' : 'bg-[#f5f5f5] border-[#ccc]'}`}>
                <Search size={14} className="opacity-50 mr-2 shrink-0" />
                <input
                  type="text"
                  placeholder="Search by name, email..."
                  value={adminUserSearch}
                  onChange={(e) => setAdminUserSearch(e.target.value)}
                  className="bg-transparent border-none outline-none text-sm w-full font-normal"
                />
                {adminUserSearch && (
                  <button onClick={() => setAdminUserSearch('')} className="ml-2 opacity-50 hover:opacity-100">
                    <X size={14} />
                  </button>
                )}
              </div>
              <button 
                onClick={() => {
                  const header = ["ID", "Name", "Email", "Plan", "MessageCount", "Role"];
                  const rows = users.map(u => [u.id, u.name, u.email, u.plan, u.messageCount, u.role]);
                  const csvContent = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = "users_export.csv";
                  link.click();
                  URL.revokeObjectURL(url);
                }}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20' : 'bg-black/5 hover:bg-black/10'}`}
              >
                <Download size={14} /> Export CSV
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-0">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className={`text-xs uppercase tracking-wider ${theme === 'dark' ? 'bg-[#1a1a1a] text-[#888] border-[#333]' : 'bg-[#f5f5f5] text-[#666] border-[#ddd]'} border-b`}>
                  <th className="p-4 font-medium">User Profile</th>
                  <th className="p-4 font-medium">Plan & Stats</th>
                  <th className="p-4 font-medium">Stored Password</th>
                  <th className="p-4 font-medium">Location Tracking</th>
                  <th className="p-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
                  <tbody className="divide-y text-sm">
                    {users
                      .filter(u => !adminUserSearch || 
                        (u.name || '').toLowerCase().includes(adminUserSearch.toLowerCase()) || 
                        (u.email || '').toLowerCase().includes(adminUserSearch.toLowerCase()))
                      .map(u => ("""

# Replace from {activeTab === 'users' && ( up to {users.map(u => (
pattern = re.compile(r'      \{activeTab === \'users\' && \(\s*<div className=\{`flex-1 rounded-2xl border overflow-hidden flex flex-col \$\{theme === \'dark\' \? \'bg-\[\#111\] border-\[\#333\]\' : \'bg-white border-\[\#ddd\]\'\}`\}>\s*<div className=\{`p-4 md:p-6 font-bold border-b text-base md:text-lg \$\{theme === \'dark\' \? \'border-\[\#333\]\' : \'border-\[\#ddd\]\'\}`\}>Manage Users</div>.*?<tbody className="divide-y text-sm">\s*\{users\.map\(u => \(', re.DOTALL)

content = pattern.sub(users_ui_replacement, content)

with open('src/App.tsx', 'w') as f:
    f.write(content)
