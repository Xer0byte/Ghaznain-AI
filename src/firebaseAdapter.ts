export async function firebaseApiFetch(url: string, options?: RequestInit) {
  const token = localStorage.getItem('xer0byteToken');
  const finalOptions: RequestInit = {
    ...options,
    credentials: 'omit',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {})
    }
  };
  const res = await fetch(url, finalOptions);
  
  // Prevent JSON.parse crashes by checking Content-Type before returning a generic response
  const contentType = res.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    console.error(`Received non-JSON response (${contentType}) for API request ${url}. Status: ${res.status}. This usually means an incorrect deployment setup or a server crash.`);
    
    let errorText = "API Error. Check console.";
    try { errorText += " " + await res.clone().text(); } catch(e) {}
    
    // Return a mocked JSON response so the frontend `.json()` calls don't crash
    return new Response(JSON.stringify({ error: errorText.substring(0, 500) }), { 
      status: res.status >= 400 ? res.status : 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  return res;
}
