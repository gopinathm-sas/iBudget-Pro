
import React, { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Transaction, Category, RecurringTransaction } from './types';
import { ICONS, COLORS } from './constants';
import { TransactionList } from './components/TransactionList';
import { getAIInsights, categorizeFromText } from './geminiService';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'stats' | 'budgets' | 'history'>('home');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [recurringTxs, setRecurringTxs] = useState<RecurringTransaction[]>([]);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBudgetEditOpen, setIsBudgetEditOpen] = useState<Category | null>(null);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [aiInsight, setAiInsight] = useState<string>('Welcome to iBudget Pro|Add expenses to start|AI insights will appear here');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [category, setCategory] = useState<Category>(Category.FOOD);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [newBudgetLimit, setNewBudgetLimit] = useState('');

  // Initial Load
  useEffect(() => {
    try {
      const savedTxs = localStorage.getItem('transactions');
      const savedBudgets = localStorage.getItem('budgets');
      const savedRecurring = localStorage.getItem('recurring');
      if (savedTxs) setTransactions(JSON.parse(savedTxs));
      if (savedBudgets) setBudgets(JSON.parse(savedBudgets));
      if (savedRecurring) setRecurringTxs(JSON.parse(savedRecurring));
    } catch (e) {
      console.error("Failed to load local storage", e);
    }
  }, []);

  // Sync and Process Recurring
  useEffect(() => {
    localStorage.setItem('transactions', JSON.stringify(transactions));
    if (transactions.length > 0) {
      updateInsights();
    }
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('budgets', JSON.stringify(budgets));
  }, [budgets]);

  useEffect(() => {
    localStorage.setItem('recurring', JSON.stringify(recurringTxs));
    processRecurring();
  }, [recurringTxs]);

  const processRecurring = () => {
    const now = new Date();
    let updatedRecurring = [...recurringTxs];
    let newGeneratedTxs: Transaction[] = [];
    let changed = false;

    updatedRecurring = updatedRecurring.map(rec => {
      const lastDate = new Date(rec.lastProcessedDate);
      let nextDate = new Date(lastDate);

      if (rec.frequency === 'daily') nextDate.setDate(nextDate.getDate() + 1);
      else if (rec.frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
      else if (rec.frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);

      while (nextDate <= now) {
        newGeneratedTxs.push({
          id: `rec-gen-${rec.id}-${nextDate.getTime()}`,
          amount: rec.amount,
          category: rec.category,
          note: `[Auto] ${rec.note}`,
          date: nextDate.toISOString(),
          type: rec.type,
          isRecurring: true
        });
        rec.lastProcessedDate = nextDate.toISOString();
        nextDate = new Date(rec.lastProcessedDate);
        if (rec.frequency === 'daily') nextDate.setDate(nextDate.getDate() + 1);
        else if (rec.frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
        else if (rec.frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
        changed = true;
      }
      return rec;
    });

    if (changed) {
      setRecurringTxs(updatedRecurring);
      setTransactions(prev => [...newGeneratedTxs, ...prev]);
    }
  };

  const updateInsights = async () => {
    const insight = await getAIInsights(transactions);
    setAiInsight(insight);
  };

  const handleQuickAdd = async () => {
    if (!note) return;
    setIsAnalyzing(true);
    try {
      const result = await categorizeFromText(note);
      const newTx: Transaction = {
        id: Math.random().toString(36).substr(2, 9),
        amount: result.amount || 0,
        category: result.category,
        note: result.note,
        date: new Date().toISOString(),
        type: result.category === Category.INCOME ? 'income' : 'expense'
      };
      setTransactions(prev => [newTx, ...prev]);
      setIsAddModalOpen(false);
      setNote('');
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleManualAdd = () => {
    if (!amount || !note) return;
    const newTx: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      amount: parseFloat(amount),
      category: category,
      note: note,
      date: new Date().toISOString(),
      type: category === Category.INCOME ? 'income' : 'expense'
    };
    setTransactions(prev => [newTx, ...prev]);
    setIsAddModalOpen(false);
    setAmount('');
    setNote('');
  };

  const handleAddRecurring = () => {
    if (!amount || !note) return;
    const newRec: RecurringTransaction = {
      id: Math.random().toString(36).substr(2, 9),
      amount: parseFloat(amount),
      category: category,
      note: note,
      frequency: frequency,
      startDate: new Date().toISOString(),
      lastProcessedDate: new Date().toISOString(),
      type: category === Category.INCOME ? 'income' : 'expense'
    };
    setRecurringTxs(prev => [...prev, newRec]);
    setIsRecurringModalOpen(false);
    setAmount('');
    setNote('');
  };

  const deleteRecurring = (id: string) => {
    setRecurringTxs(prev => prev.filter(r => r.id !== id));
  };

  const handleSaveBudget = () => {
    if (isBudgetEditOpen) {
      setBudgets(prev => ({
        ...prev,
        [isBudgetEditOpen]: parseFloat(newBudgetLimit) || 0
      }));
      setIsBudgetEditOpen(null);
      setNewBudgetLimit('');
    }
  };

  const totalBalance = useMemo(() => transactions.reduce((acc, t) => t.type === 'income' ? acc + t.amount : acc - t.amount, 0), [transactions]);
  
  const categorySpending = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.forEach(t => {
      if (t.type === 'expense') {
        map[t.category] = (map[t.category] || 0) + t.amount;
      }
    });
    return map;
  }, [transactions]);

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return transactions;
    const q = searchQuery.toLowerCase();
    return transactions.filter(t => 
      t.note.toLowerCase().includes(q) || 
      t.category.toLowerCase().includes(q)
    );
  }, [transactions, searchQuery]);

  const expensesByCategory = useMemo(() => Object.values(Category)
    .filter(cat => cat !== Category.INCOME)
    .map(cat => ({
      name: cat,
      value: categorySpending[cat] || 0
    }))
    .filter(item => item.value > 0), [categorySpending]);

  const chartColors = [COLORS.orange, COLORS.blue, COLORS.pink, COLORS.indigo, COLORS.green, COLORS.gray, COLORS.red];
  const insightItems = useMemo(() => aiInsight.split('|').map(s => s.trim()).filter(Boolean), [aiInsight]);

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-[#F2F2F7] overflow-hidden relative">
      <header className="pt-14 pb-4 px-6 bg-white/80 ios-blur sticky top-0 z-20 border-b border-gray-100">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Available Balance</h2>
            <h1 className="text-3xl font-bold text-gray-900 leading-none mt-1">${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h1>
          </div>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="w-10 h-10 rounded-full bg-[#007AFF] flex items-center justify-center text-white shadow-lg shadow-[#007AFF]/20 active:scale-90 transition-transform"
          >
            <ICONS.Plus />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        {activeTab === 'home' && (
          <div className="animate-in fade-in duration-500">
            <div className="pt-4 pb-2">
              <div className="flex items-center px-6 mb-3">
                <ICONS.Sparkles />
                <span className="ml-2 font-bold text-gray-800 text-sm tracking-tight">Smart Suggestions</span>
              </div>
              <div className="flex overflow-x-auto px-6 gap-3 no-scrollbar scroll-smooth">
                {insightItems.map((item, idx) => (
                  <div key={idx} className="min-w-[180px] bg-white p-4 rounded-[1.75rem] ios-shadow border border-blue-50/50 flex flex-col justify-between">
                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center mb-3"><ICONS.Target /></div>
                    <p className="text-[13px] font-semibold text-gray-800 leading-tight">{item}</p>
                    <div className="mt-3 text-[9px] font-black text-[#007AFF] uppercase tracking-widest">Action Tip</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800">Recent Transactions</h3>
              <button onClick={() => { setActiveTab('history'); setSearchQuery(''); }} className="text-[#007AFF] text-sm font-bold active:opacity-50">See All</button>
            </div>
            <TransactionList transactions={transactions.slice(0, 8)} />
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="animate-in slide-in-from-right duration-300 p-4">
            <h3 className="text-xl font-bold mb-4 ml-2">Analytics</h3>
            <div className="bg-white p-6 rounded-3xl ios-shadow mb-4">
              <h4 className="text-xs font-bold text-gray-400 mb-6 uppercase tracking-wider text-center">Spending Distribution</h4>
              <div className="h-64 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={expensesByCategory} innerRadius={70} outerRadius={90} paddingAngle={5} dataKey="value" stroke="none">
                      {expensesByCategory.map((entry, index) => <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xs text-gray-400 font-bold uppercase">Total Spent</span>
                  <span className="text-xl font-bold text-gray-900">${expensesByCategory.reduce((a, b) => a + b.value, 0).toFixed(0)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'budgets' && (
          <div className="animate-in slide-in-from-right duration-300 p-4 pb-12">
            <h3 className="text-xl font-bold mb-4 ml-2">Category Budgets</h3>
            <div className="space-y-4 mb-8">
              {Object.values(Category).filter(cat => cat !== Category.INCOME).map(cat => {
                const limit = budgets[cat] || 0;
                const spent = categorySpending[cat] || 0;
                const percent = limit > 0 ? (spent / limit) * 100 : 0;
                const displayPercent = Math.min(percent, 100);
                const isOver = limit > 0 && spent > limit;
                return (
                  <div key={cat} className="bg-white p-5 rounded-[2rem] ios-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-bold text-gray-900 text-lg leading-tight">{cat}</h4>
                      <button onClick={() => { setIsBudgetEditOpen(cat); setNewBudgetLimit(limit > 0 ? limit.toString() : ''); }} className="text-[#007AFF] text-xs font-bold px-4 py-2 bg-[#007AFF]/5 rounded-2xl">Modify</button>
                    </div>
                    <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden p-1">
                      <div className={`h-full transition-all duration-1000 ease-out rounded-full ${isOver ? 'bg-[#FF3B30]' : 'bg-[#007AFF]'}`} style={{ width: `${limit > 0 ? displayPercent : 0}%` }} />
                    </div>
                    <div className="flex justify-between mt-2 text-[10px] font-bold text-gray-400 uppercase">
                      <span>Spent: ${spent.toFixed(0)}</span>
                      <span>Goal: ${limit > 0 ? limit.toFixed(0) : '—'}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between px-2 mb-4">
              <h3 className="text-xl font-bold">Subscriptions</h3>
              <button onClick={() => setIsRecurringModalOpen(true)} className="w-8 h-8 rounded-full bg-[#007AFF] text-white flex items-center justify-center shadow-lg shadow-[#007AFF]/20"><ICONS.Plus /></button>
            </div>
            
            <div className="space-y-3">
              {recurringTxs.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-3xl text-gray-400 text-sm font-medium border-2 border-dashed border-gray-200">No active subscriptions</div>
              ) : (
                recurringTxs.map(rec => (
                  <div key={rec.id} className="bg-white p-4 rounded-2xl flex items-center justify-between ios-shadow group">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-[#007AFF] mr-4"><ICONS.History /></div>
                      <div>
                        <div className="font-bold text-gray-900">{rec.note}</div>
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{rec.frequency} • {rec.category}</div>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <div className="text-right mr-3">
                        <div className="font-bold text-gray-900">${rec.amount.toFixed(2)}</div>
                      </div>
                      <button onClick={() => deleteRecurring(rec.id)} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-full hover:bg-red-50">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="animate-in slide-in-from-right duration-300">
            <div className="sticky top-0 bg-[#F2F2F7]/95 ios-blur z-10 p-4 border-b border-gray-200/50">
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </div>
                <input 
                  type="text"
                  placeholder="Search transactions..."
                  className="w-full bg-white rounded-xl py-2.5 pl-10 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 transition-all ios-shadow"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                )}
              </div>
            </div>
            <div className="px-2 pt-2">
              <TransactionList transactions={filteredHistory} />
              {filteredHistory.length === 0 && searchQuery && (
                <div className="py-20 text-center">
                  <div className="w-16 h-16 bg-gray-200/50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  </div>
                  <p className="text-gray-500 font-semibold text-lg">No Results</p>
                  <p className="text-gray-400 text-sm mt-1">Try searching for a different note or category.</p>
                  <button onClick={() => setSearchQuery('')} className="text-[#007AFF] font-bold mt-6 px-6 py-2 bg-[#007AFF]/10 rounded-full">Clear Search</button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/90 ios-blur border-t border-gray-200 flex justify-around safe-area-bottom pt-3 pb-2 z-20">
        <button onClick={() => { setActiveTab('home'); setSearchQuery(''); }} className={`flex flex-col items-center transition-colors ${activeTab === 'home' ? 'text-[#007AFF]' : 'text-gray-400'}`}><ICONS.Wallet /><span className="text-[10px] mt-1 font-bold">Home</span></button>
        <button onClick={() => { setActiveTab('stats'); setSearchQuery(''); }} className={`flex flex-col items-center transition-colors ${activeTab === 'stats' ? 'text-[#007AFF]' : 'text-gray-400'}`}><ICONS.Chart /><span className="text-[10px] mt-1 font-bold">Stats</span></button>
        <button onClick={() => { setActiveTab('budgets'); setSearchQuery(''); }} className={`flex flex-col items-center transition-colors ${activeTab === 'budgets' ? 'text-[#007AFF]' : 'text-gray-400'}`}><ICONS.Target /><span className="text-[10px] mt-1 font-bold">Budgets</span></button>
        <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center transition-colors ${activeTab === 'history' ? 'text-[#007AFF]' : 'text-gray-400'}`}><ICONS.History /><span className="text-[10px] mt-1 font-bold">History</span></button>
      </nav>

      {/* Manual / AI Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-in fade-in duration-300" onClick={() => setIsAddModalOpen(false)}>
          <div className="w-full max-w-md bg-[#F2F2F7] rounded-t-[3rem] p-6 animate-in slide-in-from-bottom duration-300 ios-shadow pb-12" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-6" />
            <h2 className="text-2xl font-bold mb-6">New Entry</h2>
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-4 ios-shadow">
                <input autoFocus className="w-full bg-transparent text-lg focus:outline-none font-medium" placeholder="Coffee for $5" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <button onClick={handleQuickAdd} disabled={isAnalyzing || !note} className="w-full bg-[#007AFF] text-white rounded-2xl py-4 font-bold disabled:opacity-50">AI Quick Save</button>
              <div className="flex items-center gap-4">
                <div className="bg-white rounded-2xl p-4 flex-1 flex items-center"><span className="text-gray-300 mr-2">$</span><input type="number" className="w-full bg-transparent font-bold" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
                <select className="bg-white p-4 rounded-2xl font-bold text-gray-700 appearance-none flex-1" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                  {Object.values(Category).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <button onClick={handleManualAdd} disabled={!amount || !note} className="w-full bg-gray-900 text-white rounded-2xl py-4 font-bold disabled:opacity-50">Manual Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Recurring Modal */}
      {isRecurringModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-in fade-in duration-300" onClick={() => setIsRecurringModalOpen(false)}>
          <div className="w-full max-w-md bg-[#F2F2F7] rounded-t-[3rem] p-6 animate-in slide-in-from-bottom duration-300 ios-shadow pb-12" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-6" />
            <h2 className="text-2xl font-bold mb-6">Subscription / Recurring</h2>
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-4 ios-shadow">
                <input className="w-full bg-transparent text-lg focus:outline-none font-medium" placeholder="Rent or Spotify" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-white rounded-2xl p-4 flex-1 flex items-center"><span className="text-gray-300 mr-2">$</span><input type="number" className="w-full bg-transparent font-bold" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
                <select className="bg-white p-4 rounded-2xl font-bold flex-1" value={frequency} onChange={(e) => setFrequency(e.target.value as any)}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="bg-white rounded-2xl overflow-hidden ios-shadow">
                <select className="w-full p-4 bg-transparent font-bold" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                  {Object.values(Category).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <button onClick={handleAddRecurring} disabled={!amount || !note} className="w-full bg-[#007AFF] text-white rounded-2xl py-4 font-bold disabled:opacity-50">Set Schedule</button>
            </div>
          </div>
        </div>
      )}

      {/* Budget Edit Modal */}
      {isBudgetEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-white rounded-[2.5rem] p-8 animate-in zoom-in duration-200 ios-shadow">
            <h2 className="text-2xl font-bold mb-8 text-center">Set Limit for {isBudgetEditOpen}</h2>
            <div className="bg-gray-50 rounded-3xl p-6 flex items-center mb-8"><span className="text-3xl font-bold text-gray-300 mr-3">$</span><input type="number" autoFocus className="w-full bg-transparent text-3xl font-bold focus:outline-none" placeholder="0" value={newBudgetLimit} onChange={(e) => setNewBudgetLimit(e.target.value)} /></div>
            <div className="flex gap-4"><button onClick={() => setIsBudgetEditOpen(null)} className="flex-1 py-4 bg-gray-100 text-gray-500 font-bold rounded-2xl">Cancel</button><button onClick={handleSaveBudget} className="flex-1 py-4 bg-[#007AFF] text-white font-bold rounded-2xl">Save</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
