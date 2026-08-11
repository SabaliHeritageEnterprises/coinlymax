'use client';

import { useEffect, useState } from 'react';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { MarketTable } from '@/components/market-table';
import { useMarket } from '@/store/market';
import { Search } from 'lucide-react';

type TabType = 'ALL' | 'CRYPTO' | 'FOREX';

export default function MarketsPage() {
  const { filteredPairs, isLoading, setSearch, setType, selectedType, fetchRealPrices, lastUpdate } = useMarket();
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    fetchRealPrices();
  }, []);

  const handleSearch = (value: string) => {
    setSearchInput(value);
    setSearch(value);
  };

  const handleTypeChange = (type: TabType) => {
    setType(type);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 p-10 text-center text-muted">
          <div className="animate-pulse">Loading 150+ trading pairs...</div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 w-full flex-1">
        {/* Header with live indicator */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Markets</h1>
          <div className="flex items-center gap-2 text-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-muted">Live prices</span>
            {lastUpdate && (
              <span className="text-muted/50 text-[10px] ml-2">
                Updated: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        
        {/* Stats bar */}
        <div className="text-sm text-muted mb-4">
          Showing {filteredPairs.length} trading pairs
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => handleTypeChange('ALL')}
              className={`px-4 py-2 rounded-lg text-sm transition ${
                selectedType === 'ALL' 
                  ? 'bg-gold text-black font-medium' 
                  : 'text-muted hover:text-white'
              }`}
            >
              All Markets
            </button>
            <button
              onClick={() => handleTypeChange('CRYPTO')}
              className={`px-4 py-2 rounded-lg text-sm transition ${
                selectedType === 'CRYPTO' 
                  ? 'bg-gold text-black font-medium' 
                  : 'text-muted hover:text-white'
              }`}
            >
              Crypto ({filteredPairs.filter(p => p.type === 'CRYPTO').length})
            </button>
            <button
              onClick={() => handleTypeChange('FOREX')}
              className={`px-4 py-2 rounded-lg text-sm transition ${
                selectedType === 'FOREX' 
                  ? 'bg-gold text-black font-medium' 
                  : 'text-muted hover:text-white'
              }`}
            >
              Forex ({filteredPairs.filter(p => p.type === 'FOREX').length})
            </button>
          </div>
          
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
            <input
              value={searchInput}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by name or symbol..."
              className="input pl-10"
            />
          </div>
        </div>

        {/* Market Table with live data */}
        {filteredPairs.length > 0 ? (
          <MarketTable pairs={filteredPairs} />
        ) : (
          <div className="card p-10 text-center text-muted">
            No markets match your filters.
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}