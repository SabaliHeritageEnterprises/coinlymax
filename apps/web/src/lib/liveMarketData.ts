type Subscriber = (price: number, change24h: string, high?: number, low?: number, volume?: number) => void;

class LiveMarketData {
  private ws: WebSocket | null = null;
  private subscribers: Map<string, Subscriber[]> = new Map();
  private forexInterval: NodeJS.Timeout | null = null;

  connectCrypto() {
    if (this.ws) return;
    
    this.ws = new WebSocket('wss://stream.binance.com:9443/ws/!ticker@arr');
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const symbol = data.s;
      const price = parseFloat(data.c);
      const change24h = data.P;
      const high = parseFloat(data.h);
      const low = parseFloat(data.l);
      const volume = parseFloat(data.v);
      
      const subs = this.subscribers.get(symbol);
      if (subs) {
        subs.forEach(cb => cb(price, change24h, high, low, volume));
      }
    };
    
    this.ws.onerror = (err) => console.error('WebSocket error:', err);
    this.ws.onclose = () => {
      console.log('WebSocket closed, reconnecting in 5s...');
      setTimeout(() => this.connectCrypto(), 5000);
    };
  }

  connectForex() {
    if (this.forexInterval) return;
    
    this.forexInterval = setInterval(async () => {
      try {
        const response = await fetch('https://www.live-rates.com/rates');
        const data = await response.json();
        
        // List of all forex pairs to update
        const forexPairs = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'NZDUSD', 'USDCHF'];
        
        forexPairs.forEach(pair => {
          const subs = this.subscribers.get(pair);
          if (subs && subs.length > 0) {
            let price = data[pair];
            let change = data[`${pair}_Change`] || '0';
            
            // Fallback if exact pair not found
            if (!price) {
              // Try alternative naming
              const altKey = pair === 'USDJPY' ? 'USDJPY' : pair;
              price = data[altKey] || 1.0;
            }
            
            subs.forEach(cb => cb(price, change));
          }
        });
      } catch (error) {
        console.error('Forex fetch error:', error);
      }
    }, 5000);
  }

  subscribe(symbol: string, callback: Subscriber) {
    if (!this.subscribers.has(symbol)) {
      this.subscribers.set(symbol, []);
    }
    this.subscribers.get(symbol)!.push(callback);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.forexInterval) {
      clearInterval(this.forexInterval);
      this.forexInterval = null;
    }
  }
}

export const liveMarketData = new LiveMarketData();