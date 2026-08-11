'use client';

import { useEffect, useRef, memo } from 'react';

/**
 * TradingView Advanced Chart widget.
 * Maps internal symbols to TradingView-compatible symbols.
 */
function mapSymbol(symbol: string, type: 'CRYPTO' | 'FOREX'): string {
  // Clean up the symbol - remove USD/USDT suffix
  let cleanSymbol = symbol.toUpperCase();
  cleanSymbol = cleanSymbol.replace('USDT', '').replace('USD', '');
  
  // Crypto symbols - use BINANCE exchange
  if (type === 'CRYPTO') {
    // Map common symbols to TradingView format
    const symbolMap: Record<string, string> = {
      'BTC': 'BINANCE:BTCUSDT',
      'ETH': 'BINANCE:ETHUSDT',
      'SOL': 'BINANCE:SOLUSDT',
      'BNB': 'BINANCE:BNBUSDT',
      'XRP': 'BINANCE:XRPUSDT',
      'DOGE': 'BINANCE:DOGEUSDT',
      'ADA': 'BINANCE:ADAUSDT',
      'AVAX': 'BINANCE:AVAXUSDT',
      'DOT': 'BINANCE:DOTUSDT',
      'LINK': 'BINANCE:LINKUSDT',
      'MATIC': 'BINANCE:MATICUSDT',
      'SHIB': 'BINANCE:SHIBUSDT',
      'TRX': 'BINANCE:TRXUSDT',
      'ATOM': 'BINANCE:ATOMUSDT',
      'LTC': 'BINANCE:LTCUSDT',
      'BCH': 'BINANCE:BCHUSDT',
      'NEAR': 'BINANCE:NEARUSDT',
      'ALGO': 'BINANCE:ALGOUSDT',
      'VET': 'BINANCE:VETUSDT',
      'FIL': 'BINANCE:FILUSDT',
      'ICP': 'BINANCE:ICPUSDT',
      'APT': 'BINANCE:APTUSDT',
      'ARB': 'BINANCE:ARBUSDT',
      'OP': 'BINANCE:OPUSDT',
    };
    
    if (symbolMap[cleanSymbol]) {
      return symbolMap[cleanSymbol];
    }
    // Default fallback for any other crypto
    return `BINANCE:${cleanSymbol}USDT`;
  }
  
  // Forex symbols
  if (type === 'FOREX') {
    return `FX:${cleanSymbol}`;
  }
  
  return `BINANCE:${cleanSymbol}USDT`;
}

interface Props {
  symbol: string;
  type: 'CRYPTO' | 'FOREX';
  height?: number;
}

function TradingViewChartBase({ symbol, type, height = 520 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetCreatedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || widgetCreatedRef.current) return;
    
    // Clear container
    containerRef.current.innerHTML = '';
    
    const tvSymbol = mapSymbol(symbol, type);
    
    // Create widget container div
    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = '100%';
    widgetDiv.style.width = '100%';
    containerRef.current.appendChild(widgetDiv);
    
    // Create script
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.type = 'text/javascript';
    script.innerHTML = JSON.stringify({
      width: '100%',
      height: '100%',
      symbol: tvSymbol,
      interval: 'D',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      toolbar_bg: '#0a0b0d',
      enable_publishing: false,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      container_id: widgetDiv.id || 'tradingview-widget',
      studies: [
        'MASimple@tv-basicstudies',
        'RSI@tv-basicstudies',
        'MACD@tv-basicstudies'
      ],
    });
    
    // Give the div an ID for TradingView
    if (!widgetDiv.id) {
      widgetDiv.id = `tv-chart-${Date.now()}`;
      script.innerHTML = script.innerHTML.replace('tradingview-widget', widgetDiv.id);
    }
    
    containerRef.current.appendChild(script);
    widgetCreatedRef.current = true;
    
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      widgetCreatedRef.current = false;
    };
  }, [symbol, type]);

  return (
    <div className="card overflow-hidden p-2" style={{ height: `${height}px`, width: '100%' }}>
      <div ref={containerRef} className="tradingview-widget-container h-full w-full" />
    </div>
  );
}

export const TradingViewChart = memo(TradingViewChartBase);