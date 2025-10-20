import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useUser } from '@/contexts/UserContext';
import { format } from 'date-fns';

const LancamentoRapido = () => {
    const { user, companies: allCompanies, onDataUpdate } = useUser();
    const { toast } = useToast();
    const [formData, setFormData] = useState({
        type: 'despesa',
        company_id: '',
        value: '',
        description: '',
    });
    const [isLoading, setIsLoading] = useState(false);

    const userCompanyIds = useMemo(() => user?.company_ids?.map(c => c.company_id) || [], [user]);
    
    const companies = useMemo(() => {
        if (!allCompanies) return [];
        if (user?.is_admin) return allCompanies;
        return allCompanies.filter(c => userCompanyIds.includes(c.id));
    }, [allCompanies, user, userCompanyIds]);

    useEffect(() => {
        if (companies.length === 1) {
            setFormData(prev => ({ ...prev, company_id: companies[0].id }));
        }
    }, [companies]);

    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSave = async () => {
        if (!formData.company_id || !formData.value || !formData.description) {
            toast({
                title: 'Campos obrigatórios',
                description: 'Por favor, preencha todos os campos.',
                variant: 'destructive',
            });
            return;
        }

        setIsLoading(true);

        const table = formData.type === 'despesa' ? 'contas_pagar' : 'contas_receber';
        const valueAsNumber = parseFloat(formData.value.replace(',', '.'));

        const { error } = await supabase.from(table).insert({
            company_id: formData.company_id,
            value: valueAsNumber,
            description: formData.description,
            due_date: format(new Date(), 'yyyy-MM-dd'),
            status: 'Pendente',
        });

        setIsLoading(false);

        if (error) {
            console.error(`Error saving to ${table}:`, error);
            toast({
                title: 'Erro ao salvar',
                description: error.message,
                variant: 'destructive',
            });
        } else {
            toast({
                title: '✅ Sucesso!',
                description: `${formData.type === 'despesa' ? 'Despesa' : 'Receita'} salva com sucesso.`,
            });
            
            setFormData({
                type: 'despesa',
                company_id: companies.length === 1 ? companies[0].id : '',
                value: '',
                description: '',
            });
            if (onDataUpdate) onDataUpdate();
        }
    };

    return (
        <div className="flex justify-center items-start pt-8 sm:pt-12 min-h-full bg-background">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md p-6 sm:p-8 bg-card rounded-2xl shadow-lg space-y-6"
            >
                <div className="text-center">
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Lançamento Rápido</h1>
                    <p className="text-muted-foreground mt-2">Adicione uma despesa ou receita de forma simples e rápida.</p>
                </div>

                <div className="space-y-4">
                    <div>
                        <Label>Tipo de Lançamento</Label>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                            <Button
                                variant={formData.type === 'despesa' ? 'default' : 'outline'}
                                onClick={() => setFormData(prev => ({ ...prev, type: 'despesa' }))}
                            >
                                Despesa
                            </Button>
                            <Button
                                variant={formData.type === 'receita' ? 'default' : 'outline'}
                                onClick={() => setFormData(prev => ({ ...prev, type: 'receita' }))}
                            >
                                Receita
                            </Button>
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="company_id">Empresa</Label>
                        <select
                            id="company_id"
                            value={formData.company_id}
                            onChange={handleInputChange}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-input border rounded-md focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-background"
                        >
                            <option value="">Selecione uma empresa</option>
                            {companies.map(company => (
                                <option key={company.id} value={company.id}>{company.name}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div>
                        <Label htmlFor="value">Valor (R$)</Label>
                        <Input 
                            id="value" 
                            type="number" 
                            placeholder="Ex: 50,00"
                            value={formData.value}
                            onChange={handleInputChange}
                        />
                    </div>
                    
                    <div>
                        <Label htmlFor="description">Descrição</Label>
                        <Input 
                            id="description" 
                            type="text" 
                            placeholder="Ex: Compra de material de limpeza"
                            value={formData.description}
                            onChange={handleInputChange}
                        />
                    </div>
                </div>

                <Button 
                    onClick={handleSave} 
                    disabled={isLoading}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                    size="lg"
                >
                    {isLoading ? 'Salvando...' : 'Salvar Lançamento'}
                </Button>
            </motion.div>
        </div>
    );
};

export default LancamentoRapido;