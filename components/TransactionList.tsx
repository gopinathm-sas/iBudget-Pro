
import React from 'react';
import { Transaction, Category } from '../types';
import { COLORS } from '../constants';

interface Props {
  transactions: Transaction[];
}

const CategoryIcon: React.FC<{category: Category}> = ({ category }) => {
  const colorMap: Record<string, string> = {
    [Category.FOOD]: COLORS.orange,
    [Category.TRANSPORT]: COLORS.blue,
    [Category.SHOPPING]: COLORS.pink,
    [Category.ENTERTAINMENT]: COLORS.indigo,
    [Category.HOUSING]: COLORS.green,
    [Category.UTILITIES]: COLORS.gray,
    [Category.INCOME]: COLORS.green,
    [Category.OTHER]: COLORS.gray,
  };

  return (
    <div 
      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
      style={{ backgroundColor: colorMap[category] || COLORS.gray }}
    >
      {category.charAt(0)}
    </div>
  );
};

export const TransactionList: React.FC<Props> = ({ transactions }) => {
  const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (sorted.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        No transactions yet. Tap + to add one.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl mx-4 my-2 overflow-hidden ios-shadow">
      {sorted.map((t, idx) => (
        <div 
          key={t.id} 
          className={`flex items-center p-4 ${idx !== sorted.length - 1 ? 'border-b border-gray-100' : ''}`}
        >
          <CategoryIcon category={t.category} />
          <div className="ml-4 flex-1">
            <div className="font-semibold text-gray-900">{t.note}</div>
            <div className="text-xs text-gray-400 uppercase">{t.category}</div>
          </div>
          <div className={`font-medium ${t.type === 'income' ? 'text-green-500' : 'text-gray-900'}`}>
            {t.type === 'income' ? '+' : '-'}${t.amount.toFixed(2)}
          </div>
        </div>
      ))}
    </div>
  );
};
