import React from 'react';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

const ConferidoSection = ({ directPayments, addedMachines, addedOtherPayments, onRemoveMachine, onRemoveOtherPayment, onRemoveDirectPayment }) => {
  const totalConferido = 
    directPayments.reduce((acc, dp) => acc + dp.value, 0) +
    addedMachines.reduce((acc, am) => acc + am.payments.reduce((sum, p) => sum + p.value, 0), 0) +
    addedOtherPayments.reduce((acc, op) => acc + op.payments.reduce((sum, p) => sum + p.value, 0), 0);

  return (
    <div className="glass-effect rounded-xl p-4 space-y-4">
      <div className="flex justify-between items-baseline">
        <h2 className="text-xl font-bold text-gray-800">Valores Conferidos</h2>
        <div className="text-right">
          <p className="text-sm text-gray-600">Total</p>
          <p className="text-2xl font-bold text-indigo-600">R$ {totalConferido.toFixed(2)}</p>
        </div>
      </div>

      {addedMachines.length === 0 && addedOtherPayments.length === 0 && directPayments.length === 0 ? (
        <p className="text-gray-500 text-center py-4">Nenhum valor de entrada adicionado.</p>
      ) : (
        <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
          {directPayments.map((payment) => (
             <div key={payment.id} className="border rounded-lg p-3 bg-white/50">
               <div className="flex justify-between items-center">
                 <p className="font-bold">{payment.name}</p>
                 <div className="flex items-center gap-2">
                   <span className="font-semibold">R$ {payment.value.toFixed(2)}</span>
                   <Button variant="ghost" size="icon" onClick={() => onRemoveDirectPayment(payment.id)}>
                     <Trash2 className="w-4 h-4 text-red-500" />
                   </Button>
                 </div>
               </div>
             </div>
           ))}
          {addedMachines.map(({ machine, payments }) => (
            <div key={`machine-${machine.id}`} className="border rounded-lg p-3 bg-white/50">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <p className="font-bold">{machine.serial_number} ({machine.machine_number})</p>
                  <p className="text-sm text-gray-600">{machine.operator.name}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => onRemoveMachine(machine.id)}>
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
              <ul className="text-sm space-y-1">
                {payments.map(p => (
                  <li key={p.id} className="flex justify-between">
                    <span>{p.name}</span>
                    <span>R$ {p.value.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-right font-bold mt-2 border-t pt-1">
                Total: R$ {payments.reduce((s, p) => s + p.value, 0).toFixed(2)}
              </p>
            </div>
          ))}
          {addedOtherPayments.map(({ operator, payments }) => (
            <div key={`other-${operator.id}`} className="border rounded-lg p-3 bg-white/50">
              <div className="flex justify-between items-center mb-2">
                <p className="font-bold">{operator.name}</p>
                <Button variant="ghost" size="icon" onClick={() => onRemoveOtherPayment(operator.id)}>
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
              <ul className="text-sm space-y-1">
                {payments.map(p => (
                  <li key={p.id} className="flex justify-between">
                    <span>{p.name}</span>
                    <span>R$ {p.value.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-right font-bold mt-2 border-t pt-1">
                Total: R$ {payments.reduce((s, p) => s + p.value, 0).toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ConferidoSection;