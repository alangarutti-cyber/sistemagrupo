import React, { useState, useEffect, useCallback } from 'react';
    import { motion } from 'framer-motion';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Printer, Tag, Box, Package, Calendar, Clock, ChevronsUpDown } from 'lucide-react';
    import { useReactToPrint } from 'react-to-print';
    import { format, formatISO } from 'date-fns';
    import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
    import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";


    const EtiquetaPreview = React.forwardRef(({ htmlContent }, ref) => (
      <div ref={ref} className="bg-white text-black" dangerouslySetInnerHTML={{ __html: htmlContent }} />
    ));

    const Combobox = ({ options, value, onSelect, placeholder, searchPlaceholder }) => {
      const [open, setOpen] = useState(false);
      const selectedOption = options.find(opt => opt.id === value);
      return (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" className="w-full justify-between">
              {selectedOption ? selectedOption.name : placeholder}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0">
            <Command>
              <CommandInput placeholder={searchPlaceholder} />
              <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
              <CommandGroup>
                {options.map(option => (
                  <CommandItem
                    key={option.id}
                    value={option.name}
                    onSelect={() => { onSelect(option.id); setOpen(false); }}
                  >
                    {option.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
      );
    };

    const ImpressaoEtiquetas = ({ user, companies, userCompanyAccess }) => {
      const { toast } = useToast();
      const [orders, setOrders] = useState([]);
      const [templates, setTemplates] = useState([]);
      const [selectedOrder, setSelectedOrder] = useState(null);
      const [selectedTemplate, setSelectedTemplate] = useState('');
      const [labelType, setLabelType] = useState('Produto');
      const [quantity, setQuantity] = useState(1);
      const [printers, setPrinters] = useState(['Zebra_GC420t', 'Elgin_L42PRO', 'Argox_OS214', 'Outra']);
      const [selectedPrinter, setSelectedPrinter] = useState('');
      const [loading, setLoading] = useState(false);
      const [history, setHistory] = useState([]);
      const [filters, setFilters] = useState({ product: '', batch: '', type: '' });
      const [previewHtml, setPreviewHtml] = useState('');

      const etiquetaRef = React.useRef();

      const fetchData = useCallback(async () => {
        setLoading(true);
        try {
          const companyIds = companies.filter(c => user.is_admin || userCompanyAccess.some(ua => ua.company_id === c.id)).map(c => c.id);
          if (companyIds.length === 0) return;

          let orderQuery = supabase.from('production_orders').select('*').in('company_id', companyIds).order('created_at', { ascending: false });
          if(filters.product) orderQuery = orderQuery.ilike('product_name', `%${filters.product}%`);
          if(filters.batch) orderQuery = orderQuery.eq('batch_code', filters.batch);

          const { data: ordersData, error: ordersError } = await orderQuery;
          if (ordersError) throw ordersError;
          setOrders(ordersData);

          const { data: historyData, error: historyError } = await supabase.from('label_print_jobs').select('*, order:production_orders(product_name, batch_code)').order('created_at', { ascending: false });
          if (historyError) throw historyError;
          setHistory(historyData);

          const { data: templatesData, error: templatesError } = await supabase.from('label_templates').select('*');
          if(templatesError) throw templatesError;
          setTemplates(templatesData);
          
        } catch (error) {
          toast({ title: 'Erro ao carregar dados', description: error.message, variant: 'destructive' });
        } finally {
          setLoading(false);
        }
      }, [companies, user.is_admin, userCompanyAccess, toast, filters]);

      useEffect(() => {
        fetchData();
      }, [fetchData]);
      
       useEffect(() => {
        if (selectedOrder && selectedTemplate) {
            const order = orders.find(o => o.id === selectedOrder);
            const template = templates.find(t => t.id === selectedTemplate);

            if(order && template) {
                let html = template.template;
                html = html.replace(/{{product_name}}/g, order.product_name);
                html = html.replace(/{{batch_code}}/g, order.batch_code);
                html = html.replace(/{{production_date}}/g, format(new Date(order.created_at), 'dd/MM/yyyy'));
                html = html.replace(/{{expiration_date}}/g, order.expiration_date ? format(new Date(order.expiration_date), 'dd/MM/yyyy') : 'N/A');
                html = html.replace(/{{quantity}}/g, order.quantity_produced || order.quantity_planned);
                setPreviewHtml(html);
            }
        } else {
            setPreviewHtml('');
        }
    }, [selectedOrder, selectedTemplate, orders, templates]);

      const handlePrint = useReactToPrint({
        content: () => etiquetaRef.current,
        onAfterPrint: async () => {
          toast({ title: 'Impressão enviada!' });
          if(selectedOrder) {
            await supabase.from('label_print_jobs').insert({
              order_id: selectedOrder,
              label_type: labelType,
              quantity,
              printer_name: selectedPrinter || 'Padrão do Sistema',
              status: 'Impresso'
            });
            fetchData();
          }
        },
      });

      const handleFilterChange = (field, value) => {
        setFilters(prev => ({...prev, [field]: value}));
      };

      const orderOptions = orders.map(o => ({
        id: o.id,
        name: `${o.product_name} (Lote: ${o.batch_code})`
      }));
      
      const filteredTemplates = templates.filter(t => t.label_type === labelType);

      return (
        <div className="space-y-8">
          <h1 className="text-3xl font-bold flex items-center gap-3"><Printer /> Impressão de Etiquetas</h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-card p-6 rounded-xl shadow-sm space-y-6">
              <h2 className="text-xl font-semibold">Configurar Impressão</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                  <Input placeholder="Filtrar por produto..." value={filters.product} onChange={e => handleFilterChange('product', e.target.value)} />
                  <Input placeholder="Filtrar por lote..." value={filters.batch} onChange={e => handleFilterChange('batch', e.target.value)} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Ordem de Produção</Label>
                  <Combobox options={orderOptions} value={selectedOrder} onSelect={setSelectedOrder} placeholder="Selecione uma Ordem" searchPlaceholder="Buscar ordem..."/>
                </div>
                 <div>
                  <Label>Tipo de Etiqueta</Label>
                  <select value={labelType} onChange={(e) => setLabelType(e.target.value)} className="w-full p-2 border rounded-md bg-background">
                    <option value="Produto">Produto</option>
                    <option value="Caixa">Caixa</option>
                    <option value="Lote">Lote</option>
                  </select>
                </div>
                <div>
                  <Label>Template da Etiqueta</Label>
                  <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(parseInt(e.target.value))} className="w-full p-2 border rounded-md bg-background" disabled={!labelType}>
                    <option value="">Selecione um template</option>
                    {filteredTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                 <div>
                  <Label>Quantidade de Etiquetas</Label>
                  <Input type="number" min="1" value={quantity} onChange={e => setQuantity(parseInt(e.target.value))} />
                </div>
                 <div>
                  <Label>Impressora</Label>
                   <select value={selectedPrinter} onChange={e => setSelectedPrinter(e.target.value)} className="w-full p-2 border rounded-md bg-background">
                    <option value="">Padrão do Sistema</option>
                    {printers.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handlePrint} disabled={!selectedOrder || !selectedTemplate}><Printer className="w-4 h-4 mr-2" /> Imprimir Agora</Button>
              </div>
            </div>

            <div className="bg-card p-6 rounded-xl shadow-sm">
                <h2 className="text-xl font-semibold mb-4">Preview da Etiqueta</h2>
                <div className="flex items-center justify-center bg-gray-200 p-4 rounded-lg overflow-auto">
                    {previewHtml ? (
                        <EtiquetaPreview ref={etiquetaRef} htmlContent={previewHtml} />
                    ) : (
                        <div className="text-center text-muted-foreground py-10">Selecione uma ordem e um template para ver o preview.</div>
                    )}
                </div>
            </div>
          </div>

          <div className="bg-card p-6 rounded-xl shadow-sm">
              <h2 className="text-xl font-semibold mb-4">Histórico de Impressão</h2>
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted-foreground/10">
                        <tr>
                            <th className="p-2 text-left">Data/Hora</th>
                            <th className="p-2 text-left">Produto (Lote)</th>
                            <th className="p-2 text-left">Tipo</th>
                            <th className="p-2 text-left">Qtd.</th>
                            <th className="p-2 text-left">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.map(h => (
                            <tr key={h.id} className="border-b last:border-b-0">
                                <td className="p-2">{format(new Date(h.created_at), 'dd/MM/yy HH:mm')}</td>
                                <td className="p-2">{h.order?.product_name} ({h.order?.batch_code})</td>
                                <td className="p-2">{h.label_type}</td>
                                <td className="p-2">{h.quantity}</td>
                                <td className="p-2"><span className={`px-2 py-1 text-xs rounded-full ${h.status === 'Impresso' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{h.status}</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
              </div>
          </div>
        </div>
      );
    };

    export default ImpressaoEtiquetas;