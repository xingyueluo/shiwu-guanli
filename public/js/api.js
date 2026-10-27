/**
 * 前端 API 封装：统一携带 token、统一解析 { error } 报错
 */
const API = (() => {
  const TOKEN_KEY = 'swgl_token';
  let token = localStorage.getItem(TOKEN_KEY) || '';

  function setToken(t) {
    token = t || '';
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  }

  async function request(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data = null;
    try { data = await res.json(); } catch { /* 无 JSON 响应体 */ }
    if (res.status === 401 && !url.includes('/auth/')) {
      setToken('');
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    if (!res.ok) throw new Error((data && data.error) || `请求失败（${res.status}）`);
    return data;
  }

  return {
    get token() { return token; },
    setToken,
    register: (username, password) => request('POST', '/api/auth/register', { username, password }),
    login: (username, password) => request('POST', '/api/auth/login', { username, password }),
    me: () => request('GET', '/api/auth/me'),

    tasks: (params = {}) => request('GET', '/api/tasks?' + new URLSearchParams(params)),
    createTask: (t) => request('POST', '/api/tasks', t),
    updateTask: (id, t) => request('PUT', `/api/tasks/${id}`, t),
    deleteTask: (id) => request('DELETE', `/api/tasks/${id}`),
    tags: () => request('GET', '/api/tasks/meta/tags'),

    logFocus: (minutes, taskId) => request('POST', '/api/focus/sessions', { minutes, taskId }),
    focusSessions: () => request('GET', '/api/focus/sessions'),
    summary: () => request('GET', '/api/focus/summary'),
    weekly: () => request('GET', '/api/focus/weekly'),
  };
})();
