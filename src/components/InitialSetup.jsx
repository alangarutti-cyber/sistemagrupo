import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Plus, Trash2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

const InitialSetup = ({ onComplete }) => {
  const [companies, setCompanies] = useState([{
    id: Date.now(),
    name: '',
    cnpj: '',
    address: '',
    phone: '',
    email: ''
  }]);

  const addCompany = () => {
    setCompanies([...companies, {
      id: Date.now(),
      name: '',
      cnpj: '',
      address: '',
      phone: '',
      email: ''
    }]);
  };

  const removeCompany = (id) => {
    if (companies.length > 1) {
      setCompanies(companies.filter(c => c.id !== id));
    }
  };

  const updateCompany = (id, field, value) => {
    setCompanies(companies.map(c => 
      c.id === id ? { ...c, [field]: value } : c
    ));
  };

  const handleComplete = () => {
    const validCompanies = companies.filter(c => c.name && c.cnpj);
    
    if (validCompanies.length === 0) {
      toast({
        title: "⚠️ Atenção",
        description: "Cadastre pelo menos uma empresa com nome e CNPJ.",
        variant: "destructive"
      });
      return;
    }
    
    const companiesToInsert = validCompanies.map(({ id, ...rest }) => rest);
    onComplete(companiesToInsert);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md lg:max-w-4xl"
      >
        <div className="glass-effect rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="text-center mb-6 sm:mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full gradient-primary mb-3 sm:mb-4">
              <Building2 className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-1 sm:mb-2">
              Configuração Inicial
            </h1>
            <p className="text-sm sm:text-base text-gray-600">
              Cadastre suas empresas/unidades para começar
            </p>
          </div>

          <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
            {companies.map((company, index) => (
              <motion.div
                key={company.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white/50 rounded-xl p-4 sm:p-6 border border-gray-200 relative"
              >
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <h3 className="font-semibold text-lg sm:text-xl text-gray-800">
                    Empresa {index + 1}
                  </h3>
                  {companies.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCompany(company.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome da Empresa *
                    </label>
                    <input
                      type="text"
                      value={company.name}
                      onChange={(e) => updateCompany(company.id, 'name', e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Ex: Restaurante Central"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CNPJ *
                    </label>
                    <input
                      type="text"
                      value={company.cnpj}
                      onChange={(e) => updateCompany(company.id, 'cnpj', e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="00.000.000/0000-00"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Endereço
                    </label>
                    <input
                      type="text"
                      value={company.address}
                      onChange={(e) => updateCompany(company.id, 'address', e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Rua, número, bairro, cidade"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Telefone
                    </label>
                    <input
                      type="text"
                      value={company.phone}
                      onChange={(e) => updateCompany(company.id, 'phone', e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="(00) 00000-0000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      E-mail
                    </label>
                    <input
                      type="email"
                      value={company.email}
                      onChange={(e) => updateCompany(company.id, 'email', e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="contato@empresa.com"
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mt-6 sm:mt-8">
            <Button
              onClick={addCompany}
              variant="outline"
              className="flex-1 border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 py-3 sm:py-4"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Empresa
            </Button>

            <Button
              onClick={handleComplete}
              className="flex-1 gradient-primary text-white hover:opacity-90 transition-opacity py-3 sm:py-4"
            >
              <Check className="w-4 h-4 mr-2" />
              Concluir Configuração
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default InitialSetup;