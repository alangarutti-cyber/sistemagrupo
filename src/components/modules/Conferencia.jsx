
    import React, { useState, useEffect, useCallback } from 'react';
    import { motion } from 'framer-motion';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import { Check, X, Eye, AlertTriangle, RefreshCw, DollarSign, Zap, Users, Trash2, Edit, Save } from 'lucide-react';
    import { useUser } from '@/contexts/UserContext';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
    import { format, startOfMonth, endOfMonth, addDays } from 'date-fns';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';

    const Conferencia = () => {
      const { user, userCompanyAccess, companies } = useUser();
      const { toast } = useToast();
      
      const [pendingClosings, setPendingClosings] = useState([]);
      const [pendingContas, setPendingContas] = useState([]);
      const [pendingPayments, setPendingPayments] = useState([]);
      
      const [selectedItem, setSelectedItem] = useState(null);
      const [selectedType, setSelectedType] = useState(null);
      
      const [isLoading, setIsLoading] = useState(true);
      const [error, setError] = useState(null);
      
      const [allowedCompanies, setAllowedCompanies] = useState([]);
      const [selectedCompanies, setSelectedCompanies] = useState([]);
      const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
      const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

      const [adminConferredValues, setAdminConferredValues] = useState({});
      const [isEditing, setIsEditing] = useState(false);
      
      const dreGroupIds = {
        'Receita Bruta': '9eb73907-d1db-4df2-8879-4565e1b15f0f',
        'Deduções da Receita': '3779029e-dc3b-4aef-bb1b-8ec0984661f3',
        'Despesas Operacionais': '00b83b6e-4a3f-49fd-a3de-455656379598',
        'CMV': 'a1b2c3d4-e5f6-7890-1234-567890abcdef'
      };

      useEffect(() => {
        if (user && userCompanyAccess && companies) {
          const userCompanyIds = userCompanyAccess.filter(access => access.user_id === user.id).map(access => access.company_id);
          const accessibleCompanies = companies.filter(c => userCompanyIds.includes(c.id));
          setAllowedCompanies(accessibleCompanies);
          setSelectedCompanies(accessibleCompanies.map(c => c.id));
        }
      }, [user, userCompanyAccess, companies]);

      const fetchData = useCallback(async () => {
        if (selectedCompanies.length === 0) {
          setIsLoading(false);
          setPendingClosings([]);
          setPendingContas([]);
          setPendingPayments([]);
          return;
        }

        setIsLoading(true);
        setError(null);
        try {
          const [closings, contasPagar, contasReceber, payments] = await Promise.all([
            supabase
              .from('cash_closings')
              .select('*, company:companies(name), user:app_users!cash_closings_user_id_fkey(name)')
              .eq('status', 'Pendente')
              .in('company_id', selectedCompanies)
              .gte('closing_date', startDate)
              .lte('closing_date', endDate)
              .order('closing_date', { ascending: false }),
            supabase
              .from('contas_pagar')
              .select('*, company:companies(name)')
              .eq('status', 'Pendente')
              .in('company_id', selectedCompanies)
              .gte('due_date', startDate)
              .lte('due_date', endDate)
              .order('due_date', { ascending: false }),
            supabase
              .from('contas_receber')
              .select('*, company:companies(name)')
              .eq('status', 'Pendente')
              .in('company_id', selectedCompanies)
              .gte('due_date', startDate)
              .lte('due_date', endDate)
              .order('due_date', { ascending: false }),
            supabase
              .from('employee_payments')
              .select(`
                *,
                company:companies(name),
                user:app_users!employee_payments_user_id_fkey(name),
                employee:employees!left(name)
              `)
              .eq('status', 'Pendente')
              .in('company_id', selectedCompanies)
              .gte('start_date', startDate)
              .lte('end_date', endDate)
              .order('start_date', { ascending: false }),
          ]);

          if (closings.error) throw closings.error;
          if (contasPagar.error) throw contasPagar.error;
          if (contasReceber.error) throw contasReceber.error;
          if (payments.error) throw payments.error;

          setPendingClosings(closings.data || []);
          const allContas = [
            ...(contasPagar.data || []).map(c => ({ ...c, type: 'despesa' })),
            ...(contasReceber.data || []).map(c => ({ ...c, type: 'receita' }))
          ];
          setPendingContas(allContas);
          setPendingPayments(payments.data || []);

        } catch (err) {
          setError(err.message);
          toast({ title: "Erro ao buscar pendências", description: err.message, variant: "destructive" });
        } finally {
          setIsLoading(false);
        }
      }, [selectedCompanies, startDate, endDate, toast]);

      useEffect(() => {
        fetchData();
      }, [fetchData]);
      
      const handleSaveEdit = async () => {
        if (!selectedItem || selectedType !== 'closing') return;
      
        setIsEditing(false);
      
        const paymentDetailsWithAdmin = selectedItem.payment_details.map(pd => ({
          ...pd,
          conferred: parseFloat(adminConferredValues[pd.name] || pd.conferred),
        }));
        
        const totalAdminConferred = paymentDetailsWithAdmin.reduce((acc, pd) => acc + (pd.conferred || 0), 0);
      
        const updatedItem = {
          ...selectedItem,
          payment_details: paymentDetailsWithAdmin,
          total_conferred: totalAdminConferred,
          total_difference: totalAdminConferred - (selectedItem.total_calculated || 0),
          last_edited_by: user.id,
          last_edited_at: new Date().toISOString(),
        };
      
        const { data, error } = await supabase
          .from('cash_closings')
          .update({
            payment_details: updatedItem.payment_details,
            total_conferred: updatedItem.total_conferred,
            total_difference: updatedItem.total_difference,
            last_edited_by: updatedItem.last_edited_by,
            last_edited_at: updatedItem.last_edited_at
          })
          .eq('id', selectedItem.id)
          .select()
          .single();
      
        if (error) {
          toast({ title: 'Erro ao salvar alterações', description: error.message, variant: 'destructive' });
        } else {
          toast({ title: 'Sucesso!', description: 'As alterações foram salvas.', variant: 'success' });
          setSelectedItem(data);
          fetchData(); 
        }
      };


      const handleAction = async (itemId, itemType, action) => {
        let tableName = '';
        let successMessage = '';
        let query;

        const itemToProcess = pendingClosings.find(c => c.id === itemId);

        switch (itemType) {
          case 'closing':
            tableName = 'cash_closings';
            break;
          case 'conta':
            const item = pendingContas.find(c => c.id === itemId);
            tableName = item.type === 'despesa' ? 'contas_pagar' : 'contas_receber';
            break;
          case 'payment':
            tableName = 'employee_payments';
            break;
          default:
            return;
        }

        if (action === 'delete') {
          query = supabase.from(tableName).delete().eq('id', itemId);
          successMessage = 'Item excluído com sucesso!';
        } else { 
          let newStatus = action === 'approve' ? 'Aprovado' : 'Reprovado';
          let updateData = { status: newStatus };
          
          if (itemType === 'closing') {
            if (action === 'approve') {
              if (!itemToProcess.payment_details?.length || Object.keys(adminConferredValues).length === 0) {
                toast({ title: "Valores não conferidos", description: "Por favor, preencha e/ou edite os campos da conferência ADM antes de aprovar.", variant: "destructive" });
                return;
              }
              
              const paymentDetailsWithAdmin = itemToProcess.payment_details.map(pd => ({
                ...pd,
                admin_conferred: parseFloat(adminConferredValues[pd.name] || pd.conferred)
              }));
              const totalAdminConferred = paymentDetailsWithAdmin.reduce((acc, pd) => acc + (pd.admin_conferred || 0), 0);

              const totalCalculatedNum = itemToProcess.total_calculated || 0;
              updateData = { 
                  ...updateData, 
                  confirmed_by: user.id, 
                  confirmed_at: new Date().toISOString(),
                  total_conferred: totalAdminConferred,
                  total_difference: totalAdminConferred - totalCalculatedNum,
                  payment_details: paymentDetailsWithAdmin
              };
            } else {
               updateData = { ...updateData, confirmed_by: user.id, confirmed_at: new Date().toISOString() };
            }
          } else if (itemType === 'conta' && action === 'approve') {
              const conta = pendingContas.find(c => c.id === itemId);
              if (conta.type === 'despesa') {
                updateData.status = 'A Pagar';
              } else {
                updateData.status = 'A Receber';
              }
          } else if (itemType === 'payment') {
              updateData = { ...updateData, confirmed_by: user.id, confirmed_at: new Date().toISOString() };
          }
          
          query = supabase.from(tableName).update(updateData).eq('id', itemId);
          successMessage = `Item ${newStatus.toLowerCase()} com sucesso!`;
        }

        const { error } = await query;

        if (error) {
          toast({ title: `Erro ao executar ação`, description: error.message, variant: "destructive" });
        } else {
          if (itemType === 'closing' && action === 'approve') {
            const dreEntries = [];
            let totalToReceiveInCardsBrute = 0;
            const companyName = itemToProcess.company?.name;
            const closingDate = itemToProcess.closing_date;
            const dateSuffix = format(new Date(closingDate + 'T00:00:00'), 'dd/MM/yyyy');

            const paymentDetailsWithAdmin = itemToProcess.payment_details.map(pd => ({
              ...pd,
              admin_conferred: parseFloat(adminConferredValues[pd.name] || pd.conferred)
            }));
            
            const cardPayments = ['stone', 'cielo', 'getnet', 'pagseguro', 'mastercard', 'visa', 'elo', 'amex'];

            paymentDetailsWithAdmin.forEach(pd => {
                const conferredValue = pd.admin_conferred || 0;
                const feeValue = conferredValue * ((pd.fee || 0) / 100);
                
                const isCardPayment = cardPayments.some(card => pd.name.toLowerCase().includes(card));

                if (isCardPayment) {
                  totalToReceiveInCardsBrute += conferredValue;
                }

                if (conferredValue > 0) {
                    dreEntries.push({
                        date: closingDate,
                        description: `Receita ${pd.name} - ${companyName} - ${dateSuffix}`,
                        amount: conferredValue,
                        company_id: itemToProcess.company_id,
                        dre_group_id: dreGroupIds['Receita Bruta'],
                    });
                }

                if (feeValue > 0) {
                     dreEntries.push({
                        date: closingDate,
                        description: `Taxa ${pd.name} - ${companyName} - ${dateSuffix}`,
                        amount: -feeValue,
                        company_id: itemToProcess.company_id,
                        dre_group_id: dreGroupIds['Deduções da Receita'],
                    });
                }
            });

            if (itemToProcess.withdrawals > 0) {
                dreEntries.push({
                    date: closingDate,
                    description: `Saídas de Caixa - ${companyName} - ${dateSuffix}`,
                    amount: -itemToProcess.withdrawals,
                    company_id: itemToProcess.company_id,
                    dre_group_id: dreGroupIds['Despesas Operacionais'],
                });
            }

            if (itemToProcess.valor_cortesia > 0) {
                 dreEntries.push({
                    date: closingDate,
                    description: `Cortesias - ${companyName} - ${dateSuffix}`,
                    amount: -itemToProcess.valor_cortesia,
                    company_id: itemToProcess.company_id,
                    dre_group_id: dreGroupIds['Despesas Operacionais'],
                });
            }

            if (dreEntries.length > 0) {
                const { error: dreError } = await supabase.from('dre_entries').insert(dreEntries);
                if (dreError) {
                    toast({ title: `Erro ao lançar no DRE`, description: dreError.message, variant: "destructive" });
                } else {
                    toast({ title: "Sucesso!", description: "Lançamentos DRE criados." });
                }
            }
            
            if (totalToReceiveInCardsBrute > 0) {
              const { error: stoneRecebimentoError } = await supabase.from('stone_recebimentos').insert({
                company_id: itemToProcess.company_id,
                fechamento_id: itemToProcess.id,
                data_venda: closingDate,
                data_prevista: format(addDays(new Date(closingDate + 'T00:00:00'), 30), 'yyyy-MM-dd'),
                valor_previsto: totalToReceiveInCardsBrute,
                status: 'Pendente',
              });

              if (stoneRecebimentoError) {
                toast({ title: "Erro ao criar recebimento no Raio-X", description: stoneRecebimentoError.message, variant: "destructive" });
              } else {
                toast({ title: "Recebimento de Cartão Criado!", description: `Valor de R$ ${totalToReceiveInCardsBrute.toFixed(2)} enviado para o Raio-X Financeiro.` });
              }
            }
          }
          
          toast({ title: successMessage, variant: "success" });
          fetchData(); 
          setSelectedItem(null);
          setAdminConferredValues({});
          setIsEditing(false);
        }
      };

      const openModal = (item, type) => {
        setSelectedItem(item);
        setSelectedType(type);
        if (type === 'closing') {
          const initialValues = {};
          item.payment_details?.forEach(pd => {
            initialValues[pd.name] = (pd.admin_conferred ?? pd.conferred)?.toFixed(2) || '0.00';
          });
          setAdminConferredValues(initialValues);
        }
        setIsEditing(false);
      };

      const handleCompanySelection = (companyId) => {
        setSelectedCompanies(prev => 
          prev.includes(companyId) 
            ? prev.filter(id => id !== companyId)
            : [...prev, companyId]
        );
      };

      const handleAdminConferredChange = (name, value) => {
        setAdminConferredValues(prev => ({ ...prev, [name]: value }));
      };
      
      const DetailCard = ({ title, children }) => (
        <div className="bg-background/50 p-4 rounded-lg">
            <h3 className="font-bold text-lg mb-2">{title}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-sm">
                {children}
            </div>
        </div>
      );

      const DetailItem = ({ label, value }) => (
          <div>
              <p className="text-muted-foreground">{label}</p>
              <p className="font-semibold">{value}</p>
          </div>
      );


      const renderClosingDetails = () => {
        if (!selectedItem || selectedType !== 'closing') return null;
        
        const totalAdminConferred = Object.values(adminConferredValues).reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
        const totalCalculatedNum = selectedItem.total_calculated || 0;
        const totalDifference = totalAdminConferred - totalCalculatedNum;

        const formatCurrency = (value) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        return (
          <>
            <div className="grid grid-cols-2 gap-2 text-sm mb-4 bg-muted p-3 rounded-lg">
              <p><strong>Empresa:</strong> {selectedItem.company?.name || 'N/A'}</p>
              <p><strong>Data:</strong> {new Date(selectedItem.closing_date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
              <p><strong>Responsável:</strong> {selectedItem.user?.name || 'N/A'}</p>
              <p><strong>Setor:</strong> <span className="font-semibold">{selectedItem.setor || 'N/A'}</span></p>
              <p><strong>Status:</strong> <span className="font-semibold text-yellow-600">{selectedItem.status}</span></p>
              <p><strong>Total Líquido (Colab.):</strong> <span className="font-semibold">{formatCurrency(selectedItem.total_liquido)}</span></p>
            </div>
            <div className="space-y-4">
              <div className="bg-background/50 p-4 rounded-lg">
                <h3 className="font-bold text-lg mb-4">Valores e Conferência</h3>
                <div className="grid grid-cols-12 gap-x-4 gap-y-2 font-semibold text-muted-foreground mb-2 text-xs">
                    <div className="col-span-4">Forma de Pagamento</div>
                    <div className="col-span-3 text-right">Valor Sistema</div>
                    <div className="col-span-2 text-right">Valor Conferido (Colab.)</div>
                    <div className="col-span-3 text-right">Conferência (ADM)</div>
                </div>
                {selectedItem.payment_details?.map((pd, i) => (
                  <div key={i} className="grid grid-cols-12 gap-x-4 items-center border-t py-2">
                      <p className="font-semibold col-span-4">{pd.name}</p>
                      <p className="col-span-3 text-right">{formatCurrency(pd.sistema)}</p>
                      <p className="col-span-2 text-right">{formatCurrency(pd.conferred)}</p>
                      <div className="col-span-3">
                          <Input
                              type="number"
                              placeholder="0,00"
                              value={adminConferredValues[pd.name] || ''}
                              onChange={(e) => handleAdminConferredChange(pd.name, e.target.value)}
                              className="text-right font-bold"
                              readOnly={!isEditing}
                          />
                      </div>
                  </div>
                ))}
              </div>

              <DetailCard title="Resumo Financeiro">
                <DetailItem label="Abertura" value={formatCurrency(selectedItem.previous_balance)} />
                <DetailItem label="Suprimentos" value={formatCurrency(selectedItem.supplies)} />
                <DetailItem label="Saídas" value={formatCurrency(selectedItem.withdrawals)} />
                <DetailItem label="Saldo Final" value={formatCurrency(selectedItem.final_balance)} />
              </DetailCard>

              <DetailCard title="Indicadores de Venda">
                <DetailItem label="Tkt Médio" value={formatCurrency(selectedItem.ticket_medio)} />
                <DetailItem label="Burger Salão" value={selectedItem.qtd_burger_salao || 0} />
                <DetailItem label="Burger Delivery" value={selectedItem.qtd_burger_delivery || 0} />
                <DetailItem label="Burger Func." value={selectedItem.qtd_burger_funcionario || 0} />
                <DetailItem label="Valor Burger Func." value={formatCurrency(selectedItem.valor_burger_funcionario)} />
                <DetailItem label="Rodízio" value={selectedItem.qtd_rodizio || 0} />
                <DetailItem label="Rodízio Meia" value={selectedItem.qtd_rodizio_meia || 0} />
                <DetailItem label="Cortesias" value={formatCurrency(selectedItem.valor_cortesia)} />
                <DetailItem label="Cancelamentos" value={formatCurrency(selectedItem.valor_cancelamento)} />
              </DetailCard>

              <DetailCard title="Valores por Origem (Colaborador)">
                <DetailItem label="Dinheiro" value={formatCurrency(selectedItem.valor_dinheiro)} />
                <DetailItem label="iFood Online" value={formatCurrency(selectedItem.valor_ifood_online)} />
                <DetailItem label="Pix CNPJ" value={formatCurrency(selectedItem.valor_pix_cnpj)} />
                <DetailItem label="iFood Bruto" value={formatCurrency(selectedItem.valor_ifood_bruto)} />
                <DetailItem label="Taxas iFood" value={formatCurrency(selectedItem.valor_taxas_ifood)} />
                <DetailItem label="Lote iFood" value={selectedItem.ifood_lote_id || 'N/A'} />
              </DetailCard>

              <div className="bg-background/50 p-4 rounded-lg">
                <h3 className="font-bold text-lg mb-2">Totais e Diferença (Conferência ADM)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div><p className="text-muted-foreground">Total Sistema</p><p className="font-bold text-2xl">{formatCurrency(totalCalculatedNum)}</p></div>
                  <div><p className="text-muted-foreground">Total Conferido (ADM)</p><p className="font-bold text-2xl">{formatCurrency(totalAdminConferred)}</p></div>
                  <div><p className="text-muted-foreground">Diferença</p><p className={`font-bold text-2xl ${totalDifference.toFixed(2) !== '0.00' ? 'text-red-500' : 'text-green-500'}`}>{formatCurrency(totalDifference)}</p></div>
                </div>
              </div>
              {selectedItem.observations && <div className="bg-background/50 p-4 rounded-lg"><h3 className="font-bold text-lg mb-2">Observações</h3><p className="text-muted-foreground whitespace-pre-wrap">{selectedItem.observations}</p></div>}
            </div>
          </>
        );
      };

      const renderContaDetails = () => {
        if (!selectedItem || selectedType !== 'conta') return null;
        const formatCurrency = (value) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm mb-4 bg-muted p-3 rounded-lg">
              <p><strong>Empresa:</strong> {selectedItem.company?.name || 'N/A'}</p>
              <p><strong>Data Venc.:</strong> {format(new Date(selectedItem.due_date), 'dd/MM/yyyy')}</p>
              <p><strong>Tipo:</strong> <span className={`font-semibold ${selectedItem.type === 'despesa' ? 'text-red-500' : 'text-green-500'}`}>{selectedItem.type === 'despesa' ? 'Despesa' : 'Receita'}</span></p>
              <p><strong>Status:</strong> <span className="font-semibold text-yellow-600">{selectedItem.status}</span></p>
            </div>
            <div><strong>Descrição:</strong> <p className="text-muted-foreground">{selectedItem.description}</p></div>
            <div><strong>Valor:</strong> <p className="font-bold text-xl">{formatCurrency(selectedItem.value)}</p></div>
          </div>
        );
      };

      const renderPaymentDetails = () => {
        if (!selectedItem || selectedType !== 'payment') return null;
        const formatCurrency = (value) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm mb-4 bg-muted p-3 rounded-lg">
              <p><strong>Empresa:</strong> {selectedItem.company?.name || 'N/A'}</p>
              <p><strong>Período:</strong> {format(new Date(selectedItem.start_date), 'dd/MM/yyyy')} a {format(new Date(selectedItem.end_date), 'dd/MM/yyyy')}</p>
              <p><strong>Lançado por:</strong> {selectedItem.user?.name || 'N/A'}</p>
              <p><strong>Status:</strong> <span className="font-semibold text-yellow-600">{selectedItem.status}</span></p>
            </div>
            <div className="bg-background/50 p-4 rounded-lg">
              <h3 className="font-bold text-lg mb-2">Detalhes do Pagamento</h3>
              {selectedItem.payment_details?.map((detail, i) => (
                <div key={i} className="border-b last:border-b-0 py-2 text-sm">
                  <p><strong>Funcionário:</strong> {detail.name} ({detail.role})</p>
                  {detail.role === 'Motoboy' && <p><strong>Entregas:</strong> {detail.deliveries}</p>}
                  {detail.role === 'Freelancer' && <p><strong>Horas:</strong> {detail.hours?.toFixed(2)}</p>}
                  <p><strong>Desconto:</strong> {formatCurrency(detail.discount)}</p>
                  <p className="font-bold mt-1">Total: {formatCurrency(detail.total)}</p>
                </div>
              ))}
            </div>
            <div className="text-right">
              <p className="text-muted-foreground">Valor Total do Lançamento</p>          <p className="font-bold text-2xl">{formatCurrency(selectedItem.total_value)}</p>
            </div>
          </div>
        );
      };

      const renderModalContent = () => {
        if (!selectedItem) return null;
        let content;
        let actions;

        switch (selectedType) {
          case 'closing':
            content = renderClosingDetails();
            actions = (
              <>
                {isEditing ? (
                   <Button onClick={handleSaveEdit}><Save className="mr-2 h-4 w-4" /> Salvar</Button>
                ) : (
                   <Button variant="outline" onClick={() => setIsEditing(true)}><Edit className="mr-2 h-4 w-4" /> Editar</Button>
                )}
                <Button variant="destructive" onClick={() => handleAction(selectedItem.id, selectedType, 'reprove')}><X className="mr-2" /> Reprovar</Button>
                <Button variant="destructive-outline" onClick={() => handleAction(selectedItem.id, selectedType, 'delete')}><Trash2 className="mr-2 h-4 w-4" /> Excluir</Button>
                <Button variant="success" onClick={() => handleAction(selectedItem.id, selectedType, 'approve')} disabled={isEditing}><Check className="mr-2" /> Aprovar</Button>
              </>
            );
            break;
          case 'conta':
            content = renderContaDetails();
             actions = (
              <>
                <Button variant="destructive" onClick={() => handleAction(selectedItem.id, selectedType, 'reprove')}><X className="mr-2" /> Reprovar</Button>
                <Button variant="success" onClick={() => handleAction(selectedItem.id, selectedType, 'approve')}><Check className="mr-2" /> Aprovar</Button>
              </>
            );
            break;
          case 'payment':
            content = renderPaymentDetails();
             actions = (
              <>
                <Button variant="destructive" onClick={() => handleAction(selectedItem.id, selectedType, 'reprove')}><X className="mr-2" /> Reprovar</Button>
                <Button variant="success" onClick={() => handleAction(selectedItem.id, selectedType, 'approve')}><Check className="mr-2" /> Aprovar</Button>
              </>
            );
            break;
          default:
            content = null;
            actions = null;
        }

        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4"
            onClick={() => { setSelectedItem(null); setAdminConferredValues({}); setIsEditing(false); }}
          >
            <div className="bg-card rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 relative" onClick={e => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="absolute top-4 right-4" onClick={() => { setSelectedItem(null); setAdminConferredValues({}); setIsEditing(false); }}><X /></Button>
              <h2 className="text-2xl font-bold mb-4">Detalhes da Conferência</h2>
              {content}
              <div className="flex justify-end gap-4 mt-6 flex-wrap">
                {actions}
              </div>
            </div>
          </motion.div>
        );
      };

      const renderEmptyState = (title, message) => (
        <div className="text-center py-16 bg-card rounded-lg shadow-sm">
          <Check className="mx-auto w-16 h-16 text-green-500 mb-4" />
          <h2 className="text-2xl font-semibold">{title}</h2>
          <p className="text-muted-foreground">{message}</p>
        </div>
      );

      const renderTable = (data, type, columns) => {
        if (data.length === 0) {
          const messages = {
            closings: { title: "Tudo certo por aqui!", message: "Nenhum fechamento de caixa pendente para os filtros selecionados." },
            contas: { title: "Nenhum lançamento rápido pendente!", message: "Nenhum lançamento encontrado para os filtros selecionados." },
            payments: { title: "Nenhum pagamento pendente!", message: "Nenhum pagamento de funcionário encontrado para os filtros selecionados." },
          };
          return renderEmptyState(messages[type].title, messages[type].message);
        }

        return (
          <div className="bg-card rounded-xl shadow-md border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {columns.map(col => <th key={col.key} className={`p-3 text-left font-semibold text-muted-foreground ${col.className || ''}`}>{col.header}</th>)}
                    <th className="p-3 text-right font-semibold text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(item => (
                    <tr key={item.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                      {columns.map(col => <td key={col.key} className={`p-3 ${col.className || ''}`}>{col.render(item)}</td>)}
                      <td className="p-3 text-right">
                        <Button size="sm" onClick={() => openModal(item, type.slice(0, -1))}><Eye className="mr-2 h-4 w-4" /> Conferir</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      };
      
      const formatCurrency = (value) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

      const closingColumns = [
        { key: 'company', header: 'Empresa', render: item => item.company?.name || 'N/A' },
        { key: 'date', header: 'Data', render: item => format(new Date(item.closing_date + 'T00:00:00'), 'dd/MM/yyyy') },
        { key: 'user', header: 'Responsável', render: item => item.user?.name || 'N/A' },
        { key: 'sector', header: 'Setor', render: item => item.setor || 'N/A' },
        { key: 'difference', header: 'Diferença', className: 'text-right', render: item => <span className={`font-bold ${item.total_difference !== 0 ? 'text-red-500' : 'text-green-500'}`}>{formatCurrency(item.total_difference)}</span> },
      ];

      const contaColumns = [
        { key: 'company', header: 'Empresa', render: item => item.company?.name || 'N/A' },
        { key: 'due_date', header: 'Vencimento', render: item => format(new Date(item.due_date), 'dd/MM/yyyy') },
        { key: 'type', header: 'Tipo', render: item => <span className={`px-2 py-1 text-xs font-semibold rounded-full ${item.type === 'despesa' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{item.type}</span> },
        { key: 'description', header: 'Descrição', render: item => <span className="truncate block max-w-xs">{item.description}</span> },
        { key: 'value', header: 'Valor', className: 'text-right', render: item => <span className="font-bold">{formatCurrency(item.value)}</span> },
      ];

      const paymentColumns = [
        { key: 'company', header: 'Empresa', render: item => item.company?.name || 'N/A' },
        { key: 'period', header: 'Período', render: item => `${format(new Date(item.start_date), 'dd/MM/yy')} - ${format(new Date(item.end_date), 'dd/MM/yy')}` },
        { key: 'employee', header: 'Funcionário', render: item => item.employee?.name || item.employee_name_cache || 'N/A' },
        { key: 'user', header: 'Lançado por', render: item => item.user?.name || 'N/A' },
        { key: 'value', header: 'Valor Total', className: 'text-right', render: item => <span className="font-bold">{formatCurrency(item.total_value)}</span> },
      ];

      if (error) {
        return <div className="p-8 text-center text-red-500"><AlertTriangle className="mx-auto w-12 h-12 mb-4" /> <h2 className="text-xl font-semibold">Ocorreu um erro</h2> <p>{error}</p></div>;
      }

      return (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">Conferências Pendentes</h1>
            <Button onClick={fetchData} disabled={isLoading}>
              {isLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Atualizar
            </Button>
          </div>

          <div className="bg-card p-4 rounded-xl shadow-sm border space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-3">
                <Label>Empresas</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {allowedCompanies.map(company => (
                    <button
                      key={company.id}
                      onClick={() => handleCompanySelection(company.id)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                        selectedCompanies.includes(company.id)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-secondary'
                      }`}
                    >
                      {company.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="startDate">Data Inicial</Label>
                <Input id="startDate" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="endDate">Data Final</Label>
                <Input id="endDate" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>
          </div>

          {isLoading ? (
             <div className="flex justify-center items-center h-64"><RefreshCw className="w-8 h-8 animate-spin text-primary" /></div>
          ) : (
            <Tabs defaultValue="closings" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="closings"><DollarSign className="w-4 h-4 mr-2" />Fechamentos de Caixa ({pendingClosings.length})</TabsTrigger>
                <TabsTrigger value="contas"><Zap className="w-4 h-4 mr-2" />Lançamentos Rápidos ({pendingContas.length})</TabsTrigger>
                <TabsTrigger value="payments"><Users className="w-4 h-4 mr-2" />Pagamentos ({pendingPayments.length})</TabsTrigger>
              </TabsList>
              
              <TabsContent value="closings" className="mt-6">
                {renderTable(pendingClosings, 'closings', closingColumns)}
              </TabsContent>
      
              <TabsContent value="contas" className="mt-6">
                {renderTable(pendingContas, 'contas', contaColumns)}
              </TabsContent>
      
              <TabsContent value="payments" className="mt-6">
                {renderTable(pendingPayments, 'payments', paymentColumns)}
              </TabsContent>
            </Tabs>
          )}
          {renderModalContent()}
        </div>
      );
    };

    export default Conferencia;
  