import React, { useMemo } from 'react';
import { Input } from '@/components/ui/input';

const SistemaSection = ({ directPayments, addedMachines, addedOtherPayments, systemValues, onSystemValueChange }) => {
  const uniquePaymentMethods = useMemo(() => {
    const allPayments = [];
    
    directPayments.forEach(dp => {
      allPayments.push({ id: dp.name, name: dp.name, value: dp.value });
    });

    addedMachines.forEach(am => {
      am.payments.forEach(p => allPayments.push(p));
    });
    
    addedOtherPayments.forEach(aop => {
      aop.payments.forEach(p => allPayments.push(p));
    });

    const uniqueMethods = new Map();
    allPayments.forEach(p => {
      const key = p.name === 'Dinheiro' || p.name === 'Pix CNPJ' || p.name === 'iFood Online' ? p.name : p.id;
      if (!uniqueMethods.has(key)) {
        uniqueMethods.set(key, { id: key, name: p.name, totalConferred: 0 });
      }
      uniqueMethods.get(key).totalConferred += p.value;
    });

    return Array.from(uniqueMethods.values());
  }, [addedMachines, addedOtherPayments, directPayments]);

  return (
    <div className="glass-effect rounded-xl p-4 space-y-4">
      <h2 className="text-xl font-bold text-gray-800">Valores do Sistema</h2>
      {uniquePaymentMethods.length === 0 ? (
        <p className="text-gray-500 text-center py-4">Adicione valores para conciliar.</p>
      ) : (
        <div className="space-y-3">
          {uniquePaymentMethods.map(method => {
            const key = `payment-${method.id}`;
            const systemValue = systemValues[key] || 0;
            const diff = systemValue - method.totalConferred;

            return (
              <div key={key} className="grid grid-cols-3 items-center gap-2 text-sm p-3 border rounded-lg bg-white/50">
                <label className="col-span-1 font-semibold">{method.name}</label>
                <Input
                  type="number"
                  value={systemValue}
                  onChange={e => onSystemValueChange(key, e.target.value)}
                  className="h-8"
                  placeholder="0,00"
                />
                <span className={`text-right font-semibold ${diff !== 0 ? 'text-red-500' : 'text-green-600'}`}>
                  {diff.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SistemaSection;