import React from 'react';

const PrintableClosing = React.forwardRef(({ companyName, closingDate, user, data }, ref) => {
  const {
    addedMachines,
    addedOtherPayments,
    expenses,
    withdrawals,
    systemValues,
    valorAbertura,
    suprimentos,
    observacoes
  } = data;

  const totalConferido = 
    addedMachines.reduce((acc, am) => acc + am.payments.reduce((sum, p) => sum + p.value, 0), 0) +
    addedOtherPayments.reduce((acc, op) => acc + op.payments.reduce((sum, p) => sum + p.value, 0), 0);

  const totalExpenses = expenses.reduce((sum, e) => sum + e.value, 0);
  const totalWithdrawals = withdrawals.reduce((sum, w) => sum + w.value, 0);
  const totalSaidas = totalExpenses + totalWithdrawals;

  const saldoFinal = (valorAbertura + totalConferido + suprimentos) - totalSaidas;
  
  const totalSystem = Object.values(systemValues).reduce((sum, val) => sum + parseFloat(val), 0);
  const totalDifference = totalSystem - totalConferido;

  const formatCurrency = (value) => `R$ ${value.toFixed(2).replace('.', ',')}`;
  const formatDate = (dateString) => {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
  };

  const SectionTitle = ({ children }) => (
    <h2 className="text-xl font-bold border-b-2 border-gray-800 pb-2 mb-4 mt-6">{children}</h2>
  );

  const Table = ({ children }) => (
    <table className="w-full text-sm">
      <tbody>{children}</tbody>
    </table>
  );

  const Row = ({ label, value, isBold = false }) => (
    <tr className={isBold ? 'font-bold' : ''}>
      <td className="py-1 pr-4">{label}</td>
      <td className="py-1 text-right">{value}</td>
    </tr>
  );

  return (
    <div ref={ref} className="bg-white text-black p-8">
      <header className="text-center mb-8">
        <h1 className="text-3xl font-bold uppercase">{companyName}</h1>
        <p className="text-lg">Relatório de Fechamento de Caixa</p>
        <p className="text-sm text-gray-600">
          Data: {formatDate(closingDate)} às {new Date().toLocaleTimeString('pt-BR')}
        </p>
      </header>

      <main>
        <SectionTitle>Entradas</SectionTitle>
        <Table>
          <Row label="Valor de Abertura" value={formatCurrency(valorAbertura)} />
          <Row label="Suprimentos" value={formatCurrency(suprimentos)} />
        </Table>

        {addedMachines.map(({ machine, payments }) => (
          <div key={`print-machine-${machine.id}`} className="mt-4">
            <h3 className="font-semibold text-md mb-2">Máquina: {machine.serial_number} ({machine.operator.name})</h3>
            <Table>
              {payments.map(p => (
                <Row key={`print-payment-${p.id}`} label={p.name} value={formatCurrency(p.value)} />
              ))}
            </Table>
          </div>
        ))}

        {addedOtherPayments.map(({ operator, payments }) => (
          <div key={`print-other-${operator.id}`} className="mt-4">
            <h3 className="font-semibold text-md mb-2">Outros Pagamentos: {operator.name}</h3>
            <Table>
              {payments.map(p => (
                <Row key={`print-other-payment-${p.id}`} label={p.name} value={formatCurrency(p.value)} />
              ))}
            </Table>
          </div>
        ))}
        <Table>
            <Row label="Total de Vendas Conferido" value={formatCurrency(totalConferido)} isBold={true} />
        </Table>

        <SectionTitle>Saídas</SectionTitle>
        <Table>
          {expenses.map(e => (
            <Row key={`print-expense-${e.id}`} label={e.description} value={formatCurrency(e.value)} />
          ))}
          {withdrawals.map(w => (
            <Row key={`print-withdrawal-${w.id}`} label={`Retirada ${w.employee.name}`} value={formatCurrency(w.value)} />
          ))}
          <Row label="Total de Saídas" value={formatCurrency(totalSaidas)} isBold={true} />
        </Table>

        <SectionTitle>Resumo Final</SectionTitle>
        <Table>
          <Row label="Total Conferido (Vendas)" value={formatCurrency(totalConferido)} />
          <Row label="Total do Sistema" value={formatCurrency(totalSystem)} />
          <Row label="Diferença" value={formatCurrency(totalDifference)} isBold={true} />
          <tr className="text-lg font-bold bg-gray-100">
            <td className="py-2 pr-4">SALDO FINAL EM CAIXA</td>
            <td className="py-2 text-right">{formatCurrency(saldoFinal)}</td>
          </tr>
        </Table>

        {observacoes && (
          <>
            <SectionTitle>Observações</SectionTitle>
            <p className="text-sm p-4 border rounded-lg bg-gray-50">{observacoes}</p>
          </>
        )}
      </main>

      <footer className="mt-20 text-center">
        <div className="inline-block">
          <div className="border-t-2 border-gray-800 w-64 mx-auto pt-2">
            <p className="text-sm">Assinatura do Responsável</p>
            <p className="text-xs text-gray-600">({user?.name || 'N/A'})</p>
          </div>
        </div>
      </footer>
    </div>
  );
});

export default PrintableClosing;