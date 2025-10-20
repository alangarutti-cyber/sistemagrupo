import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SaidasSection = ({ expenses, withdrawals, courtesies, onRemoveExpense, onRemoveWithdrawal, onRemoveCourtesy }) => {
  const totalSaidas = 
    (expenses?.reduce((sum, e) => sum + e.value, 0) || 0) +
    (withdrawals?.reduce((sum, w) => sum + w.value, 0) || 0) +
    (courtesies?.reduce((sum, c) => sum + c.value, 0) || 0);

  const formatCurrency = (value) => `R$ ${value.toFixed(2).replace('.', ',')}`;

  const renderListItems = (items, onRemove, color, type) => {
    if (!items || items.length === 0) return null;
    return items.map(item => (
      <div key={`${type}-${item.id}`} className={`flex justify-between items-center p-2 rounded-md ${color}-100`}>
        <span className={`text-sm text-${color}-800`}>{item.description || item.employee.name}: {formatCurrency(item.value)}</span>
        <Button variant="ghost" size="sm" className={`text-${color}-600 hover:text-${color}-800`} onClick={() => onRemove(item.id)}><X className="w-4 h-4" /></Button>
      </div>
    ));
  };
  
  return (
    <div className="mt-6 glass-effect rounded-xl p-4 sm:p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg">Saídas do Caixa</h3>
        <span className="font-bold text-lg text-red-600">{formatCurrency(totalSaidas)}</span>
      </div>
      <div className="space-y-2">
        {renderListItems(expenses, onRemoveExpense, 'red', 'expense')}
        {renderListItems(courtesies, onRemoveCourtesy, 'purple', 'courtesy')}
        {renderListItems(withdrawals, onRemoveWithdrawal, 'yellow', 'withdrawal')}
      </div>
    </div>
  );
};

export default SaidasSection;