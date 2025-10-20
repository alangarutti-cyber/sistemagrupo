import React from 'react';

    const PrintableStockList = React.forwardRef(({ products, company }, ref) => {
      const totalStockValue = products.reduce((acc, product) => {
        const value = (product.current_stock || 0) * (product.cost_price || 0);
        return acc + value;
      }, 0);

      return (
        <div ref={ref} className="p-8">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold mb-2">Listagem de Estoque</h1>
            {company && <h2 className="text-xl">{company.name}</h2>}
            <p className="text-sm text-gray-600">Gerado em: {new Date().toLocaleString()}</p>
          </div>

          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-100">
              <tr>
                <th scope="col" className="px-4 py-3">Produto</th>
                <th scope="col" className="px-4 py-3">Categoria</th>
                <th scope="col" className="px-4 py-3 text-right">Estoque Atual</th>
                <th scope="col" className="px-4 py-3 text-right">Custo Unit.</th>
                <th scope="col" className="px-4 py-3 text-right">Valor Total</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => (
                <tr key={product.id} className="border-b">
                  <td className="px-4 py-2 font-medium text-gray-900 whitespace-nowrap">{product.name}</td>
                  <td className="px-4 py-2">{product.product_categories?.name || 'N/A'}</td>
                  <td className="px-4 py-2 text-right">{`${product.current_stock || 0} ${product.unit}`}</td>
                  <td className="px-4 py-2 text-right">R$ {parseFloat(product.cost_price || 0).toFixed(2)}</td>
                  <td className="px-4 py-2 text-right font-semibold">R$ {((product.current_stock || 0) * (product.cost_price || 0)).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold text-gray-900 bg-gray-50">
                <td colSpan="4" className="px-4 py-3 text-base text-right">Valor Total do Estoque (CMV)</td>
                <td className="px-4 py-3 text-base text-right">R$ {totalStockValue.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      );
    });

    PrintableStockList.displayName = 'PrintableStockList';

    export default PrintableStockList;