
export enum Category {
  FOOD = 'Food & Drink',
  TRANSPORT = 'Transport',
  SHOPPING = 'Shopping',
  ENTERTAINMENT = 'Entertainment',
  HOUSING = 'Housing',
  UTILITIES = 'Utilities',
  INCOME = 'Income',
  OTHER = 'Other'
}

export interface Transaction {
  id: string;
  amount: number;
  category: Category;
  note: string;
  date: string; // ISO String
  type: 'expense' | 'income';
  isRecurring?: boolean;
}

export interface RecurringTransaction {
  id: string;
  amount: number;
  category: Category;
  note: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  startDate: string; // ISO String
  lastProcessedDate: string; // ISO String - to track the last time an entry was generated
  type: 'expense' | 'income';
}

export interface Budget {
  category: Category;
  limit: number;
  spent: number;
}
