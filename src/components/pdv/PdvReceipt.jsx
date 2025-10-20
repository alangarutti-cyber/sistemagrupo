import React, { useState, useEffect, forwardRef } from 'react';
import QRCode from 'qrcode.react';
import { supabase } from '@/lib/customSupabaseClient';

const PdvReceipt = forwardRef(({ sale }, ref) => {
  const [pixData, setPixData] = useState(null);
  const [loadingPix, setLoadingPix] = useState(false);

  useEffect(() => {
    const generatePix = async () => {
      if (!sale || !sale.total_value || !sale.id || !sale.company?.name || !sale.payments?.some(p => p.name.toLowerCase().includes('pix'))) {
        setPixData(null);
        return;
      }
      
      setLoadingPix(true);
      try {
        const payerEmail = (sale.clientName && sale.clientName !== 'Consumidor Final') ? 'cliente@email.com' : 'consumidor.final@email.com';

        const { data: functionData, error: functionError } = await supabase.functions.invoke('generate-pix-payment', {
          body: JSON.stringify({
            transaction_amount: sale.total_value,
            description: `Venda PDV #${sale.id.substring(0,8)} - ${sale.company.name}`,
            payer_email: payerEmail,
            external_reference: `pdv_sale_${sale.id}`,
          }),
        });

        if (functionError) throw functionError;
        
        setPixData({
          qrCode: functionData.point_of_interaction.transaction_data.qr_code,
        });
      } catch (error) {
        console.error('Erro ao gerar PIX para o cupom:', error);
        setPixData(null);
      } finally {
        setLoadingPix(false);
      }
    };

    generatePix();
  }, [sale]);

  if (!sale) return null;

  const { company, id, clientName, items, total_value, created_at, payments, change } = sale;

  return (
    <div ref={ref} className="bg-white text-black p-2 font-mono" style={{ width: '80mm' }}>
      <div className="text-center">
        <h2 className="font-bold text-sm">{company?.name || 'Empresa não informada'}</h2>
        <p className="text-xs">CNPJ: {company?.cnpj || ''}</p>
      </div>
      <hr className="border-dashed border-black my-2" />
      <div className="text-xs">
        <p>CUPOM NÃO FISCAL</p>
        <p>Pedido: #{id?.substring(0, 8) || ''}</p>
        <p>Cliente: {clientName || 'Não identificado'}</p>
        <p>Data: {created_at ? new Date(created_at).toLocaleString('pt-BR') : ''}</p>
      </div>
      <hr className="border-dashed border-black my-2" />
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left">Item</th>
            <th className="text-center">Qtd</th>
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {items?.map(item => (
            <tr key={`${item.id}-${item.price}`}>
              <td className="break-words pr-1">{item.name}</td>
              <td className="text-center align-top">{item.quantity}</td>
              <td className="text-right align-top">{(item.price * item.quantity).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <hr className="border-dashed border-black my-2" />
      <div className="text-right text-xs space-y-1">
        {payments?.map((p, i) => (
            <div key={i} className="flex justify-between">
                <span>{p.name}:</span>
                <span>R$ {p.value.toFixed(2)}</span>
            </div>
        ))}
        <div className="flex justify-between font-bold text-sm">
            <span>TOTAL:</span>
            <span>R$ {total_value?.toFixed(2) || '0.00'}</span>
        </div>
        {change > 0 && (
            <div className="flex justify-between">
                <span>Troco:</span>
                <span>R$ {change.toFixed(2)}</span>
            </div>
        )}
      </div>
      <hr className="border-dashed border-black my-2" />
      <div className="text-center text-xs mt-2">
        <p>Obrigado pela preferência!</p>
        <p>Stout System</p>
      </div>
      {loadingPix ? (
        <p className="text-center text-xs mt-4">Gerando QR Code PIX...</p>
      ) : pixData ? (
        <div className="flex flex-col items-center mt-4">
          <p className="font-bold text-xs mb-2">Pague com PIX</p>
          <QRCode value={pixData.qrCode} size={128} />
        </div>
      ) : (
        payments?.some(p => p.name.toLowerCase().includes('pix')) && <p className="text-center text-xs mt-4 text-red-500">Erro ao gerar QR Code PIX.</p>
      )}
    </div>
  );
});

export default PdvReceipt;