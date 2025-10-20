import React from 'react';
    import { Input } from '@/components/ui/input';
    
    const SistemaSection = ({ directPayments, addedMachines, systemValues, onSystemValueChange }) => {
        const formatCurrency = (value) => `R$ ${value.toFixed(2).replace('.', ',')}`;

        const paymentMethods = new Map();
        directPayments.forEach(p => paymentMethods.set(p.name, p.name));
        addedMachines.flatMap(m => m.payments).forEach(p => paymentMethods.set(p.id, p.name));
        
        const totalSystem = Object.values(systemValues).reduce((sum, val) => sum + (val || 0), 0);

        return (
            <div className="glass-effect rounded-xl p-4 sm:p-6 space-y-4">
                <h3 className="font-bold text-lg">Valores do Sistema</h3>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                    {Array.from(paymentMethods.entries()).map(([id, name]) => (
                        <div key={id} className="flex justify-between items-center gap-4">
                            <span className="font-medium text-sm flex-1">{name}</span>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                                <Input
                                    type="number"
                                    placeholder="0,00"
                                    value={systemValues[`payment-${id}`] || ''}
                                    onChange={(e) => onSystemValueChange(`payment-${id}`, e.target.value)}
                                    className="pl-8 w-32"
                                />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="border-t pt-3 flex justify-between items-center font-bold text-lg">
                    <span>Total Sistema</span>
                    <span className="text-blue-600">{formatCurrency(totalSystem)}</span>
                </div>
            </div>
        );
    };
    
    export default SistemaSection;