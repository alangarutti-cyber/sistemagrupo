import React, { useState, useEffect, useCallback } from 'react';
    import { motion, AnimatePresence } from 'framer-motion';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useUser } from '@/contexts/UserContext';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
    import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
    import { ChevronsUpDown, Printer, Tag, History, QrCode as QrCodeIcon, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
    import ReactDOMServer from 'react-dom/server';
    import QRCode from 'qrcode.react';
    import { Helmet } from 'react-helmet';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

    const LabelComponent = ({ labelData }) => {
        if (!labelData) return null;

        const {
            productName,
            storageType,
            weight,
            originalValidity,
            manipulationDate,
            newValidityDate,
            supplierName,
            sifCode,
            responsibleName,
            companyName,
            companyCnpj,
            companyAddress,
            qrCodeValue,
            batchCode,
        } = labelData;

        const formatDate = (dateStr) => {
          if (!dateStr) return 'N/A';
          const date = new Date(dateStr);
          const userTimezoneOffset = date.getTimezoneOffset() * 60000;
          return new Date(date.getTime() + userTimezoneOffset).toLocaleDateString('pt-BR');
        };
        
        const formatDateTime = (dateStr) => {
            if (!dateStr) return 'N/A';
            const date = new Date(dateStr);
            return `${date.toLocaleDateString('pt-BR')} - ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        };

        return (
            <div className="label-container" style={{ border: '1px solid #ccc' }}>
                <h2 className="product-name">{productName}</h2>
                <div className="storage-line">
                    <span>{storageType}</span>
                    <strong>{weight} g</strong>
                </div>
                <div className="line"><span>VAL. ORIGINAL:</span> <span>{formatDate(originalValidity)}</span></div>
                <div className="line"><span>MANIPULAÇÃO:</span> <span>{formatDateTime(manipulationDate)}</span></div>
                <div className="line"><span>VALIDADE:</span> <span>{formatDateTime(newValidityDate)}</span></div>
                <div className="line"><span>SIF:</span> 
                  <div className="text-right">
                    <div>{supplierName || 'N/A'}</div>
                    <div>{sifCode || ''}</div>
                  </div>
                </div>
                <div className="footer">
                    <div className="footer-info">
                        <div><span>RESP.:</span> <strong>{responsibleName}</strong></div>
                        <div>{companyName}</div>
                        <div>CNPJ: {companyCnpj}</div>
                        <div>{companyAddress}</div>
                        <div className="batch-code">#{batchCode}</div>
                    </div>
                    {qrCodeValue && <QRCode value={qrCodeValue} size={50} />}
                </div>
            </div>
        );
    };


    const EtiquetasCozinha = () => {
      const { user, companies: allCompanies, userCompanyAccess } = useUser();
      const { toast } = useToast();
      const [products, setProducts] = useState([]);
      const [history, setHistory] = useState([]);
      const [selectedCompanyId, setSelectedCompanyId] = useState('');
      const [selectedProduct, setSelectedProduct] = useState(null);
      const [formData, setFormData] = useState({
        weight: '',
        storageType: 'Resfriado / Descongelando',
        supplierName: '',
        originalValidity: '',
        sifCode: '',
      });
      const [generatedLabel, setGeneratedLabel] = useState(null);
      const [isGenerating, setIsGenerating] = useState(false);
      const [showSuccess, setShowSuccess] = useState(false);
      const [isHistoryOpen, setIsHistoryOpen] = useState(false);
      const [printQuantity, setPrintQuantity] = useState(1);
      
      const handlePrint = () => {
        if (!generatedLabel) return;

        const printStyles = `
            @media print {
                @page {
                    size: 60mm 60mm;
                    margin: 0 !important;
                }
                body {
                    margin: 0 !important;
                    padding: 0 !important;
                    background: white;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                .label-container {
                  page-break-after: always;
                }
                .no-print {
                    display: none !important;
                }
            }
        `;

        let contentToPrint = '';
        for (let i = 0; i < printQuantity; i++) {
            contentToPrint += ReactDOMServer.renderToString(<LabelComponent labelData={generatedLabel} />);
        }

        const printWindow = window.open('', '', 'width=300,height=300');
        
        const indexCssPath = '/src' + '/index.css';

        printWindow.document.write(`
            <html>
                <head>
                    <title>Impressão de Etiqueta</title>
                    <link rel="stylesheet" href="${indexCssPath}">
                    <style>${printStyles}</style>
                </head>
                <body>${contentToPrint}</body>
            </html>
        `);
        printWindow.document.close();
        
        printWindow.onload = function() {
            setTimeout(() => {
                printWindow.focus();
                printWindow.print();
                printWindow.close();
            }, 500);
        };
      };

      const userCompanies = allCompanies.filter(c => user.is_admin || userCompanyAccess.some(ua => ua.company_id === c.id));

      useEffect(() => {
        if (user && user.company_id && userCompanies.some(c => c.id === user.company_id)) {
          setSelectedCompanyId(user.company_id.toString());
        } else if (userCompanies.length > 0) {
          setSelectedCompanyId(userCompanies[0].id.toString());
        }
      }, [user, userCompanies]);

      const fetchProducts = useCallback(async () => {
        if (!selectedCompanyId) return;
        const { data: productAccessData, error: productAccessError } = await supabase
          .from('product_company_access').select('product_id').eq('company_id', selectedCompanyId);
        if (productAccessError) throw productAccessError;
        const productIds = productAccessData.map(item => item.product_id);
        const { data, error } = await supabase.from('products').select('*, suppliers(name)').in('id', productIds);
        if (error) toast({ title: 'Erro ao buscar produtos', description: error.message, variant: 'destructive' });
        else setProducts(data || []);
      }, [selectedCompanyId, toast]);

      const fetchHistory = useCallback(async () => {
        if (!selectedCompanyId) return;
        const { data, error } = await supabase.from('labels').select('*, products(name), app_users(name)').eq('company_id', selectedCompanyId).order('created_at', { ascending: false }).limit(20);
        if (error) toast({ title: 'Erro ao buscar histórico', description: error.message, variant: 'destructive' });
        else setHistory(data || []);
      }, [selectedCompanyId, toast]);

      useEffect(() => {
        fetchProducts();
        fetchHistory();
      }, [fetchProducts, fetchHistory]);

      useEffect(() => {
        if (selectedProduct) {
          setFormData(prev => ({ 
            ...prev, 
            supplierName: selectedProduct.suppliers?.name || '',
            sifCode: selectedProduct.sif_code || ''
          }));
        }
      }, [selectedProduct]);

      const handleGenerateLabel = async () => {
        if (!selectedProduct || !formData.weight) {
          toast({ title: 'Campos obrigatórios', description: 'Selecione um produto e informe o peso.', variant: 'destructive' });
          return;
        }
        setIsGenerating(true);

        const manipulationDate = new Date();
        
        let validityDays;
        const storage = formData.storageType.toLowerCase();
        
        if (storage.includes('congelado') && selectedProduct.validade_dias_congelado) {
            validityDays = selectedProduct.validade_dias_congelado;
        } else if ((storage.includes('resfriado') || storage.includes('ambiente')) && selectedProduct.validade_dias_ambiente) {
            validityDays = selectedProduct.validade_dias_ambiente;
        } else {
            validityDays = selectedProduct.shelf_life_manipulated_hours ? selectedProduct.shelf_life_manipulated_hours / 24 : 2; // fallback
        }

        const newValidityDate = new Date(manipulationDate.getTime() + validityDays * 24 * 60 * 60 * 1000);

        const company = allCompanies.find(c => c.id === parseInt(selectedCompanyId));
        
        const prefix = (selectedProduct.name.substring(0, 2) || 'PD').toUpperCase();
        const datePart = manipulationDate.toISOString().substring(0, 10).replace(/-/g, '');
        const timePart = manipulationDate.getTime().toString().slice(-4);
        const batchCode = `${prefix}${datePart}${timePart}`;
        
        const fullAddress = company ? `${company.city || ''} - ${company.state || ''}` : '';

        const labelData = {
          productName: selectedProduct.name,
          storageType: formData.storageType,
          weight: formData.weight,
          originalValidity: formData.originalValidity,
          manipulationDate: manipulationDate.toISOString(),
          newValidityDate: newValidityDate.toISOString(),
          supplierName: formData.supplierName || selectedProduct.suppliers?.name || 'N/A',
          sifCode: formData.sifCode || 'N/A',
          responsibleName: user.name,
          companyName: company?.name || 'N/A',
          companyCnpj: company?.cnpj || 'N/A',
          companyAddress: fullAddress,
          batchCode,
          qrCodeValue: JSON.stringify({ p: selectedProduct.name, b: batchCode, w: formData.weight, v: newValidityDate.toISOString() }),
        };

        setGeneratedLabel(labelData);

        const { error } = await supabase.from('labels').insert({
          product_id: selectedProduct.id,
          company_id: selectedCompanyId,
          user_id: user.id,
          weight: parseFloat(formData.weight),
          original_validity: formData.originalValidity || null,
          manipulation_date: manipulationDate.toISOString(),
          new_validity_date: newValidityDate.toISOString(),
          batch_code: batchCode,
          sif_code: labelData.sifCode,
        });

        setIsGenerating(false);
        if (error) {
          toast({ title: 'Erro ao salvar histórico', description: error.message, variant: 'destructive' });
        } else {
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 3000);
          fetchHistory();
        }
      };

      return (
        <>
          <Helmet>
            <title>Modo Cozinha: Etiquetas - Stout System</title>
            <meta name="apple-mobile-web-app-capable" content="yes" />
            <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
            <meta name="apple-mobile-web-app-title" content="Stout Etiquetas" />
          </Helmet>
          <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 flex flex-col text-base no-print">
            <header className="sticky top-0 bg-white dark:bg-gray-900/80 backdrop-blur-sm shadow-md z-10 p-4 flex justify-between items-center">
              <img alt="Stout System Logo" className="h-10" src="https://horizons-cdn.hostinger.com/6a44e4d1-b151-41db-aa41-6efe480a026e/4907d27c8ad3e4ceaa68b04717459794.jpg" />
              <Button variant="outline" onClick={() => window.close()} className="h-12 text-base">
                <ArrowLeft className="w-5 h-5 mr-2" /> Voltar ao Painel
              </Button>
            </header>

            <main className="flex-1 p-4 sm:p-6 md:p-8">
              <div className="max-w-2xl mx-auto space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-base">Empresa</Label>
                    <select value={selectedCompanyId} onChange={e => setSelectedCompanyId(e.target.value)} className="w-full mt-1 p-3 border rounded-md bg-gray-50 dark:bg-gray-800 h-12 text-base">
                      {userCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="text-base">Produto</Label>
                    <ProductCombobox products={products} selectedProduct={selectedProduct} setSelectedProduct={setSelectedProduct} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="weight" className="text-base">Peso (g)</Label>
                      <Input id="weight" type="number" placeholder="500" value={formData.weight} onChange={e => setFormData(p => ({ ...p, weight: e.target.value }))} className="h-12 text-base" />
                    </div>
                    <div>
                      <Label htmlFor="originalValidity" className="text-base">Validade Original</Label>
                      <Input id="originalValidity" type="date" value={formData.originalValidity} onChange={e => setFormData(p => ({ ...p, originalValidity: e.target.value }))} className="h-12 text-base" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="storageType" className="text-base">Tipo de Armazenamento</Label>
                    <select id="storageType" value={formData.storageType} onChange={e => setFormData(p => ({ ...p, storageType: e.target.value }))} className="w-full mt-1 p-3 border rounded-md bg-gray-50 dark:bg-gray-800 h-12 text-base">
                        <option>Resfriado / Descongelando</option>
                        <option>Congelado</option>
                        <option>Temperatura ambiente</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="supplierName" className="text-base">Fornecedor</Label>
                      <Input id="supplierName" placeholder="Nome do fornecedor" value={formData.supplierName} onChange={e => setFormData(p => ({ ...p, supplierName: e.target.value }))} className="h-12 text-base" />
                    </div>
                    <div>
                      <Label htmlFor="sifCode" className="text-base">SIF</Label>
                      <Input id="sifCode" placeholder="Código SIF" value={formData.sifCode} onChange={e => setFormData(p => ({ ...p, sifCode: e.target.value }))} className="h-12 text-base" />
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  <Button onClick={handleGenerateLabel} disabled={!selectedProduct || !formData.weight || isGenerating} className="h-14 px-10 text-lg w-full sm:w-auto">
                    {isGenerating ? <Loader2 className="w-6 h-6 mr-2 animate-spin" /> : <Tag className="w-6 h-6 mr-2" />}
                    Gerar Etiqueta
                  </Button>
                </div>

                <AnimatePresence>
                  {showSuccess && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="flex items-center justify-center p-3 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded-lg">
                      <CheckCircle className="w-6 h-6 mr-2" />
                      <span className="font-semibold">Etiqueta gerada com sucesso!</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {generatedLabel && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                    <h2 className="text-center text-xl font-bold">Preview da Etiqueta</h2>
                    <div id="label-preview" className="mx-auto w-[226px] h-[226px] flex items-center justify-center bg-gray-100 rounded-lg p-1">
                      <LabelComponent labelData={generatedLabel} />
                    </div>
                    <div className="flex items-center gap-4 max-w-sm mx-auto">
                        <div className="flex-1">
                            <Label htmlFor="printQuantity" className="text-base">Quantidade</Label>
                            <Input id="printQuantity" type="number" min="1" value={printQuantity} onChange={e => setPrintQuantity(Math.max(1, parseInt(e.target.value) || 1))} className="h-12 text-base" />
                        </div>
                        <Button onClick={handlePrint} className="h-12 px-8 text-base mt-6">
                            <Printer className="w-6 h-6 mr-2" /> Imprimir
                        </Button>
                    </div>
                  </motion.div>
                )}

                <div className="text-center pt-4">
                  <Button variant="link" onClick={() => setIsHistoryOpen(true)}>
                    <History className="w-5 h-5 mr-2" /> Ver Histórico
                  </Button>
                </div>
              </div>
            </main>
          </div>
          <HistoryDialog isOpen={isHistoryOpen} onOpenChange={setIsHistoryOpen} history={history} />
        </>
      );
    };

    const ProductCombobox = ({ products, selectedProduct, setSelectedProduct }) => {
      const [open, setOpen] = useState(false);
      return (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between h-12 text-base font-normal">
              {selectedProduct ? selectedProduct.name : "Selecione um produto..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
            <Command>
              <CommandInput placeholder="Buscar produto..." />
              <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
              <CommandGroup className="max-h-60 overflow-y-auto">
                {products.map((product) => (
                  <CommandItem key={product.id} value={product.name} onSelect={() => { setSelectedProduct(product); setOpen(false); }}>
                    {product.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
      );
    };

    const HistoryDialog = ({ isOpen, onOpenChange, history }) => (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[625px]">
          <DialogHeader>
            <DialogTitle>Histórico de Etiquetas</DialogTitle>
            <DialogDescription>Últimas 20 etiquetas geradas.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b">
                  <th className="p-2 text-left font-semibold">Produto</th>
                  <th className="p-2 text-left font-semibold">Data</th>
                  <th className="p-2 text-left font-semibold">Responsável</th>
                </tr>
              </thead>
              <tbody>
                {history.map(item => (
                  <tr key={item.id} className="border-b hover:bg-muted">
                    <td className="p-2">{item.products?.name}</td>
                    <td className="p-2">{new Date(item.created_at).toLocaleString('pt-BR')}</td>
                    <td className="p-2">{item.app_users?.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    );

    export default EtiquetasCozinha;