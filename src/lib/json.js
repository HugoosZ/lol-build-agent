// Clase Response compatible con Web API para Node.js
class NodeResponse {
  constructor(body, options = {}) {
    this.body = body;
    this.status = options.status || 200;
    this.headers = new Map(Object.entries(options.headers || {}));
  }

  async text() {
    return this.body;
  }

  async json() {
    return JSON.parse(this.body);
  }
}

export function json(data, status = 200, headers = {}) {
  return new NodeResponse(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

export function text(body, status = 200, headers = {}) {
  return new NodeResponse(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...headers,
    },
  });
}

// Helper para parsear el body de requests en Node.js
export function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : null);
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}