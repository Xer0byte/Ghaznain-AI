import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# Fix the duplicate block in Conversations Tab
bad_block = r"""                const filtered = joinedConversations.filter(conv => {
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
                });
                  const dateObj = conv.updatedAt?.seconds ? new Date(conv.updatedAt.seconds * 1000) : (conv.createdAt?.seconds ? new Date(conv.createdAt.seconds * 1000) : new Date(conv.createdAt || conv.updatedAt || Date.now()));
                  const convDate = dateObj.toISOString().split('T')[0];
                  return convDate === adminConvSearchDate;
                });"""

good_block = r"""                const filtered = joinedConversations.filter(conv => {
                  let match = true;
                  if (adminConvSearchDate) {
                    let dateObj;
                    if (conv.updatedAt?.seconds) {
                       dateObj = new Date(conv.updatedAt.seconds * 1000);
                    } else if (conv.createdAt?.seconds) {
                       dateObj = new Date(conv.createdAt.seconds * 1000);
                    } else {
                       dateObj = new Date(conv.createdAt || conv.updatedAt || Date.now());
                    }
                    const convDate = dateObj.toISOString().split('T')[0];
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

content = content.replace(bad_block, good_block)

# Fix the syntax error in Users Tab
bad_users_block = r"""                  <tbody className="divide-y text-sm">
                    {users
                      .filter(u => !adminUserSearch || 
                        (u.name || '').toLowerCase().includes(adminUserSearch.toLowerCase()) || 
                        (u.email || '').toLowerCase().includes(adminUserSearch.toLowerCase()))
                      .map(u => ("""

good_users_block = r"""                  <tbody className="divide-y text-sm">
                    {users
                      .filter(u => !adminUserSearch || 
                        (u.name || '').toLowerCase().includes(adminUserSearch.toLowerCase()) || 
                        (u.email || '').toLowerCase().includes(adminUserSearch.toLowerCase()))
                      .map(u => ("""

# Actually wait, let's see why it complained around 1173: Unterminated string literal.
# Let's check lines 1170-1180.
