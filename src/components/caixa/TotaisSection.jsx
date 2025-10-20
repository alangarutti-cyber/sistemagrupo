import React from 'react';

const TotaisSection = ({ 
  directPayments, 
  addedMachines, 
  addedOtherPayments, 
  expenses, 
  withdrawals,
  courtesies, 
  systemValues,
  valorAbertura,
  suprimentos
}) => {
  
  const formatCurrency = (value) => `R$ ${value.toFixed(2).replace('.', ',')}`;

  const totalDirect = directPayments.reduce((sum, p) => sum + p.value, 0);
  const totalMachine = addedMachines.reduce((acc, am) => acc + am.payments.reduce((sum, p) => sum + p.value, 0), 0);
  const totalOther = addedOtherPayments.reduce((acc, ap) => acc + ap.payments.reduce((sum, p) => sum + p.value, 0), 0);
  const totalConferido = totalDirect + totalMachine + totalOther;

  const totalExpenses = expenses.reduce((sum, e) => sum + e.value, 0);
  const totalWithdrawals = withdrawals.reduce((sum, w) => sum + w.value, 0);
  const totalCourtesies = courtesies.reduce((sum, c) => sum + c.value, 0);
  const totalSaidas = totalExpenses + totalWithdrawals + totalCourtesies;

  const saldoFinal = (valorAbertura + totalConferido + suprimentos) - totalSaidas;

  const totalSystem = Object.values(systemValues).reduce((sum, val) => sum + val, 0);

  const totalDifference = totalConferido - totalSystem;

  const getRowClass = (value) => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return '';
  };
  
  return (
    <div className="mt-6 glass-effect rounded-xl p-4 sm:p-6">
      <h3 className="font-bold text-lg mb-4">Totais e Resumo</h3>
      <div className="space-y-3">
        <div className="flex justify-between items-center text-sm p-2 rounded-md bg-gray-100">
          <span>(+) Valor Abertura:</span>
          <span>{formatCurrency(valorAbertura)}</span>
        </div>
        <div className="flex justify-between items-center text-sm p-2 rounded-md bg-gray-100">
          <span>(+) Total Vendas Conferido:</span>
          <span>{formatCurrency(totalConferido)}</span>
        </div>
        <div className="flex justify-between items-center text-sm p-2 rounded-md bg-gray-100">
          <span>(+) Suprimentos:</span>
          <span>{formatCurrency(suprimentos)}</span>
        </div>
        <div className="flex justify-between items-center text-sm p-2 rounded-md bg-gray-100">
          <span>(-) Total Saídas (Despesas/Retiradas/Cortesias):</span>
          <span>{formatCurrency(totalSaidas)}</span>
        </div>
        <div className="flex justify-between items-center font-bold text-lg mt-2 p-3 rounded-md bg-blue-100 text-blue-800">
          <span>(=) SALDO FINAL (CAIXA):</span>
          <span>{formatCurrency(saldoFinal)}</span>
        </div>
      </div>
      <div className="mt-6 border-t pt-4 space-y-3">
        <div className="flex justify-between items-center font-semibold text-base p-2 rounded-md bg-yellow-100">
          <span>Total Sistema:</span>
          <span>{formatCurrency(totalSystem)}</span>
        </div>
        <div className="flex justify-between items-center font-semibold text-base p-2 rounded-md bg-yellow-100">
          <span>Total Conferido:</span>
          <span>{formatCurrency(totalConferido)}</span>
        </div>
        <div className={`flex justify-between items-center font-bold text-lg mt-2 p-3 rounded-md ${getRowClass(totalDifference).replace('text-', 'bg-').replace('-600', '-100')} ${getRowClass(totalDifference)}`}>
          <span>Diferença (Conferido - Sistema):</span>
          <span>{formatCurrency(totalDifference)}</span>
        </div>
      </div>
    </div>
  );
};

export default TotaisSection;