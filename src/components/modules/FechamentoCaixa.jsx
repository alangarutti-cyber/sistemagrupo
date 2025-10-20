
    import React from 'react';
    import { motion } from 'framer-motion';
    import { PackageCheck } from 'lucide-react';

    const FechamentoCaixa = () => {
      return (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center justify-center h-full text-center p-8 bg-card rounded-lg shadow-sm"
        >
          <PackageCheck className="w-16 h-16 text-primary mb-4" />
          <h1 className="text-2xl font-bold text-foreground">Módulo Fechamento de Caixa</h1>
          <p className="text-muted-foreground mt-2">
            Este módulo está em desenvolvimento. Em breve, você poderá realizar o fechamento do seu caixa por aqui!
          </p>
        </motion.div>
      );
    };

    export default FechamentoCaixa;
  