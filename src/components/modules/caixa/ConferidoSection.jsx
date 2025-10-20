import React from 'react';
    import { Trash2 } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    
    const ConferidoSection = ({ directPayments, addedMachines, onRemoveDirectPayment, onRemoveMachine }) => {
        const formatCurrency = (value) => `R$ ${value.toFixed(2).replace('.', ',')}`;
        
        const totalConferido = [
            ...directPayments.map(p => p.value),
            ...addedMachines.flatMap(m => m.payments.map(p => p.value))
        ].reduce((sum, val) => sum + val, 0);

        return (
            <div className="glass-effect rounded-xl p-4 sm:p-6 space-y-4">
                <h3 className="font-bold text-lg">Entradas Conferidas</h3>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                    {directPayments.map((payment, index) => (
                        <div key={payment.id || index} className="flex justify-between items-center text-sm p-2 bg-indigo-50 rounded-lg">
                            <span className="font-medium">{payment.name}</span>
                            <div className="flex items-center gap-2">
                                <span className="font-bold">{formatCurrency(payment.value)}</span>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => onRemoveDirectPayment(payment.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}

                    {addedMachines.map((am) => (
                        <div key={am.machine.id} className="p-3 bg-blue-50 rounded-lg space-y-2">
                            <div className="flex justify-between items-center font-semibold text-blue-800">
                                <span>Máquina: {am.machine.serial_number}</span>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => onRemoveMachine(am.machine.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                            {am.payments.map((p, pIndex) => (
                                <div key={pIndex} className="flex justify-between items-center text-xs pl-4">
                                    <span>{p.name}</span>
                                    <span className="font-medium">{formatCurrency(p.value)}</span>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
                <div className="border-t pt-3 flex justify-between items-center font-bold text-lg">
                    <span>Total Conferido</span>
                    <span className="text-green-600">{formatCurrency(totalConferido)}</span>
                </div>
            </div>
        );
    };
    
    export default ConferidoSection;