import React, { useMemo } from 'react';

    const TotaisSection = ({ directPayments, addedMachines, expenses, withdrawals, systemValues, valorAbertura, suprimentos }) => {
        
        const formatCurrency = (value) => {
            const formatted = isNaN(value) ? 0 : value;
            return formatted.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        };
    
        const totalConferido = useMemo(() => {
            const directTotal = directPayments.reduce((acc, dp) => acc + dp.value, 0);
            const machineTotal = addedMachines.reduce((acc, am) => acc + am.payments.reduce((sum, p) => sum + p.value, 0), 0);
            return directTotal + machineTotal;
        }, [directPayments, addedMachines]);
    
        const totalSystem = useMemo(() => {
            return Object.values(systemValues).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
        }, [systemValues]);
    
        const totalExpenses = useMemo(() => expenses.reduce((sum, e) => sum + e.value, 0), [expenses]);
        const totalWithdrawals = useMemo(() => withdrawals.reduce((sum, w) => sum + w.value, 0), [withdrawals]);
        const totalSaidas = totalExpenses + totalWithdrawals;
    
        const saldoFinal = (valorAbertura + totalConferido + suprimentos) - totalSaidas;
        const totalDifference = totalConferido - totalSystem;
    
        return (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="glass-effect rounded-xl p-4 text-center">
                    <h4 className="text-lg font-bold text-gray-700">Diferença de Caixa</h4>
                    <p className={`text-3xl font-extrabold mt-2 ${totalDifference < 0 ? 'text-red-500' : 'text-green-600'}`}>{formatCurrency(totalDifference)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Conferido vs. Sistema</p>
                </div>
                <div className="glass-effect rounded-xl p-4 text-center">
                    <h4 className="text-lg font-bold text-gray-700">Total de Saídas</h4>
                    <p className="text-3xl font-extrabold text-red-600 mt-2">{formatCurrency(totalSaidas)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Despesas + Retiradas</p>
                </div>
                <div className="glass-effect rounded-xl p-4 text-center">
                    <h4 className="text-lg font-bold text-gray-700">Total Faturamento</h4>
                    <p className="text-3xl font-extrabold text-emerald-600 mt-2">{formatCurrency(totalConferido)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Soma das entradas</p>
                </div>
                <div className="glass-effect rounded-xl p-4 text-center bg-blue-100 border-blue-300">
                    <h4 className="text-lg font-bold text-blue-800">Saldo Final</h4>
                    <p className="text-3xl font-extrabold text-blue-700 mt-2">{formatCurrency(saldoFinal)}</p>
                    <p className="text-xs text-blue-600 mt-1">Total em caixa</p>
                </div>
            </div>
        );
    };
    
    export default TotaisSection;