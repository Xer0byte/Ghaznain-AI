import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

replacement = r"""            <div className={`p-4 font-bold border-b flex flex-col gap-3 ${theme === 'dark' ? 'border-[#333]' : 'border-[#ddd]'}`}>
              <div>All Conversations</div>
              <div className="flex flex-col gap-2">
                <div className={`flex items-center px-3 py-1.5 rounded-lg border ${theme === 'dark' ? 'bg-[#222] border-[#444]' : 'bg-[#f5f5f5] border-[#ccc]'}`}>
                  <Search size={14} className="opacity-50 mr-2 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search by user name or email..."
                    value={adminConvUserSearch}
                    onChange={(e) => setAdminConvUserSearch(e.target.value)}
                    className="bg-transparent border-none outline-none text-sm w-full font-normal"
                  />
                  {adminConvUserSearch && (
                    <button onClick={() => setAdminConvUserSearch('')} className="ml-2 opacity-50 hover:opacity-100">
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div className={`flex items-center px-3 py-1.5 rounded-lg border ${theme === 'dark' ? 'bg-[#222] border-[#444]' : 'bg-[#f5f5f5] border-[#ccc]'}`}>
                  <Search size={14} className="opacity-50 mr-2 shrink-0" />
                  <input
                    type="date"
                    value={adminConvSearchDate}
                    onChange={(e) => setAdminConvSearchDate(e.target.value)}
                    className="bg-transparent border-none outline-none text-sm w-full font-normal"
                  />
                  {adminConvSearchDate && (
                    <button onClick={() => setAdminConvSearchDate('')} className="ml-2 opacity-50 hover:opacity-100">
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {(() => {
                const filtered = joinedConversations.filter(conv => {
                  let match = true;
                  if (adminConvSearchDate) {
                    const convDate = new Date(conv.updatedAt).toISOString().split('T')[0];
                    if (convDate !== adminConvSearchDate) match = false;
                  }
                  if (adminConvUserSearch) {
                    const searchLower = adminConvUserSearch.toLowerCase();
                    const u = users.find(user => user.id === conv.userId);
                    if (!u) match = false;
                    else if (!(u.name || '').toLowerCase().includes(searchLower) && !(u.email || '').toLowerCase().includes(searchLower)) match = false;
                  }
                  return match;
                });"""

pattern = re.compile(r'            <div className=\{`p-4 font-bold border-b flex flex-col gap-3 \$\{theme === \'dark\' \? \'border-\[\#333\]\' : \'border-\[\#ddd\]\'\}`\}>\s*<div>All Conversations</div>\s*<div className=\{`flex items-center px-3 py-2 rounded-lg border \$\{theme === \'dark\' \? \'bg-\[\#222\] border-\[\#444\]\' : \'bg-\[\#f5f5f5\] border-\[\#ccc\]\'\}`\}>\s*<Search size=\{14\} className="opacity-50 mr-2" />\s*<input\s*type="date"\s*value=\{adminConvSearchDate\}\s*onChange=\{\(e\) => setAdminConvSearchDate\(e\.target\.value\)\}\s*className="bg-transparent border-none outline-none text-sm w-full"\s*/>\s*\{adminConvSearchDate && \(\s*<button onClick=\{\(\) => setAdminConvSearchDate\(\'\'\)\} className="ml-2 opacity-50 hover:opacity-100">\s*<X size=\{14\} />\s*</button>\s*\)\}\s*</div>\s*</div>\s*<div className="flex-1 overflow-y-auto custom-scrollbar">\s*\{\(\(\) => \{\s*const filtered = joinedConversations\.filter\(conv => \{\s*if \(\!adminConvSearchDate\) return true;', re.DOTALL)

content = pattern.sub(replacement, content)

with open('src/App.tsx', 'w') as f:
    f.write(content)
