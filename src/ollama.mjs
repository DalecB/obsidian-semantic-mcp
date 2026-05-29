export class OllamaEmbeddingClient {
  constructor({ baseUrl, model, timeoutMs = 60000, fetchImpl = fetch, cacheSize = 256, concurrency = 1 }) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.model = model;
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl;
    this.cacheSize = cacheSize;
    this.cache = new Map();
    this.inflight = new Map();
    this.queue = [];
    this.active = 0;
    this.concurrency = Math.max(1, concurrency);
  }

  async embed(input) {
    const inputs = Array.isArray(input) ? input : [input];
    if (inputs.some((value) => typeof value !== 'string' || value.length === 0)) {
      throw new Error('embedding input must be non-empty text');
    }
    if (!Array.isArray(input) && this.cache.has(input)) {
      return this.cache.get(input);
    }
    if (!Array.isArray(input) && this.inflight.has(input)) {
      return this.inflight.get(input);
    }
    if (!Array.isArray(input)) {
      const promise = this.enqueue(() => this.fetchEmbeddings([input]).then((vectors) => vectors[0]));
      this.inflight.set(input, promise);
      try {
        const vector = await promise;
        this.setCache(input, vector);
        return vector;
      } finally {
        this.inflight.delete(input);
      }
    }
    return this.enqueue(async () => {
      const out = [];
      const missing = [];
      const missingIndexes = [];
      inputs.forEach((text, index) => {
        if (this.cache.has(text)) {
          out[index] = this.cache.get(text);
        } else {
          missing.push(text);
          missingIndexes.push(index);
        }
      });
      if (missing.length) {
        const vectors = await this.fetchEmbeddings(missing);
        vectors.forEach((vector, index) => {
          const text = missing[index];
          this.setCache(text, vector);
          out[missingIndexes[index]] = vector;
        });
      }
      return out;
    });
  }

  async fetchEmbeddings(inputs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/api/embed`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: this.model, input: inputs }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Ollama embed failed: HTTP ${response.status}`);
      }
      const json = await response.json();
      if (!Array.isArray(json.embeddings) || json.embeddings.length !== inputs.length) {
        throw new Error('Ollama embed returned invalid embeddings');
      }
      for (const vector of json.embeddings) {
        if (!Array.isArray(vector) || vector.length === 0 || vector.some((n) => typeof n !== 'number')) {
          throw new Error('Ollama embed returned an invalid vector');
        }
      }
      return json.embeddings;
    } finally {
      clearTimeout(timeout);
    }
  }

  enqueue(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.drain();
    });
  }

  drain() {
    while (this.active < this.concurrency && this.queue.length) {
      const item = this.queue.shift();
      this.active += 1;
      Promise.resolve()
        .then(item.task)
        .then(item.resolve, item.reject)
        .finally(() => {
          this.active -= 1;
          this.drain();
        });
    }
  }

  setCache(text, vector) {
    if (this.cache.has(text)) this.cache.delete(text);
    this.cache.set(text, vector);
    while (this.cache.size > this.cacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }
}
