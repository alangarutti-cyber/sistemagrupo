import React, { useState, useEffect, useCallback } from 'react';
    import { motion, AnimatePresence } from 'framer-motion';
    import { Download, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { toast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useUser } from '@/contexts/UserContext';
    import { cn } from '@/lib/utils';
    import { format as formatDate, startOfMonth, endOfMonth } from 'date-fns';

    const DetailCard = ({ title, data, headers, isLoading, onExport, renderItem }) => (
      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-semibold text-base">{title}</h4>
          <Button variant="outline" size="sm" onClick={onExport} disabled={isLoading || !data || data.length === 0}>
            <Download className="h-3 w-3 mr-2" />
            Exportar (CSV)
          </Button>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center p-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2">Buscando detalhes...</span>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-100 dark:bg-gray-700">
                <tr className="border-b">
                  {headers.map(header => <th key={header.key} className={`py-2 px-4 text-left font-semibold ${header.className}`}>{header.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {data && data.length > 0 ? (
                  data.map((item, index) => renderItem(item, index))
                ) : (
                  <tr><td colSpan={headers.length} className="py-4 px-4 text-center text-muted-foreground">Nenhum detalhe encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );

    const renderValue = (value) => {
        if (typeof value === 'number') {
          return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
        return value || 'R$ 0,00';
    };

    const DreRow = ({ label, value, percentage, details = [], isSub, isHeader, isTotal, onToggle, isOpen, valueClass, children }) => {
      const hasDetails = children != null;
      
      return (
        <>
          <motion.tr 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className={cn(
              "cursor-pointer hover:bg-muted/30",
              isHeader && "bg-muted/50 font-semibold",
              isTotal && "bg-muted/80 font-bold text-lg"
            )}
            onClick={onToggle}
          >
            <td className={cn("px-2 py-3 sm:px-6 sm:py-4 text-sm sm:text-base", isSub && "pl-8")}>
              <div className="flex items-center">
                {hasDetails && (isOpen ? <ChevronDown className="h-4 w-4 mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />)}
                <span className={cn(!hasDetails && "ml-6")}>{label}</span>
              </div>
            </td>
            <td className={cn("px-2 py-3 sm:px-6 sm:py-4 text-right text-sm sm:text-base font-mono", valueClass)}>
              {value}
            </td>
            <td className="px-2 py-3 sm:px-6 sm:py-4 text-right text-muted-foreground text-sm sm:text-base font-mono">
              {percentage}
            </td>
          </motion.tr>
          <AnimatePresence>
            {isOpen && hasDetails && (
              <motion.tr
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-background"
              >
                <td colSpan={3} className="p-0">
                  <div className="p-4">
                    {children}
                  </div>
                </td>
              </motion.tr>
            )}
          </AnimatePresence>
        </>
      );
    };

    const DRE = () => {
      const { user, companies, userCompanyAccess } = useUser();
      const [selectedCompany, setSelectedCompany] = useState('all');
      const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
      const [dreData, setDreData] = useState(null);
      const [loading, setLoading] = useState(true);
      const [openRows, setOpenRows] = useState({});
      const [detailData, setDetailData] = useState({});
      const [detailLoading, setDetailLoading] = useState(false);

      const allowedCompanies = React.useMemo(() => {
        if (!user || !companies || !userCompanyAccess) return [];
        if(user.is_admin) return companies;
        const companyIds = userCompanyAccess.map(access => access.company_id);
        return companies.filter(c => companyIds.includes(c.id));
      }, [user, companies, userCompanyAccess]);

      const allowedCompanyIds = React.useMemo(() => allowedCompanies.map(c => c.id), [allowedCompanies]);

      useEffect(() => {
        if (allowedCompanies.length === 1) {
          setSelectedCompany(allowedCompanies[0].id.toString());
        }
      }, [allowedCompanies]);

      const fetchDreData = useCallback(async () => {
        setLoading(true);
        setOpenRows({});
        setDetailData({});
        const [year, month] = selectedMonth.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];

        let query = supabase.from('dre_relatorio_view').select('*');
        
        const companyIdsToFilter = selectedCompany !== 'all' ? [parseInt(selectedCompany)] : allowedCompanyIds;

        if (companyIdsToFilter.length === 0) {
            setLoading(false);
            setDreData(null);
            return;
        }
        
        query = query.in('company_id', companyIdsToFilter)
                     .gte('data_fechamento', startDate)
                     .lte('data_fechamento', endDate);
        
        const { data, error } = await query;

        if (error) {
          toast({ title: "Erro ao buscar dados do DRE", description: error.message, variant: "destructive" });
          setLoading(false);
          return;
        }

        const consolidated = data.reduce((acc, row) => {
            acc.receita_bruta += row.receita_bruta;
            acc.deducoes_receita += row.deducoes_receita;
            acc.receita_liquida += row.receita_liquida;
            acc.custo_cmv += row.custo_cmv;
            acc.despesas_operacionais += row.despesas_operacionais;
            acc.despesas_administrativas += row.despesas_administrativas;
            acc.lucro_bruto += row.lucro_bruto;
            acc.lucro_operacional += row.lucro_operacional;
            return acc;
        }, {
            receita_bruta: 0, deducoes_receita: 0, receita_liquida: 0, custo_cmv: 0, despesas_operacionais: 0, despesas_administrativas: 0, lucro_bruto: 0, lucro_operacional: 0,
        });

        consolidated.perc_taxas = consolidated.receita_bruta > 0 ? consolidated.deducoes_receita / consolidated.receita_bruta : 0;
        consolidated.perc_lucro_bruto = consolidated.receita_liquida > 0 ? consolidated.lucro_bruto / consolidated.receita_liquida : 0;

        setDreData(consolidated);
        setLoading(false);
      }, [selectedCompany, selectedMonth, allowedCompanyIds, toast]);


      useEffect(() => {
        if (allowedCompanyIds.length > 0) {
          fetchDreData();
        }
      }, [fetchDreData, allowedCompanyIds]);

      const fetchDetailData = useCallback(async (rowId) => {
        if (detailData[rowId]) return;

        setDetailLoading(true);
        const [year, month] = selectedMonth.split('-');
        const startDate = startOfMonth(new Date(year, month - 1, 15));
        const endDate = endOfMonth(new Date(year, month - 1, 15));
        const companyIdsToFilter = selectedCompany !== 'all' ? [parseInt(selectedCompany)] : allowedCompanyIds;

        let data = [];
        let error = null;

        try {
            if (rowId === 'receita_bruta') {
                ({ data, error } = await supabase.from('cash_closings').select('*, company:companies(name)').in('company_id', companyIdsToFilter).gte('closing_date', formatDate(startDate, 'yyyy-MM-dd')).lte('closing_date', formatDate(endDate, 'yyyy-MM-dd')));
            } else if (rowId === 'deducoes_receita') {
                const { data: ifoodData, error: ifoodError } = await supabase.from('ifood_transactions').select('data_pedido, valor_taxa, company_id, company:companies(name)').in('company_id', companyIdsToFilter).gte('data_pedido', formatDate(startDate, 'yyyy-MM-dd')).lte('data_pedido', formatDate(endDate, 'yyyy-MM-dd'));
                if (ifoodError) throw ifoodError;
                
                const { data: closingData, error: closingError } = await supabase.from('cash_closings').select('closing_date, total_taxas, company_id, company:companies(name)').in('company_id', companyIdsToFilter).gte('closing_date', formatDate(startDate, 'yyyy-MM-dd')).lte('closing_date', formatDate(endDate, 'yyyy-MM-dd'));
                if (closingError) throw closingError;

                const combinedData = [];
                ifoodData.forEach(d => combinedData.push({ date: d.data_pedido, description: 'Taxas iFood', amount: d.valor_taxa, company: d.company.name }));
                closingData.forEach(d => d.total_taxas > 0 && combinedData.push({ date: d.closing_date, description: 'Taxas de Cartão (Fechamento)', amount: d.total_taxas, company: d.company.name }));
                data = combinedData;

            } else if (rowId === 'cmv') {
                ({ data, error } = await supabase.from('expenses').select('*, company:companies(name)').in('company_id', companyIdsToFilter).eq('tipo', 'CMV').gte('data', formatDate(startDate, 'yyyy-MM-dd')).lte('data', formatDate(endDate, 'yyyy-MM-dd')));
            }
        } catch(e) {
            error = e;
        }

        if (error) {
            toast({ title: `Erro ao buscar detalhes de ${rowId}`, description: error.message, variant: "destructive" });
        } else {
            setDetailData(prev => ({...prev, [rowId]: data}));
        }
        setDetailLoading(false);

      }, [selectedMonth, selectedCompany, allowedCompanyIds, toast, detailData]);

      const handleToggleRow = (rowId) => {
        const isOpen = !openRows[rowId];
        setOpenRows(prev => ({ ...prev, [rowId]: isOpen }));
        if (isOpen && rowId !== 'lucro_bruto') {
            fetchDetailData(rowId);
        }
      };

      const exportToCsv = (data, filename, headers) => {
        if (!data || data.length === 0) {
            toast({ title: "Nenhum dado para exportar.", variant: "destructive" });
            return;
        }
        const csvContent = "data:text/csv;charset=utf-8," 
            + headers.map(h => h.label).join(",") + "\n" 
            + data.map(row => headers.map(h => {
                let val = row[h.key];
                if (h.key === 'amount' || h.key === 'valor' || h.key === 'valor_taxa' || h.key === 'total_taxas') {
                    val = typeof val === 'number' ? val.toFixed(2) : '0.00';
                }
                if (typeof val === 'string') val = `"${val.replace(/"/g, '""')}"`;
                if (h.key.includes('date') || h.key.includes('data')) {
                    val = formatDate(new Date(val), 'dd/MM/yyyy');
                }
                if (h.key === 'company.name') {
                  val = row.company.name;
                }
                return val;
            }).join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${filename}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: "Exportação concluída!" });
      };

      const renderPercentage = (value) => {
        if (typeof value === 'number' && isFinite(value)) {
          return `${(value * 100).toFixed(2)}%`;
        }
        return '0.00%';
      };
      
      const getPercentageOfRevenue = (value, total) => {
          if (total === 0 || typeof value !== 'number' || typeof total !== 'number') {
              return 0;
          }
          return (value / total);
      }

      return (
        <div className="space-y-6 p-0 md:p-4">
          <div className="bg-card/80 backdrop-blur-sm border rounded-xl p-4 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-foreground mb-2">Empresa</label>
                <select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)} className="w-full px-4 py-2 rounded-lg border bg-background focus:ring-2 focus:ring-primary">
                  <option value="all">Consolidado</option>
                  {allowedCompanies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-foreground mb-2">Período</label>
                <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-full px-4 py-2 rounded-lg border bg-background focus:ring-2 focus:ring-primary" />
              </div>
              <div className="flex items-end">
                 <Button onClick={fetchDreData} className="w-full" disabled={loading}>{loading ? <Loader2 className="animate-spin mr-2"/> : null}Filtrar</Button>
              </div>
              <div className="flex items-end">
                <Button onClick={() => toast({ title: "Em breve!" })} className="w-full"><Download className="w-4 h-4 mr-2" />Exportar DRE</Button>
              </div>
            </div>
          </div>

          <div className="bg-card/80 backdrop-blur-sm border rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-10 text-center text-muted-foreground">Carregando DRE...</div>
              ) : !dreData || dreData.receita_bruta === 0 ? (
                <div className="p-10 text-center text-muted-foreground">Nenhum dado encontrado para o período selecionado.</div>
              ) : (
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-2 py-3 sm:px-6 sm:py-4 text-left font-semibold text-muted-foreground text-sm sm:text-base">Conta</th>
                      <th className="px-2 py-3 sm:px-6 sm:py-4 text-right font-semibold text-muted-foreground text-sm sm:text-base">Valor</th>
                      <th className="px-2 py-3 sm:px-6 sm:py-4 text-right font-semibold text-muted-foreground text-sm sm:text-base">% da Receita Bruta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <DreRow 
                      label="Receita Bruta" 
                      value={renderValue(dreData.receita_bruta)}
                      percentage={renderPercentage(1)}
                      isHeader valueClass="text-emerald-600"
                      isOpen={openRows['receita_bruta']}
                      onToggle={() => handleToggleRow('receita_bruta')}
                    >
                      <DetailCard
                        title="Detalhes da Receita Bruta"
                        isLoading={detailLoading && !detailData['receita_bruta']}
                        data={detailData['receita_bruta']}
                        headers={[
                          { label: 'Data', key: 'closing_date' },
                          { label: 'Empresa', key: 'company.name' },
                          { label: 'Total Conferido', key: 'total_conferred', className: 'text-right' },
                          { label: 'iFood', key: 'valor_ifood_online', className: 'text-right' },
                          { label: 'Dinheiro', key: 'valor_dinheiro', className: 'text-right' },
                          { label: 'Pix', key: 'valor_pix_cnpj', className: 'text-right' },
                        ]}
                        onExport={() => exportToCsv(detailData['receita_bruta'], 'detalhes_receita_bruta', [
                          { label: 'Data', key: 'closing_date' },
                          { label: 'Empresa', key: 'company.name' },
                          { label: 'TotalConferido', key: 'total_conferred' },
                          { label: 'iFoodOnline', key: 'valor_ifood_online' },
                          { label: 'Dinheiro', key: 'valor_dinheiro' },
                          { label: 'PixCNPJ', key: 'valor_pix_cnpj' }
                        ])}
                        renderItem={(item, index) => (
                           <tr key={index} className="border-b border-gray-200 dark:border-gray-700 last:border-0">
                            <td className="py-2 px-4">{formatDate(new Date(item.closing_date), 'dd/MM/yyyy')}</td>
                            <td className="py-2 px-4">{item.company.name}</td>
                            <td className="py-2 px-4 text-right font-mono">{renderValue(item.total_conferred)}</td>
                            <td className="py-2 px-4 text-right font-mono">{renderValue(item.valor_ifood_online)}</td>
                            <td className="py-2 px-4 text-right font-mono">{renderValue(item.valor_dinheiro)}</td>
                            <td className="py-2 px-4 text-right font-mono">{renderValue(item.valor_pix_cnpj)}</td>
                          </tr>
                        )}
                      />
                    </DreRow>
                    
                    <DreRow 
                      label="(-) Deduções da Receita" 
                      value={renderValue(-(dreData.deducoes_receita || 0))}
                      percentage={renderPercentage(dreData.perc_taxas)}
                      isSub valueClass="text-red-600"
                      isOpen={openRows['deducoes_receita']}
                      onToggle={() => handleToggleRow('deducoes_receita')}
                    >
                      <DetailCard
                        title="Detalhes das Deduções"
                        isLoading={detailLoading && !detailData['deducoes_receita']}
                        data={detailData['deducoes_receita']}
                        headers={[
                           { label: 'Data', key: 'date' },
                           { label: 'Descrição', key: 'description' },
                           { label: 'Empresa', key: 'company' },
                           { label: 'Valor', key: 'amount', className: 'text-right' }
                        ]}
                        onExport={() => exportToCsv(detailData['deducoes_receita'], 'detalhes_deducoes', [
                          { label: 'Data', key: 'date' }, { label: 'Descricao', key: 'description' }, { label: 'Empresa', key: 'company' }, { label: 'Valor', key: 'amount' }
                        ])}
                        renderItem={(item, index) => (
                          <tr key={index} className="border-b border-gray-200 dark:border-gray-700 last:border-0">
                            <td className="py-2 px-4">{formatDate(new Date(item.date), 'dd/MM/yyyy')}</td>
                            <td className="py-2 px-4">{item.description}</td>
                            <td className="py-2 px-4">{item.company}</td>
                            <td className="py-2 px-4 text-right font-mono">{renderValue(item.amount)}</td>
                          </tr>
                        )}
                      />
                    </DreRow>

                    <DreRow 
                      label="(=) Receita Líquida" 
                      value={renderValue(dreData.receita_liquida)}
                      percentage={renderPercentage(getPercentageOfRevenue(dreData.receita_liquida, dreData.receita_bruta))}
                      isHeader valueClass={dreData.receita_liquida >= 0 ? 'text-emerald-600' : 'text-red-600'}
                    />

                    <DreRow 
                      label="(-) CMV (Custo Mercadorias Vendidas)" 
                      value={renderValue(-(dreData.custo_cmv || 0))}
                      percentage={renderPercentage(getPercentageOfRevenue(dreData.custo_cmv, dreData.receita_bruta))}
                      isSub valueClass="text-red-600"
                      isOpen={openRows['cmv']}
                      onToggle={() => handleToggleRow('cmv')}
                    >
                       <DetailCard
                        title="Detalhes do CMV"
                        isLoading={detailLoading && !detailData['cmv']}
                        data={detailData['cmv']}
                        headers={[
                           { label: 'Data', key: 'data' },
                           { label: 'Descrição', key: 'descricao' },
                           { label: 'Empresa', key: 'company.name' },
                           { label: 'Valor', key: 'valor', className: 'text-right' }
                        ]}
                        onExport={() => exportToCsv(detailData['cmv'], 'detalhes_cmv', [
                          { label: 'Data', key: 'data' }, { label: 'Descricao', key: 'descricao' }, { label: 'Empresa', key: 'company.name' }, { label: 'Valor', key: 'valor' }
                        ])}
                        renderItem={(item, index) => (
                          <tr key={index} className="border-b border-gray-200 dark:border-gray-700 last:border-0">
                            <td className="py-2 px-4">{formatDate(new Date(item.data), 'dd/MM/yyyy')}</td>
                            <td className="py-2 px-4">{item.descricao}</td>
                            <td className="py-2 px-4">{item.company.name}</td>
                            <td className="py-2 px-4 text-right font-mono">{renderValue(item.valor)}</td>
                          </tr>
                        )}
                      />
                    </DreRow>
                    
                    <DreRow 
                      label="(=) Lucro Bruto" 
                      value={renderValue(dreData.lucro_bruto)}
                      percentage={renderPercentage(dreData.perc_lucro_bruto)}
                      isHeader valueClass={dreData.lucro_bruto >= 0 ? 'text-emerald-600' : 'text-red-600'}
                      isOpen={openRows['lucro_bruto']}
                      onToggle={() => handleToggleRow('lucro_bruto')}
                    >
                        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                           <h4 className="font-semibold text-base mb-2">Composição do Lucro Bruto</h4>
                           <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span>Receita Líquida</span> <span className="font-mono">{renderValue(dreData.receita_liquida)}</span></div>
                            <div className="flex justify-between"><span>(-) CMV</span> <span className="font-mono">{renderValue(-(dreData.custo_cmv || 0))}</span></div>
                            <hr/>
                            <div className="flex justify-between font-bold"><span>(=) Lucro Bruto</span> <span className="font-mono">{renderValue(dreData.lucro_bruto)}</span></div>
                            <div className="flex justify-between text-muted-foreground"><span>Margem Bruta</span> <span className="font-mono">{renderPercentage(dreData.perc_lucro_bruto)}</span></div>
                           </div>
                        </div>
                    </DreRow>
                    
                     <DreRow 
                      label="(-) Despesas Operacionais" 
                      value={renderValue(-(dreData.despesas_operacionais || 0))}
                      percentage={renderPercentage(getPercentageOfRevenue(dreData.despesas_operacionais, dreData.receita_bruta))}
                      isSub valueClass="text-red-600"
                    />
                    <DreRow 
                      label="(-) Despesas Administrativas" 
                      value={renderValue(-(dreData.despesas_administrativas || 0))}
                      percentage={renderPercentage(getPercentageOfRevenue(dreData.despesas_administrativas, dreData.receita_bruta))}
                      isSub valueClass="text-red-600"
                    />
                    <DreRow 
                      label="(=) Lucro/Prejuízo Operacional" 
                      value={renderValue(dreData.lucro_operacional)}
                      percentage={renderPercentage(getPercentageOfRevenue(dreData.lucro_operacional, dreData.receita_bruta))}
                      isTotal valueClass={dreData.lucro_operacional >= 0 ? 'text-emerald-600' : 'text-red-600'}
                    />
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      );
    };

    export default DRE;