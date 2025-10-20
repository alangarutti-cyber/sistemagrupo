
    import React from 'react';
    import { motion } from 'framer-motion';
    import { BarChart } from 'lucide-react';

    const ContasReceber = () => {
      return (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center justify-center h-full text-center p-8 bg-card rounded-lg shadow-sm"
        >
          <BarChart className="w-16 h-16 text-primary mb-4" />
          <h1 className="text-2xl font-bold text-foreground">Módulo Contas a Receber</h1>
          <p className="text-muted-foreground mt-2">
            Este módulo está em desenvolvimento. Em breve, você poderá gerenciar todas as suas contas a receber aqui!
          </p>
        </motion.div>
      );
    };

    export default ContasReceber;
  