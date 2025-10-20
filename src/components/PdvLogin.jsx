
    import React, { useState, useEffect, useCallback } from 'react';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import { motion } from 'framer-motion';
    import { Checkbox } from '@/components/ui/checkbox';
    import { Label } from '@/components/ui/label';
    
    const PdvLogin = ({ onLoginSuccess }) => {
      const { toast } = useToast();
      const [companies, setCompanies] = useState([]);
      const [users, setUsers] = useState([]);
      const [selectedCompanyId, setSelectedCompanyId] = useState('');
      const [pin, setPin] = useState('');
      const [loading, setLoading] = useState(true);
      const [rememberCompany, setRememberCompany] = useState(false);
      const [rememberUser, setRememberUser] = useState(false);
    
      const fetchInitialData = useCallback(async () => {
        setLoading(true);
        try {
          const { data: companiesData, error: companiesError } = await supabase.from('companies').select('*').order('name');
          if (companiesError) throw companiesError;
          setCompanies(companiesData);
    
          const { data: usersData, error: usersError } = await supabase.from('v_pdv_users').select('*');
          if (usersError) throw usersError;
          setUsers(usersData);
    
        } catch (error) {
          toast({ title: 'Erro ao carregar dados', description: error.message, variant: 'destructive' });
        } finally {
          setLoading(false);
        }
      }, [toast]);
    
      useEffect(() => {
        fetchInitialData();
        const rememberedCompanyId = localStorage.getItem('pdv-remembered-company');
        const rememberedUserPIN = localStorage.getItem('pdv-remembered-user-pin');
    
        if (rememberedCompanyId) {
          setSelectedCompanyId(rememberedCompanyId);
          setRememberCompany(true);
        }
        if (rememberedUserPIN) {
            setPin(rememberedUserPIN);
            setRememberUser(true);
        }
    
      }, [fetchInitialData]);
    
      const handlePinChange = (value) => {
        if (pin.length < 4) {
          setPin(pin + value);
        }
      };
    
      const handleBackspace = () => {
        setPin(pin.slice(0, -1));
      };
      
      const handleLogin = async () => {
        if (pin.length !== 4) {
          toast({ title: 'PIN inválido', description: 'O PIN deve ter 4 dígitos.', variant: 'destructive' });
          return;
        }
        if (!selectedCompanyId) {
          toast({ title: 'Selecione uma empresa', variant: 'destructive' });
          return;
        }
    
        const targetUser = users.find(u => u.company_id.toString() === selectedCompanyId && u.pdv_pin === pin);
        
        if (targetUser) {
          toast({ title: `Bem-vindo, ${targetUser.employee_name}!`, variant: 'success' });
          const { data: fullUser, error } = await supabase.from('app_users').select('*').eq('id', targetUser.user_id).single();
          if (error) {
            toast({ title: 'Erro ao buscar dados do usuário', variant: 'destructive' });
            return;
          }
          
          const selectedCompany = companies.find(c => c.id.toString() === selectedCompanyId);
          
          if (rememberCompany) {
            localStorage.setItem('pdv-remembered-company', selectedCompanyId);
          } else {
            localStorage.removeItem('pdv-remembered-company');
          }
          
          if (rememberUser) {
            localStorage.setItem('pdv-remembered-user-pin', pin);
            localStorage.setItem('pdv-remembered-user-id', targetUser.user_id);
          } else {
            localStorage.removeItem('pdv-remembered-user-pin');
            localStorage.removeItem('pdv-remembered-user-id');
          }
          
          onLoginSuccess({ ...fullUser, company: selectedCompany });
        } else {
          toast({ title: 'PIN ou Empresa Incorretos', variant: 'destructive' });
          setPin('');
        }
      };
      
      if (loading) {
        return <div className="h-screen w-screen flex items-center justify-center bg-gray-900 text-white">Carregando...</div>;
      }
    
      return (
        <div className="min-h-screen w-screen bg-gray-900 flex flex-col items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm"
          >
            <div className="text-center mb-8">
              <img src="https://horizons-cdn.hostinger.com/6a44e4d1-b151-41db-aa41-6efe480a026e/8a4270f2b3e8c9733075b2253896593f.png" alt="Stout System Logo" className="mx-auto h-16 mb-2" />
              <p className="text-xl font-semibold text-gray-400">PDV LOGIN</p>
            </div>
    
            <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Selecione a Empresa:</label>
                <select 
                  value={selectedCompanyId} 
                  onChange={e => setSelectedCompanyId(e.target.value)} 
                  className="w-full p-3 bg-gray-700 text-white border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="" disabled>Escolha uma empresa...</option>
                  {companies.map(company => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
              </div>
    
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Digite o PIN do Funcionário:</label>
                <div className="flex justify-center items-center gap-4 bg-gray-700 p-3 rounded-md">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className={`w-4 h-4 rounded-full ${pin.length > i ? 'bg-blue-400' : 'bg-gray-500'}`}></div>
                  ))}
                  <input type="password" value={pin} readOnly className="opacity-0 w-0 h-0" />
                </div>
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <Checkbox id="rememberCompany" checked={rememberCompany} onCheckedChange={setRememberCompany} className="data-[state=checked]:bg-blue-500 border-gray-500" />
                  <Label htmlFor="rememberCompany" className="text-gray-400">Lembrar empresa</Label>
                </div>
                 <div className="flex items-center gap-2">
                  <Checkbox id="rememberUser" checked={rememberUser} onCheckedChange={setRememberUser} className="data-[state=checked]:bg-blue-500 border-gray-500" />
                  <Label htmlFor="rememberUser" className="text-gray-400">Lembrar operador</Label>
                </div>
              </div>
    
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                  <Button key={n} onClick={() => handlePinChange(n.toString())} className="h-14 text-2xl bg-gray-700 hover:bg-gray-600">{n}</Button>
                ))}
                <Button variant="outline" onClick={handleBackspace} className="h-14 text-2xl bg-gray-700 hover:bg-gray-600 border-gray-600">⌫</Button>
                <Button onClick={() => handlePinChange('0')} className="h-14 text-2xl bg-gray-700 hover:bg-gray-600">0</Button>
                <Button onClick={handleLogin} className="h-14 text-lg bg-gray-700 hover:bg-gray-600">Entrar</Button>
              </div>
    
              <Button onClick={handleLogin} className="w-full h-14 text-lg bg-blue-600 hover:bg-blue-700">
                ENTRAR NO PDV
              </Button>
            </div>
    
            <p className="text-center text-xs text-gray-500 mt-6">
              Desenvolvido para multiempresas Stout Group
            </p>
          </motion.div>
        </div>
      );
    };
    
    export default PdvLogin;
  